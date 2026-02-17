import express from 'express';
import Ride from '../models/Ride.js';
import User from '../models/User.js';
import Request from '../models/Request.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { DEFAULT_NEAR_DISTANCE_METERS, haversineKm } from '../utils/distance.js';
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

function normalizeSearchPayload(body = {}) {
  const startLongitude = body.startLongitude ?? body.startLocation?.coordinates?.[0];
  const startLatitude = body.startLatitude ?? body.startLocation?.coordinates?.[1];
  const endLongitude = body.endLongitude ?? body.endLocation?.coordinates?.[0];
  const endLatitude = body.endLatitude ?? body.endLocation?.coordinates?.[1];
  const passengerStops = Array.isArray(body.stops) ? body.stops : [];

  const filters = {
    maxDetourKm: Number(body.maxDetourKm ?? 20),
    timeFlexMinutes: Number(body.timeFlexMinutes ?? 0),
    vehicleType: body.vehicleType || '',
    genderPreference: body.genderPreference || '',
    minCompatibilityScore: Number(body.minCompatibilityScore ?? 0),
    proximityKm: Number(body.proximityKm ?? 10),
    preferredDateTime: body.preferredDateTime ? new Date(body.preferredDateTime) : null,
  };

  return {
    startLongitude: Number(startLongitude),
    startLatitude: Number(startLatitude),
    endLongitude: Number(endLongitude),
    endLatitude: Number(endLatitude),
    passengerStops,
    filters,
  };
}

