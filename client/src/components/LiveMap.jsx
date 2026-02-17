import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, Polyline, useLoadScript } from '@react-google-maps/api';

const libraries = ['places'];
const defaultCenter = { lat: 20.5937, lng: 78.9629 };

function midpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

function toRouteSummary(route) {
  const legs = route.legs || [];
  const totalMeters = legs.reduce((sum, leg) => sum + Number(leg.distance?.value || 0), 0);
  const totalSeconds = legs.reduce((sum, leg) => sum + Number(leg.duration?.value || 0), 0);
  const distanceKm = Number((totalMeters / 1000).toFixed(2));
  const durationMinutes = Math.max(1, Math.round(totalSeconds / 60));

  return {
    polyline: (route.overview_path || []).map((point) => ({ lat: point.lat(), lng: point.lng() })),
    distanceKm,
    durationMinutes,
    distanceText: `${distanceKm} km`,
    durationText: `${durationMinutes} min`,
  };
}

export default function LiveMap({
  pickup = null,
  drop = null,
  driverPosition = null,
  passengerPosition = null,
  selectedRouteIndex = 0,
  onRoutesChange,
  onRouteSelect,
  nearbyDrivers = [],
  className = '',
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: apiKey || '', libraries });
  const mapRef = useRef(null);
  const [routes, setRoutes] = useState([]);
  const [mapError, setMapError] = useState('');

  const pickupPoint = useMemo(
    () =>
      Number.isFinite(Number(pickup?.lat)) && Number.isFinite(Number(pickup?.lng))
        ? { lat: Number(pickup.lat), lng: Number(pickup.lng) }
        : null,
    [pickup]
  );
  const dropPoint = useMemo(
    () =>
      Number.isFinite(Number(drop?.lat)) && Number.isFinite(Number(drop?.lng))
        ? { lat: Number(drop.lat), lng: Number(drop.lng) }
        : null,
    [drop]
  );
  const driverPoint = useMemo(
    () =>
      Array.isArray(driverPosition) && driverPosition.length === 2
        ? { lat: Number(driverPosition[0]), lng: Number(driverPosition[1]) }
        : null,
    [driverPosition]
  );
  const passengerPoint = useMemo(
    () =>
      Array.isArray(passengerPosition) && passengerPosition.length === 2
        ? { lat: Number(passengerPosition[0]), lng: Number(passengerPosition[1]) }
        : null,
    [passengerPosition]
  );

  useEffect(() => {
    if (!window.google?.maps || !pickupPoint || !dropPoint) {
      setRoutes([]);
      onRoutesChange?.([]);
      return;
    }

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: pickupPoint,
        destination: dropPoint,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result, status) => {
        if (status !== 'OK' || !result?.routes?.length) {
          setMapError('No routes found');
          setRoutes([]);
          onRoutesChange?.([]);
          return;
        }

        const nextRoutes = result.routes.map(toRouteSummary);
        setMapError('');
        setRoutes(nextRoutes);
        onRoutesChange?.(nextRoutes);

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(pickupPoint);
        bounds.extend(dropPoint);
        mapRef.current?.fitBounds(bounds);
        mapRef.current?.panTo(midpoint(pickupPoint, dropPoint));
      }
    );
  }, [pickupPoint, dropPoint]);

  if (!apiKey) return <p className="text-red-600">Missing Google Maps API key.</p>;
  if (loadError) return <p className="text-red-600">Failed to load Google Maps.</p>;
  if (!isLoaded) return <p className="text-slate-500">Loading map...</p>;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-slate-300">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          zoom={12}
          center={pickupPoint || dropPoint || driverPoint || passengerPoint || defaultCenter}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
        >
          {pickupPoint && <Marker position={pickupPoint} label="P" />}
          {dropPoint && <Marker position={dropPoint} label="D" />}
          {driverPoint && <Marker position={driverPoint} label="D" />}
          {passengerPoint && <Marker position={passengerPoint} label="P" />}

          {routes.map((route, index) => (
            <Polyline
              key={`route-${index}`}
              path={route.polyline}
              options={{
                strokeColor: index === selectedRouteIndex ? '#1d4ed8' : '#64748b',
                strokeOpacity: index === selectedRouteIndex ? 0.95 : 0.45,
                strokeWeight: index === selectedRouteIndex ? 6 : 4,
                zIndex: index === selectedRouteIndex ? 10 : 5,
              }}
              onClick={() => onRouteSelect?.(index)}
            />
          ))}

          {driverPoint && passengerPoint && !routes.length && (
            <Polyline
              path={[driverPoint, passengerPoint]}
              options={{
                strokeColor: '#0f172a',
                strokeOpacity: 0.7,
                strokeWeight: 4,
              }}
            />
          )}

          {nearbyDrivers
            .filter((driver) => Number.isFinite(Number(driver.lat)) && Number.isFinite(Number(driver.lng)))
            .map((driver) => (
              <Marker
                key={driver.driverId || `${driver.lat}-${driver.lng}`}
                position={{ lat: Number(driver.lat), lng: Number(driver.lng) }}
                label={String(driver.vehicleType || 'D').slice(0, 1)}
                title={`${driver.name || 'Driver'} (${driver.vehicleType || 'Vehicle'})`}
              />
            ))}
        </GoogleMap>
      </div>

      {mapError && <p className="text-red-600">{mapError}</p>}
    </div>
  );
}
