import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

function AutoCenter({ driver, passenger }) {
  const map = useMap();

  if (driver?.length === 2) {
    map.setView(driver, 13);
  } else if (passenger?.length === 2) {
    map.setView(passenger, 13);
  }

  return null;
}

export default function LiveMap({ driverPosition, passengerPosition }) {
  const center = driverPosition || passengerPosition || [20.5937, 78.9629];
  const route = driverPosition && passengerPosition ? [driverPosition, passengerPosition] : [];

  return (
    <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-slate-300">
      <MapContainer center={center} zoom={12} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {driverPosition && <Marker position={driverPosition} />}
        {passengerPosition && <Marker position={passengerPosition} />}
        {route.length === 2 && <Polyline positions={route} color="blue" />}
        <AutoCenter driver={driverPosition} passenger={passengerPosition} />
      </MapContainer>
    </div>
  );
}