async function searchRidesForUser(userId, payload = {}) {
  const {
    startLongitude,
    startLatitude,
    endLongitude,
    endLatitude,
    passengerStops,
    filters,
  } = normalizeSearchPayload(payload);

  if ([startLongitude, startLatitude, endLongitude, endLatitude].some((value) => Number.isNaN(Number(value)))) {
    return { error: { status: 400, message: 'Invalid coordinates supplied for ride search' } };
  }

  const requester = await User.findById(userId);
  if (!requester) {
    return { error: { status: 401, message: 'User not found' } };
  }

  const nearDistanceMeters = Math.max(1000, Number(filters.proximityKm || 10) * 1000);
  const rideQuery = {
    driver: { $ne: userId },
    dateTime: { $gte: new Date() },
    startLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: [startLongitude, startLatitude] },
        $maxDistance: nearDistanceMeters || DEFAULT_NEAR_DISTANCE_METERS,
      },
    },
    endLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: [endLongitude, endLatitude] },
        $maxDistance: nearDistanceMeters || DEFAULT_NEAR_DISTANCE_METERS,
      },
    },
  };

  if (filters.vehicleType) {
    rideQuery.vehicleType = filters.vehicleType;
  }

  const rides = await Ride.find(rideQuery).populate(
    'driver',
    'name email phone interests education workDomain workType bio travelFrequency smokingPreference conversationStyle gender genderPreference age ageRange travelPurpose averageRating'
  );

  const passengerRoute = [[startLongitude, startLatitude], ...passengerStops, [endLongitude, endLatitude]];
  const passengerDistanceKm = haversineKm([startLongitude, startLatitude], [endLongitude, endLatitude]);

  const withCompatibility = rides
    .map((ride) => {
      const routeOverlap = calculateRouteOverlap(passengerRoute, buildRoutePoints(ride));
      const compatibility = calculateCompatibilityV2(requester, ride.driver, {
        routeOverlapScore: routeOverlap.overlapScore,
      });
      const sharedDistance = routeOverlap.estimatedSharedDistanceKm || 0;
      const detourKm = Math.max(0, Number((passengerDistanceKm - sharedDistance).toFixed(2)));
      const timeDeltaMinutes = filters.preferredDateTime
        ? Math.abs(new Date(ride.dateTime).getTime() - filters.preferredDateTime.getTime()) / 60000
        : 0;

      return {
        ...ride.toObject(),
        routeOverlap,
        compatibility: compatibility.score,
        compatibilityReasons: compatibility.reasons,
        compatibilityBreakdown: compatibility.breakdown,
        driverRating: ride.driver.averageRating || 0,
        detourKm,
        etaMinutes: Math.round((ride.distanceKm || passengerDistanceKm || 1) * 2.2),
        searchMetrics: {
          startProximityKm: Number(
            haversineKm([startLongitude, startLatitude], ride.startLocation?.coordinates || []).toFixed(2)
          ),
          endProximityKm: Number(
            haversineKm([endLongitude, endLatitude], ride.endLocation?.coordinates || []).toFixed(2)
          ),
          timeDeltaMinutes: Math.round(timeDeltaMinutes),
        },
      };
    })
    .filter((ride) => {
      if (filters.minCompatibilityScore && ride.compatibility < filters.minCompatibilityScore) return false;
      if (filters.maxDetourKm && ride.detourKm > filters.maxDetourKm) return false;
      if (filters.timeFlexMinutes && ride.searchMetrics.timeDeltaMinutes > filters.timeFlexMinutes) return false;
      if (
        filters.genderPreference &&
        filters.genderPreference !== 'any' &&
        String(ride.driver?.gender || '') !== String(filters.genderPreference)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (b.compatibility !== a.compatibility) return b.compatibility - a.compatibility;
      if ((b.routeOverlap?.overlapPercent || 0) !== (a.routeOverlap?.overlapPercent || 0)) {
        return (b.routeOverlap?.overlapPercent || 0) - (a.routeOverlap?.overlapPercent || 0);
      }
      return (a.detourKm || 0) - (b.detourKm || 0);
    });

  const nearbyDrivers = withCompatibility.map((ride) => ({
    driverId: ride.driver?._id,
    name: ride.driver?.name || 'Driver',
    vehicleType: ride.vehicleType,
    gender: ride.driver?.gender || 'prefer_not_say',
    lat: ride.startLocation?.coordinates?.[1],
    lng: ride.startLocation?.coordinates?.[0],
    rideId: ride._id,
  }));

  return { rides: withCompatibility, nearbyDrivers };
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
    const result = await searchRidesForUser(req.user.id, req.body);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    return res.json(result.rides);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/search/proximity', authMiddleware, rateLimitRideSearch, async (req, res) => {
  try {
    const result = await searchRidesForUser(req.user.id, req.body);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    return res.json({
      rides: result.rides,
      nearbyDrivers: result.nearbyDrivers,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/compatibility', authMiddleware, async (req, res) => {
  try {
    const { rideId, startLocation, endLocation, stops = [] } = req.body;
    if (!rideId) return res.status(400).json({ message: 'rideId is required' });
    if (!startLocation?.coordinates || !endLocation?.coordinates) {
      return res.status(400).json({ message: 'startLocation and endLocation are required' });
    }

    const [startLng, startLat] = startLocation.coordinates;
    const [endLng, endLat] = endLocation.coordinates;
    if ([startLng, startLat, endLng, endLat].some((value) => Number.isNaN(Number(value)))) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }

    const [ride, requester] = await Promise.all([
      Ride.findById(rideId).populate(
        'driver',
        'name email phone interests education workDomain workType bio travelFrequency smokingPreference conversationStyle gender genderPreference age ageRange travelPurpose averageRating'
      ),
      User.findById(req.user.id),
    ]);

    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (!requester) return res.status(401).json({ message: 'Unauthorized user' });

    const passengerRoute = [[startLng, startLat], ...(Array.isArray(stops) ? stops : []), [endLng, endLat]];
    const routeOverlap = calculateRouteOverlap(passengerRoute, buildRoutePoints(ride));
    const compatibility = calculateCompatibilityV2(requester, ride.driver, {
      routeOverlapScore: routeOverlap.overlapScore,
    });

    return res.json({
      rideId,
      compatibility: compatibility.score,
      reasons: compatibility.reasons,
      breakdown: compatibility.breakdown,
      routeOverlap,
    });
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
