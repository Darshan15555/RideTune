import express from 'express';
import Ride from '../models/Ride.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { DEFAULT_NEAR_DISTANCE_METERS } from '../utils/distance.js';
import { calculateCompatibility } from '../utils/interestMatch.js';

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

router.post('/search', authMiddleware, async (req, res) => {
  try {
    const { startLongitude, startLatitude, endLongitude, endLatitude } = req.body;
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
    }).populate('driver', 'name email phone interests');

    const withCompatibility = rides
      .map((ride) => {
        const compatibility = calculateCompatibility(requester.interests, ride.driver.interests);
        return {
          ...ride.toObject(),
          compatibility,
        };
      })
      .sort((a, b) => b.compatibility - a.compatibility);

    return res.json(withCompatibility);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
