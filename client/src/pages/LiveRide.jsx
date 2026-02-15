import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LiveMap from '../components/LiveMap';
import { getSocket } from '../services/socket';

export default function LiveRide() {
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId');
  const passengerLat = Number(params.get('passengerLat'));
  const passengerLng = Number(params.get('passengerLng'));
  const [driverPosition, setDriverPosition] = useState(null);

  const passengerPosition =
    Number.isFinite(passengerLat) && Number.isFinite(passengerLng) ? [passengerLat, passengerLng] : null;

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !sessionId) return;

    const handler = (payload) => {
      if (payload.sessionId === sessionId) {
        setDriverPosition([payload.latitude, payload.longitude]);
      }
    };

    socket.on('location-update', handler);
    return () => socket.off('location-update', handler);
  }, [sessionId]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Live Ride Tracking</h1>
      <LiveMap driverPosition={driverPosition} passengerPosition={passengerPosition} />
    </div>
  );
}
