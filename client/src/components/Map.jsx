import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
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

function MapClickHandler({ activeField, onMapLocationSelect }) {
  useMapEvents({
    click(event) {
      const lat = Number(event.latlng?.lat);
      const lng = Number(event.latlng?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      onMapLocationSelect?.(activeField, {
        lat,
        lng,
        formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
    },
  });

  return null;
}

export default function Map({ pickup, drop, activeField, onMapLocationSelect, onRouteSummary }) {
  const [polylinePath, setPolylinePath] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const safePickup = useMemo(
    () => (isValidLatLng(pickup) ? { lat: Number(pickup.lat), lng: Number(pickup.lng) } : null),
    [pickup]
  );
  const safeDrop = useMemo(
    () => (isValidLatLng(drop) ? { lat: Number(drop.lat), lng: Number(drop.lng) } : null),
    [drop]
  );
  const center = useMemo(() => {
    if (isValidLatLng(safePickup)) return safePickup;
    if (isValidLatLng(safeDrop)) return safeDrop;
    if (isValidLatLng(currentLocation)) return currentLocation;
    return defaultCenter;
  }, [safePickup, safeDrop, currentLocation]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCurrentLocation(defaultCenter);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => setCurrentLocation({ lat: Number(pos.coords.latitude), lng: Number(pos.coords.longitude) }),
      () => setCurrentLocation(defaultCenter),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (!safePickup || !safeDrop) {
      setPolylinePath([]);
      onRouteSummary?.(null);
      return;
    }

    const distanceKm = haversineKm(safePickup, safeDrop);
    const etaMinutes = Math.max(1, Math.round(distanceKm * 2.2));
    const nextPath = [safePickup, safeDrop];
    setPolylinePath(nextPath);
    onRouteSummary?.({ polyline: nextPath, distanceKm, etaMinutes });
  }, [safePickup?.lat, safePickup?.lng, safeDrop?.lat, safeDrop?.lng, onRouteSummary]);

  return (
    <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-slate-300">
      {isValidLatLng(center) && (
        <MapContainer center={[center.lat, center.lng]} zoom={12} style={{ width: '100%', height: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler activeField={activeField} onMapLocationSelect={onMapLocationSelect} />
          {safePickup && <Marker position={[safePickup.lat, safePickup.lng]} />}
          {safeDrop && <Marker position={[safeDrop.lat, safeDrop.lng]} />}
          {polylinePath.length > 0 && (
            <Polyline
              positions={polylinePath.map((point) => [point.lat, point.lng])}
              pathOptions={{ color: '#2563eb', opacity: 0.95, weight: 6 }}
            />
          )}
        </MapContainer>
      )}
    </div>
  );
}
