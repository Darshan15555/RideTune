import { useRef } from 'react';
import { Autocomplete } from '@react-google-maps/api';

function buildLocationFromPlace(place) {
  const geometry = place?.geometry?.location;
  if (!geometry) return null;

  const lat = geometry.lat();
  const lng = geometry.lng();
  console.log(place);
  console.log(lat, lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    formattedAddress: place.formatted_address || place.name || '',
    address: place.formatted_address || place.name || '',
    lat,
    lng,
    placeId: place.place_id || '',
  };
}

export default function LocationPicker({
  label,
  value,
  placeholder,
  isLoaded,
  onInputChange,
  onPlaceSelected,
  onUseCurrentLocation,
  onFocus,
}) {
  const autocompleteRef = useRef(null);

  if (!isLoaded) {
    return <p className="text-sm text-slate-500">Loading location search...</p>;
  }

  const handlePlaceChanged = (ref) => {
    const place = ref?.getPlace?.();
    const location = buildLocationFromPlace(place);
    if (!location) return;
    onPlaceSelected(location);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <button
          type="button"
          onClick={onUseCurrentLocation}
          className="px-3 py-1 text-xs rounded-full border border-slate-300 bg-slate-50 hover:bg-slate-100"
        >
          Use Current Location
        </button>
      </div>

      <Autocomplete
        onLoad={(ref) => (autocompleteRef.current = ref)}
        onPlaceChanged={() => handlePlaceChanged(autocompleteRef.current)}
        options={{
          types: ['geocode'],
          componentRestrictions: { country: 'in' },
        }}
      >
        <input
          className="soft-input"
          value={value}
          placeholder={placeholder}
          onFocus={onFocus}
          onChange={(event) => onInputChange(event.target.value)}
        />
      </Autocomplete>
    </div>
  );
}
