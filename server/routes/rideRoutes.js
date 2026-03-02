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
const DEFAULT_FUEL_PRICE = {
  PETROL: 102,
  DIESEL: 90,
  EV: 12,
};

function buildRoutePoints(ride) {
  return [
    ride.startLocation?.coordinates,
    ...(ride.stops || []).map((stop) => stop.coordinates),
    ride.endLocation?.coordinates,
  ].filter(Boolean);
}

function nearestDistanceKmToRoute(point = [], route = []) {
  if (!Array.isArray(point) || point.length !== 2 || !Array.isArray(route) || !route.length) return Infinity;
  let min = Infinity;
  for (const candidate of route) {
    if (!Array.isArray(candidate) || candidate.length !== 2) continue;
    const distance = haversineKm(point, candidate);
    if (distance < min) min = distance;
  }
  return min;
}

function vectorFromPoints([lng1, lat1], [lng2, lat2]) {
  return [Number(lng2) - Number(lng1), Number(lat2) - Number(lat1)];
}

function vectorMagnitude([x, y]) {
  return Math.sqrt(x * x + y * y);
}

function angleBetweenVectorsDeg(v1 = [0, 0], v2 = [0, 0]) {
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const mag = vectorMagnitude(v1) * vectorMagnitude(v2);
  if (!mag) return 180;
  const cosTheta = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

async function expirePastRides() {
  await Ride.updateMany(
    { dateTime: { $lt: new Date() }, status: { $in: ['ACTIVE', 'FULL'] } },
    { $set: { status: 'COMPLETED' } }
  );
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
    includeOwnRides:
      body.includeOwnRides === true || String(body.includeOwnRides || '').toLowerCase() === 'true',
    vehicleType: body.vehicleType || '',
    genderPreference: body.genderPreference || '',
    minCompatibilityScore: Number.isFinite(Number(body.minCompatibility ?? body.minCompatibilityScore))
      ? Number(body.minCompatibility ?? body.minCompatibilityScore)
      : 0,
    maxPrice: Number.isFinite(Number(body.maxPrice)) ? Number(body.maxPrice) : 0,
    searchDate: body.date || '',
    timeWindow: body.timeWindow || '',
    proximityKm: Number.isFinite(Number(body.proximityKm)) ? Number(body.proximityKm) : null,
    maxDistanceMeters: Number.isFinite(Number(body.maxDistanceMeters)) ? Number(body.maxDistanceMeters) : 200000,
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
  await expirePastRides();
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

  const nearDistanceMeters =
    Number(filters.proximityKm) > 0
      ? Number(filters.proximityKm) * 1000
      : Number(filters.maxDistanceMeters) > 0
        ? Number(filters.maxDistanceMeters)
        : 200000;
  console.log('Using pickup:', startLongitude, startLatitude);

  const geoNearQuery = {
    seatsAvailable: { $gt: 0 },
    status: 'ACTIVE',
  };
  if (!filters.includeOwnRides) {
    geoNearQuery.driver = { $ne: userId };
  }

  if (filters.searchDate) {
    const startOfDay = new Date(`${filters.searchDate}T00:00:00`);
    const endOfDay = new Date(`${filters.searchDate}T23:59:59.999`);
    if (!Number.isNaN(startOfDay.getTime()) && !Number.isNaN(endOfDay.getTime())) {
      geoNearQuery.dateTime = { $gte: startOfDay, $lte: endOfDay };
      if (filters.timeWindow === 'morning') {
        geoNearQuery.dateTime = {
          $gte: new Date(`${filters.searchDate}T05:00:00`),
          $lte: new Date(`${filters.searchDate}T11:59:59.999`),
        };
      } else if (filters.timeWindow === 'afternoon') {
        geoNearQuery.dateTime = {
          $gte: new Date(`${filters.searchDate}T12:00:00`),
          $lte: new Date(`${filters.searchDate}T16:59:59.999`),
        };
      } else if (filters.timeWindow === 'evening') {
        geoNearQuery.dateTime = {
          $gte: new Date(`${filters.searchDate}T17:00:00`),
          $lte: new Date(`${filters.searchDate}T22:59:59.999`),
        };
      }
    }
  }

  if (filters.vehicleType) {
    geoNearQuery.vehicleType = filters.vehicleType;
  }
  if (filters.maxPrice > 0) {
    geoNearQuery.pricePerSeat = { $lte: filters.maxPrice };
  }
  geoNearQuery.compatibilityScore = { $gte: Number(filters.minCompatibilityScore || 0) };

  console.log('[ride-search] filters:', {
    userId: String(userId),
    vehicleType: filters.vehicleType,
    genderPreference: filters.genderPreference,
    minCompatibilityScore: filters.minCompatibilityScore,
    maxPrice: filters.maxPrice,
    searchDate: filters.searchDate,
    timeWindow: filters.timeWindow,
    nearDistanceMeters,
    includeOwnRides: filters.includeOwnRides,
    geoNearQuery,
  });

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

  console.log('[ride-search] pickup matches:', nearbyByPickup.length);

  let candidateRides = nearbyByPickup;
  const usedGeoNearResults = nearbyByPickup.length > 0;
  const rideDistanceMap = new Map();

  for (const ride of nearbyByPickup) {
    rideDistanceMap.set(String(ride._id), {
      pickupDistanceKm: Number((Number(ride.pickupDistanceMeters || 0) / 1000).toFixed(2)),
      endDistanceKm: 0,
    });
  }

  if (!candidateRides.length) {
    console.log('[ride-search] geoNear returned 0 rides, applying fallback query');
    const fallbackRides = await Ride.find(geoNearQuery)
      .select('_id startLocation dateTime')
      .sort({ dateTime: 1 })
      .lean();

    candidateRides = fallbackRides.map((ride) => {
      const pickupDistanceKm = haversineKm(
        [startLongitude, startLatitude],
        ride.startLocation?.coordinates || []
      );
      rideDistanceMap.set(String(ride._id), {
        pickupDistanceKm: Number.isFinite(pickupDistanceKm) ? Number(pickupDistanceKm.toFixed(2)) : Infinity,
        endDistanceKm: 0,
      });
      return ride;
    });
  }

  const rideIds = candidateRides.map((ride) => ride._id);

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
      const driverRoutePoints = buildRoutePoints(ride);
      const pickupDeviationDistance = nearestDistanceKmToRoute([startLongitude, startLatitude], driverRoutePoints);
      const dropDeviationDistance = nearestDistanceKmToRoute([endLongitude, endLatitude], driverRoutePoints);
      const driverDirection = vectorFromPoints(
        ride.startLocation?.coordinates || [0, 0],
        ride.endLocation?.coordinates || [0, 0]
      );
      const riderDirection = vectorFromPoints(
        [startLongitude, startLatitude],
        [endLongitude, endLatitude]
      );
      const directionAngleDiff = angleBetweenVectorsDeg(driverDirection, riderDirection);
      const sameDirection = directionAngleDiff < 45;
      const overlapDistance = Number(routeOverlap.estimatedSharedDistanceKm || 0);
      const detourDistance = Number(
        Math.max(0, passengerDistanceKm - Number(routeOverlap.estimatedSharedDistanceKm || 0)).toFixed(2)
      );
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
        overlapPercentage: Number(routeOverlap.overlapPercent || 0),
        pickupDeviationDistance: Number(pickupDeviationDistance.toFixed(2)),
        dropDeviationDistance: Number(dropDeviationDistance.toFixed(2)),
        directionAngleDiff: Number(directionAngleDiff.toFixed(2)),
        sameDirection,
        overlapDistance: Number(overlapDistance.toFixed(2)),
        detourDistance,
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
      const pickupOk = Number(ride.pickupDeviationDistance || Infinity) <= 20;
      const dropCorridorOk = Number(ride.dropDeviationDistance || Infinity) <= 15;
      const directionOk = Boolean(ride.sameDirection);
      const overlapOk = Number(ride.overlapPercentage || 0) >= 30;
      if (
        filters.genderPreference &&
        String(filters.genderPreference).toLowerCase() !== 'any' &&
        String(ride.driver?.gender || '') !== String(filters.genderPreference)
      ) {
        return false;
      }

      console.log('Ride:', String(ride._id));
      console.log('Overlap %:', Number(ride.overlapPercentage || 0));
      console.log('Pickup distance:', Number(ride.pickupDeviationDistance || 0));
      console.log('Drop corridor distance:', Number(ride.dropDeviationDistance || 0));

      if (!usedGeoNearResults) {
        return overlapOk;
      }

      return pickupOk && dropCorridorOk && directionOk && overlapOk;
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

  console.log('[ride-search] final rides:', withCompatibility.length);

  return { rides: withCompatibility, nearbyDrivers };
}

router.post('/', authMiddleware, async (req, res) => {
  try {
    await expirePastRides();
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
      fuelType = 'PETROL',
      mileage = 15,
      fuelPrice,
      pricingMarginPercent = 5,
      useSuggestedPrice = true,
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
      ...(() => {
        const normalizedDistance = Number(distanceKm || 0);
        const normalizedMileage = Math.max(1, Number(mileage || 1));
        const normalizedFuelPrice = Number(fuelPrice || DEFAULT_FUEL_PRICE[String(fuelType).toUpperCase()] || DEFAULT_FUEL_PRICE.PETROL);
        const marginFactor = 1 + Math.max(0, Math.min(10, Number(pricingMarginPercent || 0))) / 100;
        const normalizedSeats = Math.max(1, Number(seatsAvailable || 1));
        const fuelCost = (normalizedDistance / normalizedMileage) * normalizedFuelPrice;
        const suggestedPricePerSeat = Number(((fuelCost * marginFactor) / normalizedSeats).toFixed(2));
        const finalPricePerSeat = useSuggestedPrice
          ? suggestedPricePerSeat
          : Number(pricePerSeat || suggestedPricePerSeat);

        return {
          fuelType: String(fuelType).toUpperCase(),
          mileage: normalizedMileage,
          fuelPrice: normalizedFuelPrice,
          autoCalculatedPricePerSeat: suggestedPricePerSeat,
          pricingMarginPercent: Math.max(0, Math.min(10, Number(pricingMarginPercent || 0))),
          pricePerSeat: finalPricePerSeat,
        };
      })(),
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
      status: Number(seatsAvailable) === 0 ? 'FULL' : 'ACTIVE',
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

router.get('/my-posted', authMiddleware, async (req, res) => {
  try {
    await expirePastRides();
    const rides = await Ride.find({ driver: req.user.id }).sort({ dateTime: -1 });
    const updates = [];
    for (const ride of rides) {
      if (ride.seatsAvailable === 0 && ride.status === 'ACTIVE') {
        ride.status = 'FULL';
        updates.push(ride.save());
      }
    }
    if (updates.length) await Promise.all(updates);
    return res.json(rides);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['ACTIVE', 'FULL', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (String(ride.driver) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only driver can update ride status' });
    }

    ride.status = status;
    if (status === 'FULL') ride.seatsAvailable = 0;
    if (status === 'ACTIVE' && ride.seatsAvailable === 0) ride.seatsAvailable = 1;
    await ride.save();

    return res.json(ride);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/search/proximity', authMiddleware, rateLimitRideSearch, async (req, res) => {
  try {
    const appliedFilters = {
      ...req.body,
      includeOwnRides:
        req.query.includeOwnRides ??
        req.body.includeOwnRides ??
        false,
      maxDistanceMeters: req.query.maxDistanceMeters ?? req.body.maxDistanceMeters ?? 200000,
      minCompatibility: req.query.minCompatibility ?? req.body.minCompatibility ?? req.body.minCompatibilityScore ?? 0,
    };
    console.log('User:', req.user._id || req.user.id);
    console.log('Filters:', appliedFilters);

    const result = await searchRidesForUser(req.user.id, appliedFilters);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    console.log('Found rides:', (result.rides || []).length);
    if (!result.rides?.length) {
      return res.json({
        success: true,
        rides: [],
        nearbyDrivers: [],
        message: 'No rides match current filters',
      });
    }
    const formattedRides = result.rides.map((ride) => ({
      ride,
      overlapPercentage: Number(ride.overlapPercentage || 0),
      pickupDeviationDistance: Number(ride.pickupDeviationDistance || 0),
      dropDeviationDistance: Number(ride.dropDeviationDistance || 0),
    }));
    return res.json({
      success: true,
      rides: formattedRides,
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
  const acceptedCount = await Request.countDocuments({ ride: ride._id, status: 'ACCEPTED' });
  const passengers = Math.max(1, acceptedCount + 1);
  const totalCost = Number(totalFuelCost) + Number(tollCharges);

  return res.json({
    totalCost,
    passengers,
    perPassenger: Number((totalCost / passengers).toFixed(2)),
  });
});

router.get('/heatmap/demand', authMiddleware, async (_req, res) => {
  const pending = await Request.find({ status: 'PENDING' }).populate('ride', 'startLocation');
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
