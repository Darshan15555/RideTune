import crypto from 'crypto';
import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Request from '../models/Request.js';
import Ride from '../models/Ride.js';
import RideSession from '../models/RideSession.js';
import Message from '../models/Message.js';
import RideStatusEvent from '../models/RideStatusEvent.js';
import User from '../models/User.js';
import { isValidObjectId, validateObjectIdParam } from '../middleware/validateObjectId.js';

const router = express.Router();

const buildRoomId = ({ rideId, driverId, passengerId }) => `${rideId}:${driverId}:${passengerId}`;
const statusOrder = ['searching', 'matched', 'driver_accepted', 'on_the_way', 'started', 'completed'];

function canTransition(current, next) {
  if (next === 'cancelled') return true;
  const currentIndex = statusOrder.indexOf(current);
  const nextIndex = statusOrder.indexOf(next);
  return nextIndex >= currentIndex;
}

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { rideId } = req.body;
    if (!isValidObjectId(rideId)) return res.status(400).json({ message: 'Invalid rideId' });

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (String(ride.driver) === req.user.id) return res.status(400).json({ message: 'Driver cannot request own ride' });

    const request = await Request.create({
      ride: ride._id,
      passenger: req.user.id,
      driver: ride.driver,
    });

    await req.app.locals.notify?.(ride.driver, 'request', 'You received a new ride request.');
    return res.status(201).json(request);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Request already sent' });
    return res.status(500).json({ message: error.message });
  }
});

router.get('/sent', authMiddleware, async (req, res) => {
  const sent = await Request.find({ passenger: req.user.id })
    .populate({ path: 'ride', populate: { path: 'driver', select: 'name email phone averageRating' } })
    .sort({ createdAt: -1 });

  const payload = await Promise.all(
    sent.map(async (entry) => {
      const session = await RideSession.findOne({ request: entry._id }).select('roomId _id status shareToken');
      const contact = entry.status === 'accepted' ? entry.ride.driver.phone : null;
      return {
        ...entry.toObject(),
        contact,
        roomId: session?.roomId || null,
        sessionId: session?._id || null,
        rideStatus: session?.status || null,
        shareToken: session?.shareToken || null,
      };
    })
  );

  return res.json(payload);
});

router.get('/received', authMiddleware, async (req, res) => {
  const received = await Request.find({ driver: req.user.id })
    .populate('passenger', 'name email phone averageRating')
    .populate('ride')
    .sort({ createdAt: -1 });

  const payload = await Promise.all(
    received.map(async (entry) => {
      const session = await RideSession.findOne({ request: entry._id }).select('roomId _id status shareToken');
      const contact = entry.status === 'accepted' ? entry.passenger.phone : null;
      return {
        ...entry.toObject(),
        contact,
        roomId: session?.roomId || null,
        sessionId: session?._id || null,
        rideStatus: session?.status || null,
        shareToken: session?.shareToken || null,
      };
    })
  );

  return res.json(payload);
});

router.put('/:id/accept', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const request = await Request.findOne({ _id: req.params.id, driver: req.user.id }).populate('ride');
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ message: `Request already ${request.status}` });

  request.status = 'accepted';
  await request.save();

  const roomId = buildRoomId({ rideId: request.ride._id, driverId: request.driver, passengerId: request.passenger });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const shareToken = crypto.randomBytes(12).toString('hex');

  const session = await RideSession.findOneAndUpdate(
    { request: request._id },
    {
      ride: request.ride._id,
      driver: request.driver,
      passenger: request.passenger,
      request: request._id,
      roomId,
      status: 'driver_accepted',
      verificationOtp: otp,
      shareToken,
    },
    { upsert: true, new: true }
  );

  await RideStatusEvent.create({ rideSession: session._id, status: 'driver_accepted', updatedBy: req.user.id });

  await req.app.locals.notify?.(request.passenger, 'accepted', `Your ride request was accepted. OTP: ${otp}`);
  req.app.locals.io?.to(`user:${String(request.passenger)}`).emit('request-accepted', {
    requestId: request._id,
    sessionId: session._id,
    roomId,
    status: session.status,
  });

  return res.json({ request, session });
});

