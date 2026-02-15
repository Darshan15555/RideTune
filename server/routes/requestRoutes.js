import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Request from '../models/Request.js';
import Ride from '../models/Ride.js';
import RideSession from '../models/RideSession.js';
import Message from '../models/Message.js';
import { isValidObjectId, validateObjectIdParam } from '../middleware/validateObjectId.js';

const router = express.Router();

const buildRoomId = ({ rideId, driverId, passengerId }) => `${rideId}:${driverId}:${passengerId}`;

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { rideId } = req.body;
    if (!isValidObjectId(rideId)) {
      return res.status(400).json({ message: 'Invalid rideId' });
    }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (String(ride.driver) === req.user.id) {
      return res.status(400).json({ message: 'Driver cannot request own ride' });
    }

    const request = await Request.create({
      ride: ride._id,
      passenger: req.user.id,
      driver: ride.driver,
    });

    await req.app.locals.notify?.(ride.driver, 'request', 'You received a new ride request.');

    return res.status(201).json(request);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Request already sent' });
    }
    return res.status(500).json({ message: error.message });
  }
});

router.get('/sent', authMiddleware, async (req, res) => {
  const sent = await Request.find({ passenger: req.user.id })
    .populate({ path: 'ride', populate: { path: 'driver', select: 'name email phone' } })
    .sort({ createdAt: -1 });

  const payload = await Promise.all(
    sent.map(async (entry) => {
      const session = await RideSession.findOne({ request: entry._id }).select('roomId _id');
      const contact = entry.status === 'accepted' ? entry.ride.driver.phone : null;
      return { ...entry.toObject(), contact, roomId: session?.roomId || null, sessionId: session?._id || null };
    })
  );

  return res.json(payload);
});

router.get('/received', authMiddleware, async (req, res) => {
  const received = await Request.find({ driver: req.user.id })
    .populate('passenger', 'name email phone')
    .populate('ride')
    .sort({ createdAt: -1 });

  const payload = await Promise.all(
    received.map(async (entry) => {
      const session = await RideSession.findOne({ request: entry._id }).select('roomId _id');
      const contact = entry.status === 'accepted' ? entry.passenger.phone : null;
      return { ...entry.toObject(), contact, roomId: session?.roomId || null, sessionId: session?._id || null };
    })
  );

  return res.json(payload);
});

router.put('/:id/accept', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const request = await Request.findOne({ _id: req.params.id, driver: req.user.id }).populate('ride');
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ message: `Request already ${request.status}` });
  }

  request.status = 'accepted';
  await request.save();

  const roomId = buildRoomId({ rideId: request.ride._id, driverId: request.driver, passengerId: request.passenger });
  const session = await RideSession.findOneAndUpdate(
    { request: request._id },
    {
      ride: request.ride._id,
      driver: request.driver,
      passenger: request.passenger,
      request: request._id,
      roomId,
      status: 'active',
    },
    { upsert: true, new: true }
  );

  await req.app.locals.notify?.(request.passenger, 'accepted', 'Your ride request was accepted.');
  req.app.locals.io?.to(`user:${String(request.passenger)}`).emit('request-accepted', {
    requestId: request._id,
    sessionId: session._id,
    roomId,
  });

  return res.json({ request, session });
});

router.put('/:id/reject', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const request = await Request.findOne({ _id: req.params.id, driver: req.user.id });
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ message: `Request already ${request.status}` });
  }

  request.status = 'rejected';
  await request.save();

  await req.app.locals.notify?.(request.passenger, 'rejected', 'Your ride request was rejected.');

  return res.json(request);
});


router.get('/sessions/:id', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const session = await RideSession.findOne({
    _id: req.params.id,
    $or: [{ driver: req.user.id }, { passenger: req.user.id }],
  }).populate('ride', 'startLocation endLocation');

  if (!session) {
    return res.status(404).json({ message: 'Ride session not found' });
  }

  const role = String(session.driver) === req.user.id ? 'driver' : 'passenger';

  return res.json({
    session,
    role,
  });
});

router.get('/messages/:roomId', authMiddleware, async (req, res) => {
  const { roomId } = req.params;

  const session = await RideSession.findOne({
    roomId,
    $or: [{ driver: req.user.id }, { passenger: req.user.id }],
  });

  if (!session) {
    return res.status(403).json({ message: 'Not allowed to read this chat' });
  }

  const messages = await Message.find({ roomId }).sort({ timestamp: 1 });
  return res.json(messages);
});

export default router;
