import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import RideCard from '../components/RideCard';
import LocationPicker from '../components/LocationPicker';
import LiveMap from '../components/LiveMap';
import { getSocket } from '../services/socket';

const DEFAULT_SEARCH_RADIUS_KM = 15;
const MAX_PRICE_LIMIT = 2000;
const COMPATIBILITY_MAX = 100;
const TIME_WINDOWS = [
  { value: '', label: 'Any time' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

const initialFilters = {
  date: '',
  timeWindow: '',
  maxPrice: 1000,
  vehicleType: '',
  minCompatibilityScore: 50,
  genderPreference: 'any',
};

function isValidLatLng(location) {
  return Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng));
}

function midpoint(a, b) {
  if (!isValidLatLng(a) || !isValidLatLng(b)) return null;
  return { lat: (Number(a.lat) + Number(b.lat)) / 2, lng: (Number(a.lng) + Number(b.lng)) / 2 };
}

function haversineKm(a, b) {
  if (!isValidLatLng(a) || !isValidLatLng(b)) return 0;
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

function estimateFare(distanceKm, vehicleType) {
  if (!distanceKm) return 0;
  const rates = { Bike: 8, Car: 12, SUV: 16 };
  return Number((distanceKm * (rates[vehicleType] || rates.Car)).toFixed(0));
}

export default function SearchRide() {
  const [searchStart, setSearchStart] = useState({});
  const [searchEnd, setSearchEnd] = useState({});
  const [filters, setFilters] = useState(initialFilters);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [rides, setRides] = useState([]);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liveStatus, setLiveStatus] = useState('Live search inactive');

  const hasCoordinates = isValidLatLng(searchStart) && isValidLatLng(searchEnd);
  const mapCenter = useMemo(() => midpoint(searchStart, searchEnd), [searchStart, searchEnd]);
  const selectedRoute = routes[selectedRouteIndex] || null;
  const summaryDistanceKm = useMemo(() => selectedRoute?.distanceKm || haversineKm(searchStart, searchEnd), [selectedRoute, searchStart, searchEnd]);
  const summaryEtaMinutes = useMemo(
    () => (selectedRoute?.durationMinutes ? selectedRoute.durationMinutes : summaryDistanceKm ? Math.max(1, Math.round(summaryDistanceKm * 2.2)) : 0),
    [selectedRoute, summaryDistanceKm]
  );
  const summaryFare = useMemo(() => estimateFare(summaryDistanceKm, filters.vehicleType), [summaryDistanceKm, filters.vehicleType]);

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
      radiusKm: DEFAULT_SEARCH_RADIUS_KM,
      vehicleType: filters.vehicleType || '',
      genderPreference: filters.genderPreference || 'any',
    });

    return () => {
      socket.emit('ride-search-unsubscribe');
    };
  }, [mapCenter?.lat, mapCenter?.lng, filters.vehicleType, filters.genderPreference]);

  const search = async (event) => {
    event.preventDefault();
    if (!hasCoordinates) {
      setError('Please select valid pickup and drop locations.');
      return;
    }

    setLoading(true);
    setError('');
    setRides([]);

    try {
      const payload = {
        startLongitude: Number(searchStart.lng),
        startLatitude: Number(searchStart.lat),
        endLongitude: Number(searchEnd.lng),
        endLatitude: Number(searchEnd.lat),
        startLocation: { coordinates: [Number(searchStart.lng), Number(searchStart.lat)] },
        endLocation: { coordinates: [Number(searchEnd.lng), Number(searchEnd.lat)] },
        date: filters.date || undefined,
        timeWindow: filters.timeWindow || undefined,
        maxPrice: Number(filters.maxPrice),
        vehicleType: filters.vehicleType || '',
        minCompatibilityScore: Number(filters.minCompatibilityScore),
        genderPreference: filters.genderPreference || 'any',
        proximityKm: DEFAULT_SEARCH_RADIUS_KM,
      };

      const { data } = await api.post('/rides/search/proximity', payload);
      const normalizedRides = Array.isArray(data?.rides)
        ? data.rides.map((entry) => entry?.ride || entry).filter(Boolean)
        : [];
      setRides(normalizedRides);
      if (Array.isArray(data.nearbyDrivers)) {
        setNearbyDrivers(data.nearbyDrivers);
      }

      if (!normalizedRides.length) {
        setError('No rides found for your selected filters.');
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
          <p className="text-xl text-slate-500 mt-1">Find practical ride matches based on route, budget, and preferences.</p>
        </header>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">Route</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <LocationPicker
              label="Pickup location"
              placeholder="Pickup address"
              onLocationSelect={setSearchStart}
              initialLocation={searchStart}
            />
            <LocationPicker
              label="Drop location"
              placeholder="Drop address"
              onLocationSelect={setSearchEnd}
              initialLocation={searchEnd}
            />
          </div>
        </section>

        <LiveMap
          pickup={searchStart}
          drop={searchEnd}
          selectedRouteIndex={selectedRouteIndex}
          onRouteSelect={setSelectedRouteIndex}
          nearbyDrivers={nearbyDrivers}
          onRoutesChange={(nextRoutes) => {
            setRoutes(nextRoutes);
            setSelectedRouteIndex(0);
          }}
        />

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">Filters</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Date</label>
              <input
                className="soft-input"
                type="date"
                value={filters.date}
                onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Time window</label>
              <select
                className="soft-input"
                value={filters.timeWindow}
                onChange={(e) => setFilters((prev) => ({ ...prev, timeWindow: e.target.value }))}
              >
                {TIME_WINDOWS.map((window) => (
                  <option key={window.value || 'any'} value={window.value}>
                    {window.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Max price per seat: INR {filters.maxPrice}</label>
              <input
                type="range"
                min="100"
                max={String(MAX_PRICE_LIMIT)}
                step="50"
                value={filters.maxPrice}
                onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: Number(e.target.value) }))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Vehicle type</label>
              <select
                className="soft-input"
                value={filters.vehicleType}
                onChange={(e) => setFilters((prev) => ({ ...prev, vehicleType: e.target.value }))}
              >
                <option value="">Any vehicle</option>
                <option value="Bike">Bike</option>
                <option value="Car">Car</option>
                <option value="SUV">SUV</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Minimum compatibility score: {filters.minCompatibilityScore}
              </label>
              <input
                type="range"
                min="0"
                max={String(COMPATIBILITY_MAX)}
                step="5"
                value={filters.minCompatibilityScore}
                onChange={(e) => setFilters((prev) => ({ ...prev, minCompatibilityScore: Number(e.target.value) }))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Gender preference</label>
              <select
                className="soft-input"
                value={filters.genderPreference}
                onChange={(e) => setFilters((prev) => ({ ...prev, genderPreference: e.target.value }))}
              >
                <option value="any">Any</option>
                <option value="male">Male only</option>
                <option value="female">Female only</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold mb-1">Trip Summary</p>
          <p>{(searchStart?.formattedAddress || 'Pickup')} to {(searchEnd?.formattedAddress || 'Drop')}</p>
          <p>Distance: {summaryDistanceKm ? `${summaryDistanceKm} km` : '-'}</p>
          <p>ETA: {summaryEtaMinutes ? `${summaryEtaMinutes} min` : '-'}</p>
          <p>Estimated fare: {summaryFare ? `INR ${summaryFare}` : '-'}</p>
          <p className="mt-1 text-xs text-slate-500">{liveStatus}</p>
        </section>

        <button className="primary-btn w-full text-xl" disabled={loading || !hasCoordinates}>
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
