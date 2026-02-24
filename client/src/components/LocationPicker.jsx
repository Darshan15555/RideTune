import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
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

function normalizeLocation(lat, lng, label = '') {
  return {
    lat: Number(lat),
    lng: Number(lng),
    formattedAddress: label || `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`,
    address: label || `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`,
  };
}

function MapRefBinder({ mapRef }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);

  return null;
}

function ClickMarker({ position, onLocationSelect }) {
  useMapEvents({
    click(event) {
      const lat = Number(event.latlng?.lat);
      const lng = Number(event.latlng?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      onLocationSelect(normalizeLocation(lat, lng));
    },
  });

  return position ? <Marker position={[position.lat, position.lng]} /> : null;
}

export default function LocationPicker({ label, placeholder, onLocationSelect, initialLocation }) {
  const mapRef = useRef(null);
  const providerRef = useRef(new OpenStreetMapProvider());
  const [currentLocation, setCurrentLocation] = useState(null);
  const [position, setPosition] = useState(isValidLatLng(initialLocation) ? initialLocation : null);
  const [query, setQuery] = useState(
    isValidLatLng(initialLocation) ? initialLocation?.formattedAddress || initialLocation?.address || '' : ''
  );
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const center = useMemo(() => {
    if (isValidLatLng(position)) return { lat: Number(position.lat), lng: Number(position.lng) };
    if (isValidLatLng(currentLocation)) return { lat: Number(currentLocation.lat), lng: Number(currentLocation.lng) };
    return defaultCenter;
  }, [position, currentLocation]);
  const markerLocation = useMemo(() => {
    if (isValidLatLng(position)) return { lat: Number(position.lat), lng: Number(position.lng) };
    if (isValidLatLng(currentLocation)) return { lat: Number(currentLocation.lat), lng: Number(currentLocation.lng) };
    return null;
  }, [position, currentLocation]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCurrentLocation(defaultCenter);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = normalizeLocation(pos.coords.latitude, pos.coords.longitude, 'Current location');
        setCurrentLocation(location);
      },
      () => {
        setCurrentLocation(defaultCenter);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (!isValidLatLng(initialLocation)) return;
    setPosition({ lat: Number(initialLocation.lat), lng: Number(initialLocation.lng) });
    setQuery(initialLocation.formattedAddress || initialLocation.address || '');
  }, [initialLocation?.lat, initialLocation?.lng]);

  useEffect(() => {
    if (!mapRef.current || !isValidLatLng(center)) return;
    mapRef.current.setView([Number(center.lat), Number(center.lng)], Math.max(mapRef.current.getZoom(), 13));
  }, [center?.lat, center?.lng]);

  const handleLocationSelect = (location) => {
    setPosition(location);
    setQuery(location.formattedAddress || location.address || '');
    setResults([]);
    onLocationSelect?.(location);
  };

  useEffect(() => {
    const term = String(query || '').trim();
    if (term.length < 3) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const matches = await providerRef.current.search({ query: term });
        if (cancelled) return;
        setResults(
          (matches || []).slice(0, 5).map((item) => ({
            label: item.label,
            lat: Number(item.y),
            lng: Number(item.x),
          }))
        );
      } catch (_error) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setCurrentLocation(defaultCenter);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = normalizeLocation(pos.coords.latitude, pos.coords.longitude, 'Current location');
        setCurrentLocation(location);
        handleLocationSelect(location);
      },
      () => {
        setCurrentLocation(defaultCenter);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <button
          type="button"
          onClick={useMyLocation}
          className="px-3 py-1 text-xs rounded-full border border-slate-300 bg-slate-50 hover:bg-slate-100"
        >
          Use My Location
        </button>
      </div>

      <div className="space-y-1">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder || 'Search location'}
          className="soft-input w-full"
        />
        {!!results.length && (
          <div className="rounded-xl border border-slate-200 bg-white max-h-40 overflow-auto">
            {results.map((item) => (
              <button
                key={`${item.lat}-${item.lng}-${item.label}`}
                type="button"
                onClick={() => handleLocationSelect(normalizeLocation(item.lat, item.lng, item.label))}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        {isSearching && <p className="text-xs text-slate-500">Searching...</p>}
      </div>

      <div className="h-[300px] w-full rounded-2xl overflow-hidden border border-slate-300">
        {isValidLatLng(center) && (
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={isValidLatLng(markerLocation) ? 13 : 5}
            style={{ height: '100%', width: '100%' }}
          >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapRefBinder mapRef={mapRef} />
            <ClickMarker position={markerLocation} onLocationSelect={handleLocationSelect} />
          </MapContainer>
        )}
      </div>
    </div>
  );
}
