import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const defaultCenter = { lat: 20, lng: 78 };

function isValidLatLng(location) {
  return Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng));
}

function haversineKm(a, b) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(Number(b.lat) - Number(a.lat));
  const dLng = toRadians(Number(b.lng) - Number(a.lng));
  const lat1 = toRadians(Number(a.lat));
  const lat2 = toRadians(Number(b.lat));
  const earthRadiusKm = 6371;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return Number((2 * earthRadiusKm * Math.asin(Math.sqrt(h))).toFixed(2));
}

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, points]);

  return null;
}

export default function LiveMap({
  pickup = null,
  drop = null,
  driverPosition = null,
  passengerPosition = null,
  selectedRouteIndex = 0,
  onRoutesChange,
  onRouteSelect,
  nearbyDrivers = [],
  className = '',
}) {
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCurrentLocation(defaultCenter);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocation({ lat: Number(pos.coords.latitude), lng: Number(pos.coords.longitude) });
      },
      () => setCurrentLocation(defaultCenter),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  const pickupPoint = useMemo(
    () =>
      Number.isFinite(Number(pickup?.lat)) && Number.isFinite(Number(pickup?.lng))
        ? { lat: Number(pickup.lat), lng: Number(pickup.lng) }
        : null,
    [pickup]
  );
  const dropPoint = useMemo(
    () =>
      Number.isFinite(Number(drop?.lat)) && Number.isFinite(Number(drop?.lng))
        ? { lat: Number(drop.lat), lng: Number(drop.lng) }
        : null,
    [drop]
  );
  const driverPoint = useMemo(
    () =>
      Array.isArray(driverPosition) && driverPosition.length === 2
        ? { lat: Number(driverPosition[0]), lng: Number(driverPosition[1]) }
        : null,
    [driverPosition]
  );
  const passengerPoint = useMemo(
    () =>
      Array.isArray(passengerPosition) && passengerPosition.length === 2
        ? { lat: Number(passengerPosition[0]), lng: Number(passengerPosition[1]) }
        : null,
    [passengerPosition]
  );

  const pointsForBounds = useMemo(
    () => [pickupPoint, dropPoint, driverPoint, passengerPoint].filter(Boolean),
    [pickupPoint, dropPoint, driverPoint, passengerPoint]
  );
  const mapCenter = useMemo(() => {
    if (isValidLatLng(pickupPoint)) return pickupPoint;
    if (isValidLatLng(dropPoint)) return dropPoint;
    if (isValidLatLng(driverPoint)) return driverPoint;
    if (isValidLatLng(passengerPoint)) return passengerPoint;
    if (isValidLatLng(currentLocation)) return currentLocation;
    return defaultCenter;
  }, [pickupPoint, dropPoint, driverPoint, passengerPoint, currentLocation]);

  const routes = useMemo(() => {
    if (!pickupPoint || !dropPoint) return [];
    const distanceKm = haversineKm(pickupPoint, dropPoint);
    const durationMinutes = Math.max(1, Math.round(distanceKm * 2.2));
    return [
      {
        polyline: [pickupPoint, dropPoint],
        distanceKm,
        durationMinutes,
        distanceText: `${distanceKm} km`,
        durationText: `${durationMinutes} min`,
      },
    ];
  }, [pickupPoint, dropPoint]);

  useEffect(() => {
    onRoutesChange?.(routes);
  }, [onRoutesChange, routes]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-slate-300">
        {isValidLatLng(mapCenter) && (
          <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={12} style={{ width: '100%', height: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds points={pointsForBounds} />

          {pickupPoint && <Marker position={[pickupPoint.lat, pickupPoint.lng]} />}
          {dropPoint && <Marker position={[dropPoint.lat, dropPoint.lng]} />}
          {driverPoint && <Marker position={[driverPoint.lat, driverPoint.lng]} />}
          {passengerPoint && <Marker position={[passengerPoint.lat, passengerPoint.lng]} />}

          {routes.map((route, index) => (
            <Polyline
              key={`route-${index}`}
              positions={route.polyline.map((point) => [point.lat, point.lng])}
              eventHandlers={{ click: () => onRouteSelect?.(index) }}
              pathOptions={{
                color: index === selectedRouteIndex ? '#1d4ed8' : '#64748b',
                opacity: index === selectedRouteIndex ? 0.95 : 0.45,
                weight: index === selectedRouteIndex ? 6 : 4,
              }}
            />
          ))}

          {driverPoint && passengerPoint && !routes.length && (
            <Polyline
              positions={[
                [driverPoint.lat, driverPoint.lng],
                [passengerPoint.lat, passengerPoint.lng],
              ]}
              pathOptions={{ color: '#0f172a', opacity: 0.7, weight: 4 }}
            />
          )}

          {nearbyDrivers
            .filter((driver) => Number.isFinite(Number(driver.lat)) && Number.isFinite(Number(driver.lng)))
            .map((driver) => (
              <Marker
                key={driver.driverId || `${driver.lat}-${driver.lng}`}
                position={[Number(driver.lat), Number(driver.lng)]}
              />
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
