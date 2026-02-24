import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import LocationPicker from '../components/LocationPicker';

const VEHICLE_OPTIONS = ['Car', 'Bike', 'SUV'];
const SEAT_OPTIONS = [1, 2, 3, 4, 5, 6];
const MUSIC_OPTIONS = ['Pop', 'Classical', 'Bollywood', 'Rock', 'Jazz', 'Hip Hop', 'EDM', 'No Preference'];
const PRICE_PER_KM_BY_VEHICLE = { Bike: 8, Car: 12, SUV: 16 };

function isValidLatLng(location) {
  return Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng));
}

function haversineKm(a, b) {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every((value) => Number.isFinite(value))) return 0;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const sLat1 = toRadians(lat1);
  const sLat2 = toRadians(lat2);
  const earthRadiusKm = 6371;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(sLat1) * Math.cos(sLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return Number((2 * earthRadiusKm * Math.asin(Math.sqrt(h))).toFixed(2));
}

export default function PostRide() {
  const [startLocation, setStartLocation] = useState({});
  const [endLocation, setEndLocation] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: '',
    time: '',
    vehicleType: 'Car',
    seatsAvailable: '1',
    luggageAllowed: true,
    pricePerSeat: '',
    genderPreference: 'any',
    allowPreRideChat: true,
    musicPreference: [],
  });

  const hasCoordinates = isValidLatLng(startLocation) && isValidLatLng(endLocation);
  const distanceKm = useMemo(() => haversineKm(startLocation, endLocation), [startLocation, endLocation]);
  const etaMinutes = useMemo(() => (distanceKm ? Math.max(1, Math.round(distanceKm * 2.2)) : 0), [distanceKm]);
  const estimatedFare = useMemo(() => {
    if (!distanceKm) return 0;
    const perKm = PRICE_PER_KM_BY_VEHICLE[form.vehicleType] || PRICE_PER_KM_BY_VEHICLE.Car;
    return Number((distanceKm * perKm).toFixed(0));
  }, [distanceKm, form.vehicleType]);

  const canPost = Boolean(
    hasCoordinates && form.date && form.time && Number(form.pricePerSeat) > 0 && !submitting
  );

  const toggleMusicPreference = (genre) => {
    setForm((prev) => {
      const exists = prev.musicPreference.includes(genre);
      return {
        ...prev,
        musicPreference: exists
          ? prev.musicPreference.filter((entry) => entry !== genre)
          : [...prev.musicPreference, genre],
      };
    });
  };

  const autoCalculatePrice = () => {
    if (!estimatedFare) return;
    setForm((prev) => ({ ...prev, pricePerSeat: String(estimatedFare) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canPost) return;

    try {
      setSubmitting(true);
      setError('');
      setMessage('');

      await api.post('/rides', {
        startLocation: {
          type: 'Point',
          name: startLocation.formattedAddress || startLocation.address || 'Pickup',
          coordinates: [Number(startLocation.lng), Number(startLocation.lat)],
        },
        endLocation: {
          type: 'Point',
          name: endLocation.formattedAddress || endLocation.address || 'Drop',
          coordinates: [Number(endLocation.lng), Number(endLocation.lat)],
        },
        date: form.date,
        time: form.time,
        dateTime: `${form.date}T${form.time}`,
        vehicleType: form.vehicleType,
        seatsAvailable: Number(form.seatsAvailable),
        pricePerSeat: Number(form.pricePerSeat),
        luggageAllowed: Boolean(form.luggageAllowed),
        genderPreference: form.genderPreference,
        musicPreference: form.musicPreference,
        allowPreRideChat: Boolean(form.allowPreRideChat),
        distanceKm: Number(distanceKm || 0),
      });

      setMessage('Ride posted successfully');
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Failed to post ride');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-700 font-medium">
        Back
      </Link>

      <form onSubmit={submit} className="glass-card p-7 space-y-6">
        <header>
          <h2 className="text-5xl font-extrabold">Post a Ride</h2>
          <p className="text-xl text-slate-500 mt-1">Create a complete ride listing with route, timing, and preferences.</p>
        </header>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">Route Selection</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <LocationPicker
              label="Pickup location"
              placeholder="Search pickup address"
              onLocationSelect={setStartLocation}
              initialLocation={startLocation}
            />
            <LocationPicker
              label="Drop location"
              placeholder="Search drop address"
              onLocationSelect={setEndLocation}
              initialLocation={endLocation}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">Date and Time</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Ride date</label>
              <input
                className="soft-input"
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Departure time</label>
              <input
                className="soft-input"
                type="time"
                value={form.time}
                onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">Vehicle Information</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Vehicle type</label>
              <select
                className="soft-input"
                value={form.vehicleType}
                onChange={(e) => setForm((prev) => ({ ...prev, vehicleType: e.target.value }))}
              >
                {VEHICLE_OPTIONS.map((vehicle) => (
                  <option key={vehicle} value={vehicle}>
                    {vehicle}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Available seats</label>
              <select
                className="soft-input"
                value={form.seatsAvailable}
                onChange={(e) => setForm((prev) => ({ ...prev, seatsAvailable: e.target.value }))}
              >
                {SEAT_OPTIONS.map((seat) => (
                  <option key={seat} value={seat}>
                    {seat}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Luggage allowed</label>
              <select
                className="soft-input"
                value={form.luggageAllowed ? 'yes' : 'no'}
                onChange={(e) => setForm((prev) => ({ ...prev, luggageAllowed: e.target.value === 'yes' }))}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">Pricing</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-[1fr_auto] gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Price per seat (INR)</label>
              <input
                className="soft-input"
                type="number"
                min="1"
                step="1"
                placeholder="Enter fare per seat"
                value={form.pricePerSeat}
                onChange={(e) => setForm((prev) => ({ ...prev, pricePerSeat: e.target.value }))}
                required
              />
            </div>
            <button
              type="button"
              onClick={autoCalculatePrice}
              className="px-4 py-2 rounded-full border border-slate-300 bg-slate-50 hover:bg-slate-100"
              disabled={!distanceKm}
            >
              Auto-calculate from distance
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">Compatibility Preferences</h3>
          <div className="rounded-3xl border border-slate-300 p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Music preference</label>
              <div className="flex flex-wrap gap-2">
                {MUSIC_OPTIONS.map((genre) => {
                  const selected = form.musicPreference.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleMusicPreference(genre)}
                      className={`px-3 py-1 rounded-full border text-sm ${
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Gender preference</label>
                <select
                  className="soft-input"
                  value={form.genderPreference}
                  onChange={(e) => setForm((prev) => ({ ...prev, genderPreference: e.target.value }))}
                >
                  <option value="any">Any</option>
                  <option value="male">Male only</option>
                  <option value="female">Female only</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Allow pre-ride chat</label>
                <select
                  className="soft-input"
                  value={form.allowPreRideChat ? 'yes' : 'no'}
                  onChange={(e) => setForm((prev) => ({ ...prev, allowPreRideChat: e.target.value === 'yes' }))}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold mb-1">Trip Summary</p>
          <p>{(startLocation.formattedAddress || 'Pickup')} to {(endLocation.formattedAddress || 'Drop')}</p>
          <p>Distance: {distanceKm ? `${distanceKm} km` : '-'}</p>
          <p>ETA: {etaMinutes ? `${etaMinutes} min` : '-'}</p>
          <p>Estimated fare per seat: {estimatedFare ? `INR ${estimatedFare}` : '-'}</p>
        </section>

        {message && <p className="text-green-600 font-medium">{message}</p>}
        {error && <p className="text-red-600 font-medium">{error}</p>}

        <div className="flex gap-4">
          <button className="primary-btn flex-1 disabled:opacity-60" disabled={!canPost}>
            {submitting ? 'Posting...' : 'Post Ride'}
          </button>
          <Link to="/dashboard" className="px-8 py-3 rounded-full border border-slate-300 bg-slate-100 font-medium">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
