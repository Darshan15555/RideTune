import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';

const defaultCenter = { lat: 20.5937, lng: 78.9629 };

const uberLightStyle = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', stylers: [{ color: '#e0f2fe' }] },
  { featureType: 'landscape', stylers: [{ color: '#f8fafc' }] },
];

function toRouteSummary(response) {
  const route = response.routes?.[0];
  if (!route) return null;

  const distanceMeters = (route.legs || []).reduce((sum, leg) => sum + Number(leg.distance?.value || 0), 0);
  const durationSeconds = (route.legs || []).reduce((sum, leg) => sum + Number(leg.duration?.value || 0), 0);

  return {
    polyline: (route.overview_path || []).map((point) => ({ lat: point.lat(), lng: point.lng() })),
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    etaMinutes: Math.max(1, Math.round(durationSeconds / 60)),
  };
}

export default function Map({
  isLoaded,
  pickup,
  drop,
  activeField,
  onMapLocationSelect,
  onRouteSummary,
}) {
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const [polylinePath, setPolylinePath] = useState([]);

  const center = useMemo(() => pickup || drop || defaultCenter, [pickup, drop]);

  useEffect(() => {
    if (!isLoaded || !window.google?.maps) return;
    geocoderRef.current = new window.google.maps.Geocoder();
  }, [isLoaded]);

  useEffect(() => {
    if (!window.google?.maps || !pickup || !drop) {
      setPolylinePath([]);
      onRouteSummary(null);
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: drop.lat, lng: drop.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        console.log('direction response', response);
        if (status !== 'OK' || !response) {
          setPolylinePath([]);
          onRouteSummary(null);
          return;
        }

        const summary = toRouteSummary(response);
        setPolylinePath(summary?.polyline || []);
        onRouteSummary(summary);

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat: pickup.lat, lng: pickup.lng });
        bounds.extend({ lat: drop.lat, lng: drop.lng });
        mapRef.current?.fitBounds(bounds);
      }
    );
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng]);

  const handleMapClick = (event) => {
    const lat = event.latLng?.lat?.();
    const lng = event.latLng?.lng?.();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !geocoderRef.current) return;

    const latLng = new window.google.maps.LatLng(lat, lng);
    geocoderRef.current.geocode({ location: latLng }, (results, status) => {
      if (status !== 'OK' || !results?.length) return;

      const top = results[0];
      const selected = {
        formattedAddress: top.formatted_address || '',
        address: top.formatted_address || '',
        lat,
        lng,
        placeId: top.place_id || '',
      };

      onMapLocationSelect(activeField, selected);

      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(15);
    });
  };

  if (!isLoaded) {
    return <p className="text-slate-500 text-sm">Loading map...</p>;
  }

  return (
    <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-slate-300">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={12}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onClick={handleMapClick}
        options={{
          styles: uberLightStyle,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        }}
      >
        {pickup && (
          <Marker
            position={{ lat: pickup.lat, lng: pickup.lng }}
            label={{ text: 'P', color: '#ffffff', fontWeight: '700' }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#16a34a',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            }}
          />
        )}

        {drop && (
          <Marker
            position={{ lat: drop.lat, lng: drop.lng }}
            label={{ text: 'D', color: '#ffffff', fontWeight: '700' }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#dc2626',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            }}
          />
        )}

        {polylinePath.length > 0 && (
          <Polyline
            path={polylinePath}
            options={{
              strokeColor: '#2563eb',
              strokeOpacity: 0.95,
              strokeWeight: 6,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