router.put('/:id/reject', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const request = await Request.findOne({ _id: req.params.id, driver: req.user.id });
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ message: `Request already ${request.status}` });

  request.status = 'rejected';
  await request.save();

  await req.app.locals.notify?.(request.passenger, 'rejected', 'Your ride request was rejected.');
  return res.json(request);
});

router.get('/sessions/:id', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const session = await RideSession.findOne({
    _id: req.params.id,
    $or: [{ driver: req.user.id }, { passenger: req.user.id }],
  }).populate('ride', 'startLocation endLocation stops');

  if (!session) return res.status(404).json({ message: 'Ride session not found' });

  const role = String(session.driver) === req.user.id ? 'driver' : 'passenger';
  return res.json({ session, role, shareLink: `${process.env.CLIENT_URL || 'http://localhost:5173'}/live-ride?share=${session.shareToken}` });
});

router.put('/sessions/:id/status', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const { status } = req.body;
  const allowed = ['searching', 'matched', 'driver_accepted', 'on_the_way', 'started', 'completed', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  const session = await RideSession.findOne({
    _id: req.params.id,
    $or: [{ driver: req.user.id }, { passenger: req.user.id }],
  });
  if (!session) return res.status(404).json({ message: 'Ride session not found' });
  if (!canTransition(session.status, status)) return res.status(400).json({ message: 'Invalid state transition' });

  session.status = status;
  if (status === 'started') session.startedAt = new Date();
  if (status === 'completed') session.completedAt = new Date();
  if (status === 'cancelled') {
    const canceller = await User.findById(req.user.id);
    if (canceller) {
      canceller.cancelledRidesCount += 1;
      if (canceller.cancelledRidesCount >= 3) {
        canceller.fraudFlags += 1;
      }
      await canceller.save();
    }
  }
  await session.save();

  await RideStatusEvent.create({ rideSession: session._id, status, updatedBy: req.user.id });

  req.app.locals.io?.to(session.roomId).emit('ride-status-update', { sessionId: session._id, status });

  return res.json(session);
});

router.post('/sessions/:id/verify-otp', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const { otp } = req.body;

  const session = await RideSession.findOne({
    _id: req.params.id,
    $or: [{ driver: req.user.id }, { passenger: req.user.id }],
  });
  if (!session) return res.status(404).json({ message: 'Ride session not found' });
  if (String(session.verificationOtp) !== String(otp)) return res.status(400).json({ message: 'Invalid OTP' });

  session.verifiedAt = new Date();
  await session.save();
  return res.json({ verified: true });
});

router.post('/sessions/:id/sos', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const session = await RideSession.findOne({
    _id: req.params.id,
    $or: [{ driver: req.user.id }, { passenger: req.user.id }],
  }).populate('driver passenger');
  if (!session) return res.status(404).json({ message: 'Ride session not found' });

  const owner = String(session.driver._id) === req.user.id ? session.driver : session.passenger;
  const emergencyNumbers = (owner.emergencyContacts || []).map((entry) => entry.phone).filter(Boolean);

  await req.app.locals.notify?.(session.driver._id, 'message', '🚨 SOS alert triggered for active ride.');
  await req.app.locals.notify?.(session.passenger._id, 'message', '🚨 SOS alert triggered for active ride.');
  req.app.locals.io?.to(session.roomId).emit('sos-alert', { sessionId: session._id, raisedBy: req.user.id, emergencyNumbers });

  return res.json({ ok: true, emergencyNumbers, shareLink: `${process.env.CLIENT_URL || 'http://localhost:5173'}/live-ride?share=${session.shareToken}` });
});

router.get('/messages/:roomId', authMiddleware, async (req, res) => {
  const { roomId } = req.params;

  const session = await RideSession.findOne({ roomId, $or: [{ driver: req.user.id }, { passenger: req.user.id }] });
  if (!session) return res.status(403).json({ message: 'Not allowed to read this chat' });

  const messages = await Message.find({ roomId }).sort({ timestamp: 1 });
  return res.json(messages);
});

export default router;
