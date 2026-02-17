export const DEFAULT_NEAR_DISTANCE_METERS = 10000;

const EARTH_RADIUS_KM = 6371;

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

export function haversineKm(pointA = [], pointB = []) {
  if (!Array.isArray(pointA) || !Array.isArray(pointB) || pointA.length !== 2 || pointB.length !== 2) {
    return Infinity;
  }

  const [lon1, lat1] = pointA.map(Number);
  const [lon2, lat2] = pointB.map(Number);

  if ([lon1, lat1, lon2, lat2].some((v) => Number.isNaN(v))) {
    return Infinity;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineMeters(pointA = [], pointB = []) {
  return haversineKm(pointA, pointB) * 1000;
}
