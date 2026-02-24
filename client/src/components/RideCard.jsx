import CompatibilityScore from './CompatibilityScore';
import FareSplitCalculator from './FareSplitCalculator';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
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

export default function RideCard({ ride, onRequest }) {
  const startCoords = ride?.startLocation?.coordinates;
  const endCoords = ride?.endLocation?.coordinates;
  const hasMapPoints =
    Array.isArray(startCoords) &&
    startCoords.length === 2 &&
    Array.isArray(endCoords) &&
    endCoords.length === 2 &&
    [startCoords[0], startCoords[1], endCoords[0], endCoords[1]].every((value) => Number.isFinite(Number(value)));

  const start = hasMapPoints ? { lat: Number(startCoords[1]), lng: Number(startCoords[0]) } : null;
  const end = hasMapPoints ? { lat: Number(endCoords[1]), lng: Number(endCoords[0]) } : null;
  const center = hasMapPoints
    ? [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2]
    : [20.5937, 78.9629];

  return (
    <article className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
      <h3 className="text-2xl font-bold">{ride.startLocation.name} to {ride.endLocation.name}</h3>
      <p className="text-slate-600">Driver: {ride.driver.name} Rating {ride.driverRating?.toFixed?.(1) || '0.0'}</p>
      <p className="text-slate-600">Vehicle: {ride.vehicleType} | Seats: {ride.seatsAvailable}</p>
      <p className="text-slate-600">
        Date: {ride.date || (ride.dateTime ? new Date(ride.dateTime).toISOString().slice(0, 10) : '-')} | Time:{' '}
        {ride.time || (ride.dateTime ? new Date(ride.dateTime).toISOString().slice(11, 16) : '-')}
      </p>
      <p className="text-slate-600">
        Price/seat: {Number.isFinite(Number(ride.pricePerSeat)) ? `INR ${ride.pricePerSeat}` : '-'} | Luggage:{' '}
        {ride.luggageAllowed ? 'Yes' : 'No'}
      </p>
      <p className="text-slate-600">
        Music: {Array.isArray(ride.musicPreference) && ride.musicPreference.length ? ride.musicPreference.join(', ') : 'No preference'}
      </p>
      <p className="text-slate-600">
        Route overlap: <b>{ride.routeOverlap?.overlapPercent || 0}%</b> | Shared ~
        {ride.routeOverlap?.estimatedSharedDistanceKm || 0} km
      </p>

      {hasMapPoints && (
        <div className="h-[200px] w-full rounded-xl overflow-hidden border border-slate-200">
          <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[start.lat, start.lng]} />
            <Marker position={[end.lat, end.lng]} />
            <Polyline
              positions={[
                [start.lat, start.lng],
                [end.lat, end.lng],
              ]}
              pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8 }}
            />
          </MapContainer>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 gap-2">
        <CompatibilityScore score={ride.compatibility} reasons={ride.compatibilityReasons} />
        <button className="primary-btn py-2 px-5 text-sm" onClick={() => onRequest(ride._id)}>
          Send Request
        </button>
      </div>
      <FareSplitCalculator rideId={ride._id} />
    </article>
  );
}
