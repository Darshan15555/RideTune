import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoadScript } from '@react-google-maps/api';
import api from '../services/api';
import LocationPicker from '../components/LocationPicker';
import Map from '../components/Map';

const libraries = ['places'];

function readAddressComponent(components = [], type) {
  return components.find((entry) => entry.types?.includes(type))?.long_name || '';
}

function formatCityStateCountry(result) {
  const components = result?.address_components || [];
  const city =
    readAddressComponent(components, 'locality') ||
    readAddressComponent(components, 'administrative_area_level_2');
  const state = readAddressComponent(components, 'administrative_area_level_1');
  const country = readAddressComponent(components, 'country');
  return [city, state, country].filter(Boolean).join(', ') || result?.formatted_address || '';
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
  });
}

function reverseGeocode(geocoder, lat, lng) {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== 'OK' || !results?.length) {
        reject(new Error(`Geocoder failed with status: ${status || 'UNKNOWN'}`));
        return;
      }
      resolve(results[0]);
    });
  });
}

function estimateFare(distanceKm, vehicleType) {
  const baseFare = vehicleType === 'Bike' ? 35 : 60;
  const perKm = vehicleType === 'Bike' ? 9 : 14;
  return Number((baseFare + perKm * Number(distanceKm || 0)).toFixed(2));
}

