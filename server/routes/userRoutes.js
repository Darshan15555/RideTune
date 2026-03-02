import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import RideSession from '../models/RideSession.js';
import Ride from '../models/Ride.js';
import Request from '../models/Request.js';
import Review from '../models/Review.js';
import { validateObjectIdParam } from '../middleware/validateObjectId.js';

const router = express.Router();

router.get('/history', authMiddleware, async (req, res) => {
  const sessions = await RideSession.find({
    $or: [{ driver: req.user.id }, { passenger: req.user.id }],
    status: { $in: ['completed', 'cancelled'] },
  })
    .populate('ride', 'startLocation endLocation dateTime distanceKm')
    .sort({ updatedAt: -1 });

  return res.json(sessions);
});

router.get('/analytics', authMiddleware, async (req, res) => {
  const sessions = await RideSession.find({
    $or: [{ driver: req.user.id }, { passenger: req.user.id }],
  }).populate('ride', 'distanceKm');

  const completed = sessions.filter((item) => item.status === 'completed');
  const totalRides = completed.length;
  const distanceTravelled = completed.reduce((sum, item) => sum + Number(item.ride?.distanceKm || 0), 0);

  const requests = await Request.find({ passenger: req.user.id, status: 'ACCEPTED' }).populate('ride', 'totalFuelCost tollCharges');
  const moneySaved = requests.reduce((sum, item) => {
    const totalCost = Number(item.ride?.totalFuelCost || 0) + Number(item.ride?.tollCharges || 0);
    return sum + totalCost * 0.4;
  }, 0);

  const avgCompatibility = totalRides ? 78 : 0;

  return res.json({
    totalRides,
    distanceTravelled: Number(distanceTravelled.toFixed(2)),
    moneySaved: Number(moneySaved.toFixed(2)),
    compatibilityAverage: avgCompatibility,
    level: totalRides > 20 ? 'Road Legend' : totalRides > 8 ? 'Frequent Rider' : 'New Explorer',
  });
});

router.get('/suggestions', authMiddleware, async (req, res) => {
  const previousRequests = await Request.find({ passenger: req.user.id, status: { $in: ['ACCEPTED', 'PENDING'] } })
    .populate('ride', 'startLocation endLocation')
    .sort({ createdAt: -1 })
    .limit(5);

  const routeFrequency = new Map();
  for (const reqItem of previousRequests) {
    const from = reqItem.ride?.startLocation?.name;
    const to = reqItem.ride?.endLocation?.name;
    if (!from || !to) continue;
    const key = `${from}→${to}`;
    routeFrequency.set(key, (routeFrequency.get(key) || 0) + 1);
  }

  const best = [...routeFrequency.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) return res.json({ suggestion: null });

  const [route] = best;
  const [from, to] = route.split('→');

  const rides = await Ride.find({
    'startLocation.name': from,
    'endLocation.name': to,
    dateTime: { $gte: new Date() },
  })
    .populate('driver', 'name averageRating')
    .sort({ dateTime: 1 })
    .limit(3);

  return res.json({ suggestion: { from, to, rides } });
});

router.put('/profile', authMiddleware, async (req, res) => {
  const allowed = [
    'interests',
    'education',
    'workDomain',
    'workType',
    'bio',
    'travelFrequency',
    'smokingPreference',
    'conversationStyle',
    'genderPreference',
    'ageRange',
    'travelPurpose',
    'emergencyContacts',
  ];
  const payload = {};
  for (const key of allowed) {
    if (key in req.body) payload[key] = req.body[key];
  }

  const user = await User.findByIdAndUpdate(req.user.id, payload, { new: true });
  return res.json(user);
});

router.post('/reviews', authMiddleware, async (req, res) => {
  const { rideSessionId, revieweeId, rating, comment = '' } = req.body;

  const session = await RideSession.findOne({ _id: rideSessionId, $or: [{ driver: req.user.id }, { passenger: req.user.id }] });
  if (!session || session.status !== 'completed') {
    return res.status(400).json({ message: 'Reviews can only be submitted after ride completion' });
  }

  const review = await Review.findOneAndUpdate(
    { rideSession: rideSessionId, reviewer: req.user.id },
    { rideSession: rideSessionId, ride: session.ride, reviewer: req.user.id, reviewee: revieweeId, rating, comment },
    { upsert: true, new: true }
  );

  const stats = await Review.aggregate([
    { $match: { reviewee: review.reviewee } },
    { $group: { _id: '$reviewee', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const aggregate = stats[0] || { average: 0, count: 0 };
  await User.findByIdAndUpdate(review.reviewee, {
    averageRating: Number((aggregate.average || 0).toFixed(2)),
    totalRatings: aggregate.count,
  });

  await req.app.locals.notify?.(review.reviewee, 'REVIEW', 'You received a new rating and review.', {
    ride: session.ride,
    fromUser: req.user.id,
  });

  return res.status(201).json(review);
});

router.get('/reviews/:id', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const reviews = await Review.find({ reviewee: req.params.id }).populate('reviewer', 'name');
  return res.json(reviews);
});

export default router;
