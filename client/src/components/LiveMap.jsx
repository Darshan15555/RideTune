import { GoogleMap, Marker, Polyline, useLoadScript } from '@react-google-maps/api';

const defaultCenter = { lat: 20.5937, lng: 78.9629 };

export default function LiveMap({ driverPosition, passengerPosition }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: apiKey || '' });

  if (!apiKey) {
    return <p className="text-red-600">Missing Google Maps API key.</p>;
  }

  if (loadError) {
    return <p className="text-red-600">Failed to load Google Maps.</p>;
  }

  if (!isLoaded) {
    return <p className="text-slate-500">Loading map…</p>;
  }

  const driver = driverPosition ? { lat: driverPosition[0], lng: driverPosition[1] } : null;
  const passenger = passengerPosition ? { lat: passengerPosition[0], lng: passengerPosition[1] } : null;
  const center = driver || passenger || defaultCenter;

  return (
    <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-slate-300">
      <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} zoom={13} center={center}>
        {driver && <Marker position={driver} label="D" />}
        {passenger && <Marker position={passenger} label="P" />}
        {driver && passenger && <Polyline path={[driver, passenger]} options={{ strokeColor: '#2563eb', strokeWeight: 4 }} />}
      </GoogleMap>
    </div>
  );
}
