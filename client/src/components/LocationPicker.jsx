import { useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';

const libraries = ['places'];
const defaultCenter = { lat: 20.5937, lng: 78.9629 };

function geocodePosition(position, onResolved) {
  if (!window.google?.maps || !position) return;

  const geocoder = new window.google.maps.Geocoder();
  geocoder.geocode({ location: position }, (results, status) => {
    if (status === 'OK' && results?.length) {
      const cityResult =
        results.find((entry) => entry.types?.includes('locality')) ||
        results.find((entry) => entry.types?.includes('administrative_area_level_2')) ||
        results[0];

      onResolved(cityResult.formatted_address);
    }
  });
}

export default function LocationPicker({ label, onLocationSelect, initialLocation = null }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  const [center, setCenter] = useState(
    initialLocation?.lat && initialLocation?.lng
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : defaultCenter
  );
  const [markerPosition, setMarkerPosition] = useState(
    initialLocation?.lat && initialLocation?.lng
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : null
  );
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [inputValue, setInputValue] = useState(initialLocation?.address || '');
  const [error, setError] = useState('');

  const autocompleteRef = useRef(null);

  const mapContainerStyle = useMemo(() => ({ width: '100%', height: '280px' }), []);

  useEffect(() => {
    if (initialLocation?.address) {
      setInputValue(initialLocation.address);
      setAddress(initialLocation.address);
    }
  }, [initialLocation]);

  const publishSelection = (position, nextAddress) => {
    if (!position || !nextAddress) return;

    onLocationSelect({
      lat: position.lat,
      lng: position.lng,
      address: nextAddress,
    });
  };

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) {
      setError('Please choose a city from the suggestions list.');
      return;
    }

    const position = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    const selectedCity = place.formatted_address || place.name || '';

    setCenter(position);
    setMarkerPosition(position);
    setAddress(selectedCity);
    setInputValue(selectedCity);
    setError('');

    publishSelection(position, selectedCity);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const position = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setCenter(position);
        setMarkerPosition(position);
        setError('');

        geocodePosition(position, (resolvedAddress) => {
          setAddress(resolvedAddress);
          setInputValue(resolvedAddress);
          publishSelection(position, resolvedAddress);
        });
      },
      () => {
        setError('Unable to fetch current location. Please allow location permission.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!apiKey) {
    return (
      <p className="text-red-600">
        Missing Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY in client/.env.
      </p>
    );
  }

  if (loadError) {
    return <p className="text-red-600">Failed to load Google Maps.</p>;
  }

  if (!isLoaded) {
    return <p className="text-slate-500">Loading map…</p>;
  }

  return (
    <div className="space-y-3 border border-slate-300 rounded-3xl p-4 bg-white">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h4 className="font-semibold text-slate-700">{label}</h4>
        <button
          type="button"
          className="px-3 py-1.5 rounded-full border border-slate-300 bg-slate-100"
          onClick={handleUseCurrentLocation}
        >
          Use Current Location
        </button>
      </div>

      <Autocomplete
        onLoad={(instance) => {
          autocompleteRef.current = instance;
        }}
        onPlaceChanged={handlePlaceChanged}
        options={{ types: ['(cities)'] }}
      >
        <input
          className="soft-input"
          placeholder="Search city (e.g., Athani)"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            if (error) setError('');
          }}
        />
      </Autocomplete>

      <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={11} options={{ clickableIcons: false }}>
        {markerPosition && <Marker position={markerPosition} />}
      </GoogleMap>

      {address && <p className="text-sm text-slate-600">Selected city: {address}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
