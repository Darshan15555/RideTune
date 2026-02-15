import { useCallback, useMemo, useRef, useState } from 'react';
import { Autocomplete, GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';

const libraries = ['places'];
const defaultCenter = { lat: 20.5937, lng: 78.9629 };

function geocodeLatLng(mapInstance, position, setAddress) {
  if (!window.google?.maps || !mapInstance) return;
  const geocoder = new window.google.maps.Geocoder();
  geocoder.geocode({ location: position }, (results, status) => {
    if (status === 'OK' && results?.[0]?.formatted_address) {
      setAddress(results[0].formatted_address);
    }
  });
}

export default function LocationPicker({ label, onLocationSelect, initialLocation = null }) {
  const [center, setCenter] = useState(
    initialLocation?.lat && initialLocation?.lng ? { lat: initialLocation.lat, lng: initialLocation.lng } : defaultCenter
  );
  const [markerPosition, setMarkerPosition] = useState(
    initialLocation?.lat && initialLocation?.lng ? { lat: initialLocation.lat, lng: initialLocation.lng } : null
  );
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [error, setError] = useState('');
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  const mapContainerStyle = useMemo(() => ({ width: '100%', height: '280px' }), []);

  const publishSelection = useCallback(
    (position, nextAddress = address) => {
      if (!position) return;
      onLocationSelect({
        lat: position.lat,
        lng: position.lng,
        address: nextAddress || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`,
      });
    },
    [address, onLocationSelect]
  );

  const handleMapClick = (event) => {
    const position = { lat: event.latLng.lat(), lng: event.latLng.lng() };
    setMarkerPosition(position);
    setCenter(position);
    geocodeLatLng(mapRef.current, position, (nextAddress) => {
      setAddress(nextAddress);
      onLocationSelect({ lat: position.lat, lng: position.lng, address: nextAddress });
    });
    publishSelection(position);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMarkerPosition(position);
        setCenter(position);
        setError('');
        geocodeLatLng(mapRef.current, position, (nextAddress) => {
          setAddress(nextAddress);
          onLocationSelect({ lat: position.lat, lng: position.lng, address: nextAddress });
        });
        publishSelection(position);
      },
      () => {
        setError('Unable to fetch current location. Please allow location permission.');
      }
    );
  };

  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;

    const position = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    const formattedAddress = place.formatted_address || place.name || '';
    setCenter(position);
    setMarkerPosition(position);
    setAddress(formattedAddress);
    publishSelection(position, formattedAddress);
  };

  if (!apiKey) {
    return <p className="text-red-600">Missing Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY in client/.env.</p>;
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
        <button type="button" className="px-3 py-1.5 rounded-full border border-slate-300 bg-slate-100" onClick={handleUseCurrentLocation}>
          Use Current Location
        </button>
      </div>

      <Autocomplete onLoad={(instance) => { autocompleteRef.current = instance; }} onPlaceChanged={onPlaceChanged}>
        <input className="soft-input" placeholder="Search location" />
      </Autocomplete>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={13}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onClick={handleMapClick}
      >
        {markerPosition && <Marker position={markerPosition} />}
      </GoogleMap>

      {address && <p className="text-sm text-slate-600">Selected: {address}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
