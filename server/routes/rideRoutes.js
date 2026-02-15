import express from 'express';
import Ride from '../models/Ride.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { DEFAULT_NEAR_DISTANCE_METERS } from '../utils/distance.js';
import { calculateCompatibility } from '../utils/interestMatch.js';
import rateLimitRideSearch from '../middleware/rateLimitRideSearch.js';

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { startLocation, endLocation, dateTime, vehicleType, seatsAvailable } = req.body;

    const ride = await Ride.create({
      driver: req.user.id,
      startLocation,
      endLocation,
      dateTime,
      vehicleType,
      seatsAvailable,
    });

    return res.status(201).json(ride);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/search', authMiddleware, rateLimitRideSearch, async (req, res) => {
  try {
    const startLongitude = req.body.startLongitude ?? req.body.startLocation?.coordinates?.[0];
    const startLatitude = req.body.startLatitude ?? req.body.startLocation?.coordinates?.[1];
    const endLongitude = req.body.endLongitude ?? req.body.endLocation?.coordinates?.[0];
    const endLatitude = req.body.endLatitude ?? req.body.endLocation?.coordinates?.[1];
    if ([startLongitude, startLatitude, endLongitude, endLatitude].some((value) => Number.isNaN(Number(value)))) {
      return res.status(400).json({ message: 'Invalid coordinates supplied for ride search' });
    }

    const requester = await User.findById(req.user.id);

    const rides = await Ride.find({
      driver: { $ne: req.user.id },
      startLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [startLongitude, startLatitude] },
          $maxDistance: DEFAULT_NEAR_DISTANCE_METERS,
        },
      },
      endLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [endLongitude, endLatitude] },
          $maxDistance: DEFAULT_NEAR_DISTANCE_METERS,
        },
      },
    }).populate('driver', 'name email phone interests education workDomain bio travelFrequency');

    const withCompatibility = rides
      .map((ride) => ({
        ...ride.toObject(),
        compatibility: calculateCompatibility(requester, ride.driver),
      }))
      .sort((a, b) => b.compatibility - a.compatibility);

    return res.json(withCompatibility);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
