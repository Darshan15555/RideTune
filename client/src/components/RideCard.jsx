import CompatibilityScore from './CompatibilityScore';
import FareSplitCalculator from './FareSplitCalculator';

export default function RideCard({ ride, onRequest }) {
  return (
    <article className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
      <h3 className="text-2xl font-bold">{ride.startLocation.name} → {ride.endLocation.name}</h3>
      <p className="text-slate-600">Driver: {ride.driver.name} ⭐ {ride.driverRating?.toFixed?.(1) || '0.0'}</p>
      <p className="text-slate-600">Vehicle: {ride.vehicleType} | Seats: {ride.seatsAvailable}</p>
      <p className="text-slate-600">Route overlap: <b>{ride.routeOverlap?.overlapPercent || 0}%</b> · Shared ~{ride.routeOverlap?.estimatedSharedDistanceKm || 0} km</p>
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
