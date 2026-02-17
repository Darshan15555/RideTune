import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import RideCard from '../components/RideCard';
import LocationPicker from '../components/LocationPicker';
import LiveMap from '../components/LiveMap';
import { getSocket } from '../services/socket';

const initialFilters = {
  maxDetourKm: 20,
  timeFlexMinutes: 30,
  vehicleType: '',
  genderPreference: 'any',
  minCompatibilityScore: 40,
  proximityKm: 10,
  preferredDateTime: '',
};

function midpoint(a, b) {
  if (!a || !b) return null;
  return { lat: (Number(a.lat) + Number(b.lat)) / 2, lng: (Number(a.lng) + Number(b.lng)) / 2 };
}

function estimatedCost(route) {
  if (!route) return 0;
  return Number((route.distanceKm * 4.2).toFixed(2));
}

export default function SearchRide() {
  const [form, setForm] = useState({ startLocation: null, endLocation: null });
  const [filters, setFilters] = useState(initialFilters);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [rides, setRides] = useState([]);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liveStatus, setLiveStatus] = useState('Live search inactive');

  const selectedRoute = routes[selectedRouteIndex] || null;
  const mapCenter = useMemo(() => midpoint(form.startLocation, form.endLocation), [form.startLocation, form.endLocation]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const handleDrivers = (payload) => {
      setNearbyDrivers(payload?.drivers || []);
      setLiveStatus(payload?.drivers?.length ? 'Live driver updates connected' : 'No rides available nearby');
    };
    const handleLiveError = (payload) => setLiveStatus(payload?.message || 'Live updates unavailable');

    socket.on('ride-search-nearby-drivers', handleDrivers);
    socket.on('ride-search-error', handleLiveError);

    return () => {
      socket.off('ride-search-nearby-drivers', handleDrivers);
      socket.off('ride-search-error', handleLiveError);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !mapCenter) return undefined;

    socket.emit('ride-search-subscribe', {
      center: mapCenter,
      radiusKm: Number(filters.proximityKm),
      vehicleType: filters.vehicleType || '',
      genderPreference: filters.genderPreference || 'any',
    });

    return () => {
      socket.emit('ride-search-unsubscribe');
    };
  }, [mapCenter?.lat, mapCenter?.lng, filters.proximityKm, filters.vehicleType, filters.genderPreference]);

  const search = async (event) => {
    event.preventDefault();
    if (!form.startLocation || !form.endLocation) {
      setError('Invalid location. Please choose pickup and drop from suggestions.');
      return;
    }

    setLoading(true);
    setError('');
    setRides([]);

    try {
      const payload = {
        startLocation: { coordinates: [form.startLocation.lng, form.startLocation.lat] },
        endLocation: { coordinates: [form.endLocation.lng, form.endLocation.lat] },
        maxDetourKm: Number(filters.maxDetourKm),
        timeFlexMinutes: Number(filters.timeFlexMinutes),
        vehicleType: filters.vehicleType,
        genderPreference: filters.genderPreference,
        minCompatibilityScore: Number(filters.minCompatibilityScore),
        proximityKm: Number(filters.proximityKm),
        preferredDateTime: filters.preferredDateTime || undefined,
      };

      const { data } = await api.post('/rides/search/proximity', payload);
      setRides(data.rides || []);
      if (Array.isArray(data.nearbyDrivers)) {
        setNearbyDrivers(data.nearbyDrivers);
      }

      if (!data?.rides?.length) {
        setError('No rides available nearby');
      }
    } catch (searchError) {
      setError(searchError?.response?.data?.message || 'Failed to search rides');
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (rideId) => {
    await api.post('/requests', { rideId });
    alert('Request sent');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-700 font-medium">
        Back
      </Link>

      <form onSubmit={search} className="glass-card p-7 space-y-6">
        <header>
          <h2 className="text-5xl font-extrabold">Search Rides</h2>
          <p className="text-xl text-slate-500 mt-1">Real-time matching with live nearby drivers and route options.</p>
        </header>

        <div className="grid md:grid-cols-2 gap-4">
          <LocationPicker
            label="Pickup location"
            placeholder="Pickup address"
            onLocationSelect={(location) => setForm((prev) => ({ ...prev, startLocation: location }))}
            initialLocation={form.startLocation}
          />
          <LocationPicker
            label="Drop location"
            placeholder="Drop address"
            onLocationSelect={(location) => setForm((prev) => ({ ...prev, endLocation: location }))}
            initialLocation={form.endLocation}
          />
        </div>

        <LiveMap
          pickup={form.startLocation}
          drop={form.endLocation}
          selectedRouteIndex={selectedRouteIndex}
          onRouteSelect={setSelectedRouteIndex}
          nearbyDrivers={nearbyDrivers}
          onRoutesChange={(nextRoutes) => {
            setRoutes(nextRoutes);
            setSelectedRouteIndex(0);
          }}
        />

        {!!routes.length && (
          <section className="grid md:grid-cols-3 gap-3">
            {routes.map((route, index) => (
              <button
                key={`search-route-${index}`}
                type="button"
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selectedRouteIndex === index
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
                onClick={() => setSelectedRouteIndex(index)}
              >
                <p className="font-semibold">Route {index + 1}</p>
                <p className="text-sm">Distance: {route.distanceText}</p>
                <p className="text-sm">ETA: {route.durationText}</p>
              </button>
            ))}
          </section>
        )}

        <section className="grid md:grid-cols-5 gap-3">
          <input
            className="soft-input"
            type="number"
            min="1"
            placeholder="Max detour km"
            value={filters.maxDetourKm}
            onChange={(e) => setFilters((prev) => ({ ...prev, maxDetourKm: e.target.value }))}
          />
          <input
            className="soft-input"
            type="number"
            min="0"
            placeholder="Time flex (min)"
            value={filters.timeFlexMinutes}
            onChange={(e) => setFilters((prev) => ({ ...prev, timeFlexMinutes: e.target.value }))}
          />
          <select
            className="soft-input"
            value={filters.vehicleType}
            onChange={(e) => setFilters((prev) => ({ ...prev, vehicleType: e.target.value }))}
          >
            <option value="">Any vehicle</option>
            <option value="Car">Car</option>
            <option value="Bike">Bike</option>
          </select>
          <select
            className="soft-input"
            value={filters.genderPreference}
            onChange={(e) => setFilters((prev) => ({ ...prev, genderPreference: e.target.value }))}
          >
            <option value="any">Any gender</option>
            <option value="male">Male driver</option>
            <option value="female">Female driver</option>
            <option value="other">Other</option>
          </select>
          <input
            className="soft-input"
            type="number"
            min="0"
            max="100"
            placeholder="Min compatibility"
            value={filters.minCompatibilityScore}
            onChange={(e) => setFilters((prev) => ({ ...prev, minCompatibilityScore: e.target.value }))}
          />
        </section>

        <section className="grid md:grid-cols-2 gap-3">
          <input
            className="soft-input"
            type="number"
            min="1"
            placeholder="Nearby radius km"
            value={filters.proximityKm}
            onChange={(e) => setFilters((prev) => ({ ...prev, proximityKm: e.target.value }))}
          />
          <input
            className="soft-input"
            type="datetime-local"
            value={filters.preferredDateTime}
            onChange={(e) => setFilters((prev) => ({ ...prev, preferredDateTime: e.target.value }))}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold mb-1">Route Summary</p>
          <p>
            {(form.startLocation?.formattedAddress || 'Pickup')} to {(form.endLocation?.formattedAddress || 'Drop')}
          </p>
          <p>Distance: {selectedRoute?.distanceText || '-'}</p>
          <p>ETA: {selectedRoute?.durationText || '-'}</p>
          <p>Estimated cost: INR {estimatedCost(selectedRoute)}</p>
          <p className="mt-1 text-xs text-slate-500">{liveStatus}</p>
        </section>

        <button className="primary-btn w-full text-xl" disabled={loading || !form.startLocation || !form.endLocation}>
          {loading ? 'Searching rides...' : 'Find Rides'}
        </button>

        {loading && <p className="text-slate-500 text-sm">Matching riders and fetching nearby drivers...</p>}
        {error && <p className="text-red-600">{error}</p>}
      </form>

      <section className="grid md:grid-cols-2 gap-4">
        {rides.map((ride) => (
          <RideCard key={ride._id} ride={ride} onRequest={sendRequest} />
        ))}
      </section>
    </div>
  );
}
