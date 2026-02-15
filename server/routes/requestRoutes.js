import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Request from '../models/Request.js';
import Ride from '../models/Ride.js';

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { rideId } = req.body;
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

  const payload = sent.map((entry) => {
    const contact = entry.status === 'accepted' ? entry.ride.driver.phone : null;
    return { ...entry.toObject(), contact };
  });

  return res.json(payload);
});

router.get('/received', authMiddleware, async (req, res) => {
  const received = await Request.find({ driver: req.user.id })
    .populate('passenger', 'name email phone')
    .populate('ride')
    .sort({ createdAt: -1 });

  const payload = received.map((entry) => {
    const contact = entry.status === 'accepted' ? entry.passenger.phone : null;
    return { ...entry.toObject(), contact };
  });

  return res.json(payload);
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status must be accepted or rejected' });
  }

  const request = await Request.findOne({ _id: req.params.id, driver: req.user.id });
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }

  request.status = status;
  await request.save();

  return res.json(request);
});

export default router;
