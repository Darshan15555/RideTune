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
  const startLongitude =
    body.startLongitude ?? body.startLng ?? body.pickupLocation?.coordinates?.[0] ?? body.startLocation?.coordinates?.[0];
  const startLatitude =
    body.startLatitude ?? body.startLat ?? body.pickupLocation?.coordinates?.[1] ?? body.startLocation?.coordinates?.[1];
  const endLongitude =
    body.endLongitude ?? body.endLng ?? body.dropLocation?.coordinates?.[0] ?? body.endLocation?.coordinates?.[0];
  const endLatitude =
    body.endLatitude ?? body.endLat ?? body.dropLocation?.coordinates?.[1] ?? body.endLocation?.coordinates?.[1];
  const passengerStops = Array.isArray(body.stops) ? body.stops : [];

  const filters = {
    vehicleType: body.vehicleType || '',
    genderPreference: body.genderPreference || '',
    minCompatibilityScore: Number(body.minCompatibilityScore ?? 0),
    maxPrice: Number(body.maxPrice ?? 0),
    searchDate: body.date || '',
    timeWindow: body.timeWindow || '',
    proximityKm: Number(body.proximityKm ?? 15),
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

  const nearDistanceMeters = Math.max(1000, Number(filters.proximityKm || 15) * 1000);
  const now = new Date();
  const rideDateFilter = { $gte: now };

  if (filters.searchDate) {
    const dayStart = new Date(`${filters.searchDate}T00:00:00`);
    const dayEnd = new Date(`${filters.searchDate}T23:59:59`);
    if (!Number.isNaN(dayStart.getTime()) && !Number.isNaN(dayEnd.getTime())) {
      rideDateFilter.$gte = dayStart;
      rideDateFilter.$lte = dayEnd;

      if (filters.timeWindow === 'morning') {
        rideDateFilter.$gte = new Date(`${filters.searchDate}T05:00:00`);
        rideDateFilter.$lte = new Date(`${filters.searchDate}T11:59:59`);
      } else if (filters.timeWindow === 'afternoon') {
        rideDateFilter.$gte = new Date(`${filters.searchDate}T12:00:00`);
        rideDateFilter.$lte = new Date(`${filters.searchDate}T16:59:59`);
      } else if (filters.timeWindow === 'evening') {
        rideDateFilter.$gte = new Date(`${filters.searchDate}T17:00:00`);
        rideDateFilter.$lte = new Date(`${filters.searchDate}T22:59:59`);
      }
    }
  }

  const geoNearQuery = {
    driver: { $ne: userId },
    dateTime: rideDateFilter,
  };

  if (filters.vehicleType) {
    geoNearQuery.vehicleType = filters.vehicleType;
  }
  if (filters.maxPrice > 0) {
    geoNearQuery.pricePerSeat = { $lte: filters.maxPrice };
  }

  const nearbyByPickup = await Ride.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [startLongitude, startLatitude] },
        distanceField: 'pickupDistanceMeters',
        spherical: true,
        maxDistance: nearDistanceMeters || DEFAULT_NEAR_DISTANCE_METERS,
        key: 'startLocation',
        query: geoNearQuery,
      },
    },
    { $sort: { pickupDistanceMeters: 1, dateTime: 1 } },
  ]);

  const withDropDistance = nearbyByPickup
    .map((ride) => {
      const endCoords = ride.endLocation?.coordinates || ride.dropLocation?.coordinates;
      if (!Array.isArray(endCoords) || endCoords.length !== 2) return null;
      const endDistanceKm = haversineKm([endLongitude, endLatitude], endCoords);
      return { ...ride, endDistanceKm };
    })
    .filter(Boolean)
    .filter((ride) => ride.endDistanceKm <= nearDistanceMeters / 1000);

  const rideIds = withDropDistance.map((ride) => ride._id);
  const rideDistanceMap = new Map(
    withDropDistance.map((ride) => [
      String(ride._id),
      {
        pickupDistanceKm: Number((Number(ride.pickupDistanceMeters || 0) / 1000).toFixed(2)),
        endDistanceKm: Number(Number(ride.endDistanceKm || 0).toFixed(2)),
      },
    ])
  );

  const rides = await Ride.find({ _id: { $in: rideIds } }).populate(
    'driver',
    'name email phone interests education workDomain workType bio travelFrequency smokingPreference conversationStyle gender genderPreference age ageRange travelPurpose averageRating'
  );
  const ridesById = new Map(rides.map((ride) => [String(ride._id), ride]));
  const orderedRides = rideIds.map((id) => ridesById.get(String(id))).filter(Boolean);

  const passengerRoute = [[startLongitude, startLatitude], ...passengerStops, [endLongitude, endLatitude]];
  const passengerDistanceKm = haversineKm([startLongitude, startLatitude], [endLongitude, endLatitude]);

  const withCompatibility = orderedRides
    .map((ride) => {
      const metrics = rideDistanceMap.get(String(ride._id)) || { pickupDistanceKm: 0, endDistanceKm: 0 };
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
          startProximityKm: metrics.pickupDistanceKm,
          endProximityKm: metrics.endDistanceKm,
          timeDeltaMinutes: Math.round(timeDeltaMinutes),
        },
      };
    })
    .filter((ride) => {
      if (filters.minCompatibilityScore && ride.compatibility < filters.minCompatibilityScore) return false;
      if (
        ride.genderPreference &&
        ride.genderPreference !== 'any' &&
        String(requester.gender || '') &&
        String(ride.genderPreference) !== String(requester.gender)
      ) {
        return false;
      }
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
      if ((a.searchMetrics?.startProximityKm || 0) !== (b.searchMetrics?.startProximityKm || 0)) {
        return (a.searchMetrics?.startProximityKm || 0) - (b.searchMetrics?.startProximityKm || 0);
      }
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
    const {
      startLocation,
      endLocation,
      stops = [],
      date,
      time,
      dateTime,
      vehicleType,
      seatsAvailable,
      pricePerSeat,
      luggageAllowed = false,
      genderPreference = 'any',
      musicPreference = [],
      allowPreRideChat = true,
      totalFuelCost = 0,
      tollCharges = 0,
      distanceKm = 0,
    } = req.body;

    const computedDateTime =
      dateTime ||
      (() => {
        if (!date || !time) return null;
        const parsed = new Date(`${date}T${time}:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      })();

    if (!computedDateTime) {
      return res.status(400).json({ message: 'date and time are required' });
    }

    const ride = await Ride.create({
      driver: req.user.id,
      startLocation,
      endLocation,
      pickupLocation: startLocation,
      dropLocation: endLocation,
      stops,
      date: date || new Date(computedDateTime).toISOString().slice(0, 10),
      time: time || new Date(computedDateTime).toISOString().slice(11, 16),
      dateTime: computedDateTime,
      vehicleType,
      seatsAvailable,
      pricePerSeat,
      luggageAllowed,
      genderPreference,
      musicPreference,
      allowPreRideChat,
      totalFuelCost,
      tollCharges,
      distanceKm,
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
    return res.status(500).json({ success: false, message: error.message });
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