export default function PostRide() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  const [activeField, setActiveField] = useState('pickup');
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [pickupInput, setPickupInput] = useState('');
  const [dropInput, setDropInput] = useState('');
  const [routeSummary, setRouteSummary] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    dateTime: '',
    vehicleType: 'Car',
    seatsAvailable: 1,
    totalFuelCost: 0,
    tollCharges: 0,
  });

  const estimatedFare = useMemo(
    () => estimateFare(routeSummary?.distanceKm, form.vehicleType),
    [routeSummary?.distanceKm, form.vehicleType]
  );

  const hasCoordinates = Boolean(pickup?.lat && pickup?.lng && drop?.lat && drop?.lng);
  const canPost = Boolean(hasCoordinates && form.dateTime && !submitting);

  const updateField = (field, location) => {
    if (field === 'pickup') {
      setPickup(location);
      setPickupInput(location.formattedAddress || location.address || '');
    } else {
      setDrop(location);
      setDropInput(location.formattedAddress || location.address || '');
    }
    setError('');
  };

  const handleUseCurrentLocation = async (field) => {
    try {
      setError('');
      if (!window.google?.maps) return;

      const current = await getCurrentPosition();
      const lat = current.coords.latitude;
      const lng = current.coords.longitude;
      const geocoder = new window.google.maps.Geocoder();
      try {
        const top = await reverseGeocode(geocoder, lat, lng);
        const formatted = formatCityStateCountry(top);
        updateField(field, {
          formattedAddress: formatted,
          address: formatted,
          lat,
          lng,
          placeId: top.place_id || '',
        });
      } catch (geoError) {
        // Graceful fallback: keep precise coordinates even if geocoding API fails.
        const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        updateField(field, {
          formattedAddress: fallbackAddress,
          address: fallbackAddress,
          lat,
          lng,
          placeId: '',
        });
        setError(
          'Current location captured, but address lookup failed. Enable Geocoding API + billing in Google Cloud.'
        );
        console.error(geoError);
      }
    } catch (positionError) {
      console.error(positionError);
      setError('Unable to fetch current location. Allow location access and try again.');
    }
  };

  const handleMapLocationSelect = (field, location) => {
    updateField(field, location);
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
          name: pickup.formattedAddress,
          coordinates: [pickup.lng, pickup.lat],
        },
        endLocation: {
          type: 'Point',
          name: drop.formattedAddress,
          coordinates: [drop.lng, drop.lat],
        },
        dateTime: form.dateTime,
        vehicleType: form.vehicleType,
        seatsAvailable: Number(form.seatsAvailable),
        totalFuelCost: Number(form.totalFuelCost),
        tollCharges: Number(form.tollCharges),
        distanceKm: Number(routeSummary?.distanceKm || 0),
      });

      setMessage('Ride posted successfully');
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Failed to post ride');
    } finally {
      setSubmitting(false);
    }
  };

  if (!apiKey) return <p className="text-red-600">Missing VITE_GOOGLE_MAPS_API_KEY in client/.env.</p>;
  if (loadError) return <p className="text-red-600">Google Maps failed to load. Check API key + billing.</p>;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-700 font-medium">
        Back
      </Link>

      <form onSubmit={submit} className="glass-card p-7 space-y-6">
        <header>
          <h2 className="text-5xl font-extrabold">Post a Ride</h2>
          <p className="text-xl text-slate-500 mt-1">Select pickup and drop with real Google location selection.</p>
        </header>

        <div className="flex gap-2 rounded-full bg-slate-100 p-1 w-fit">
          <button
            type="button"
            className={`px-4 py-1.5 rounded-full text-sm ${activeField === 'pickup' ? 'bg-white border border-slate-300' : 'text-slate-600'}`}
            onClick={() => setActiveField('pickup')}
          >
            Map Click: Pickup
          </button>
          <button
            type="button"
            className={`px-4 py-1.5 rounded-full text-sm ${activeField === 'drop' ? 'bg-white border border-slate-300' : 'text-slate-600'}`}
            onClick={() => setActiveField('drop')}
          >
            Map Click: Drop
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <LocationPicker
            label="Pickup location"
            value={pickupInput}
            placeholder="Enter pickup address"
            isLoaded={isLoaded}
            onFocus={() => setActiveField('pickup')}
            onInputChange={setPickupInput}
            onPlaceSelected={(location) => updateField('pickup', location)}
            onUseCurrentLocation={() => handleUseCurrentLocation('pickup')}
          />
          <LocationPicker
            label="Drop location"
            value={dropInput}
            placeholder="Enter drop address"
            isLoaded={isLoaded}
            onFocus={() => setActiveField('drop')}
            onInputChange={setDropInput}
            onPlaceSelected={(location) => updateField('drop', location)}
            onUseCurrentLocation={() => handleUseCurrentLocation('drop')}
          />
        </div>

        <p className="text-sm text-slate-500">Please select suggestion or use current location.</p>

        <Map
          isLoaded={isLoaded}
          pickup={pickup}
          drop={drop}
          activeField={activeField}
          onMapLocationSelect={handleMapLocationSelect}
          onRouteSummary={setRouteSummary}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-semibold mb-2">Trip Summary</p>
          <p className="text-sm text-slate-700">{pickupInput || 'Pickup'} to {dropInput || 'Drop'}</p>
          <p className="text-sm text-slate-700">Distance: {routeSummary ? `${routeSummary.distanceKm} km` : '-'}</p>
          <p className="text-sm text-slate-700">ETA: {routeSummary ? `${routeSummary.etaMinutes} min` : '-'}</p>
          <p className="text-sm text-slate-700">Estimated fare: INR {routeSummary ? estimatedFare : '-'}</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">Ride Details</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-3 gap-4">
            <input
              className="soft-input"
              type="datetime-local"
              value={form.dateTime}
              onChange={(e) => setForm((prev) => ({ ...prev, dateTime: e.target.value }))}
              required
            />
            <select
              className="soft-input"
              value={form.vehicleType}
              onChange={(e) => setForm((prev) => ({ ...prev, vehicleType: e.target.value }))}
            >
              <option value="Car">Car</option>
              <option value="Bike">Bike</option>
            </select>
            <input
              className="soft-input"
              type="number"
              min="1"
              value={form.seatsAvailable}
              onChange={(e) => setForm((prev) => ({ ...prev, seatsAvailable: e.target.value }))}
            />
            <input
              className="soft-input"
              type="number"
              min="0"
              placeholder="Fuel cost"
              value={form.totalFuelCost}
              onChange={(e) => setForm((prev) => ({ ...prev, totalFuelCost: e.target.value }))}
            />
            <input
              className="soft-input"
              type="number"
              min="0"
              placeholder="Toll charges"
              value={form.tollCharges}
              onChange={(e) => setForm((prev) => ({ ...prev, tollCharges: e.target.value }))}
            />
          </div>
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
