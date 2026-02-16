import express from 'express';
import Ride from '../models/Ride.js';
import User from '../models/User.js';
import Request from '../models/Request.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { DEFAULT_NEAR_DISTANCE_METERS } from '../utils/distance.js';
import { calculateCompatibilityV2 } from '../utils/interestMatch.js';
import rateLimitRideSearch from '../middleware/rateLimitRideSearch.js';
import { calculateRouteOverlap } from '../utils/routeMatch.js';

const router = express.Router();

function buildRoutePoints(ride) {
  return [
    ride.startLocation?.coordinates,
    ...(ride.stops || []).map((stop) => stop.coordinates),
    ride.endLocation?.coordinates,
  ].filter(Boolean);
}

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { startLocation, endLocation, stops = [], dateTime, vehicleType, seatsAvailable, totalFuelCost = 0, tollCharges = 0 } = req.body;

    const ride = await Ride.create({
      driver: req.user.id,
      startLocation,
      endLocation,
      stops,
      dateTime,
      vehicleType,
      seatsAvailable,
      totalFuelCost,
      tollCharges,
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
    const passengerStops = req.body.stops || [];

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
    }).populate('driver', 'name email phone interests education workDomain workType bio travelFrequency smokingPreference conversationStyle gender genderPreference age ageRange travelPurpose averageRating');

    const passengerRoute = [[startLongitude, startLatitude], ...passengerStops, [endLongitude, endLatitude]];

    const withCompatibility = rides
      .map((ride) => {
        const routeOverlap = calculateRouteOverlap(passengerRoute, buildRoutePoints(ride));
        const compatibility = calculateCompatibilityV2(requester, ride.driver, { routeOverlapScore: routeOverlap.overlapScore });

        return {
          ...ride.toObject(),
          routeOverlap,
          compatibility: compatibility.score,
          compatibilityReasons: compatibility.reasons,
          compatibilityBreakdown: compatibility.breakdown,
          driverRating: ride.driver.averageRating || 0,
        };
      })
      .sort((a, b) => {
        if (b.compatibility !== a.compatibility) return b.compatibility - a.compatibility;
        if ((b.routeOverlap?.overlapPercent || 0) !== (a.routeOverlap?.overlapPercent || 0)) {
          return (b.routeOverlap?.overlapPercent || 0) - (a.routeOverlap?.overlapPercent || 0);
        }
        return (b.driverRating || 0) - (a.driverRating || 0);
      });

    return res.json(withCompatibility);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/:id/fare-split', authMiddleware, async (req, res) => {
  const ride = await Ride.findById(req.params.id);
  if (!ride) return res.status(404).json({ message: 'Ride not found' });

  const { totalFuelCost = ride.totalFuelCost || 0, tollCharges = ride.tollCharges || 0 } = req.body;
  const acceptedCount = await Request.countDocuments({ ride: ride._id, status: 'accepted' });
  const passengers = Math.max(1, acceptedCount + 1);
  const totalCost = Number(totalFuelCost) + Number(tollCharges);

  return res.json({
    totalCost,
    passengers,
    perPassenger: Number((totalCost / passengers).toFixed(2)),
  });
});

router.get('/heatmap/demand', authMiddleware, async (_req, res) => {
  const pending = await Request.find({ status: 'pending' }).populate('ride', 'startLocation');
  const cells = new Map();

  for (const reqItem of pending) {
    const coords = reqItem.ride?.startLocation?.coordinates;
    if (!coords || coords.length !== 2) continue;
    const [lng, lat] = coords;
    const bucket = `${lat.toFixed(1)}:${lng.toFixed(1)}`;
    const current = cells.get(bucket) || { lat: Number(lat.toFixed(1)), lng: Number(lng.toFixed(1)), demand: 0 };
    current.demand += 1;
    cells.set(bucket, current);
  }

  return res.json([...cells.values()]);
});

export default router;
