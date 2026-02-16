const EARTH_RADIUS_KM = 6371;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm([lon1, lat1], [lon2, lat2]) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildPathPoints(route = []) {
  return route.filter(
    (point) => Array.isArray(point) && point.length === 2 && point.every((v) => Number.isFinite(Number(v)))
  );
}

function cumulativeDistances(points = []) {
  const distances = [0];
  for (let i = 1; i < points.length; i += 1) {
    distances[i] = distances[i - 1] + haversineKm(points[i - 1], points[i]);
  }
  return distances;
}

function nearestDistance(point, path = []) {
  if (!path.length) return Infinity;
  let min = Infinity;
  for (const candidate of path) {
    min = Math.min(min, haversineKm(point, candidate));
  }
  return min;
}

export function calculateRouteOverlap(passengerRoute = [], driverRoute = [], thresholdKm = 20) {
  const pRoute = buildPathPoints(passengerRoute);
  const dRoute = buildPathPoints(driverRoute);

  if (pRoute.length < 2 || dRoute.length < 2) {
    return { overlapPercent: 0, overlapScore: 0, estimatedSharedDistanceKm: 0 };
  }

  const distances = cumulativeDistances(pRoute);
  const totalDistance = distances[distances.length - 1] || 1;

  let coveredDistance = 0;
  for (let i = 1; i < pRoute.length; i += 1) {
    const prev = pRoute[i - 1];
    const current = pRoute[i];
    const segmentDistance = haversineKm(prev, current);
    const nearCurrent = nearestDistance(current, dRoute) <= thresholdKm;
    const nearPrev = nearestDistance(prev, dRoute) <= thresholdKm;
    if (nearCurrent || nearPrev) {
      coveredDistance += segmentDistance;
    }
  }

  const overlap = Math.max(0, Math.min(1, coveredDistance / totalDistance));

  return {
    overlapPercent: Math.round(overlap * 100),
    overlapScore: overlap,
    estimatedSharedDistanceKm: Number(coveredDistance.toFixed(2)),
  };
}
