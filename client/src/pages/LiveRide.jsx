import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LiveMap from '../components/LiveMap';
import { getSocket } from '../services/socket';
import api from '../services/api';

export default function LiveRide() {
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId');
  const [role, setRole] = useState(params.get('role') || 'passenger');
  const [driverPosition, setDriverPosition] = useState(null);
  const [passengerPosition, setPassengerPosition] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      const { data } = await api.get(`/requests/sessions/${sessionId}`);
      setRole(data.role);

      const rideStart = data.session?.ride?.startLocation?.coordinates;
      if (Array.isArray(rideStart) && rideStart.length === 2) {
        setPassengerPosition([rideStart[1], rideStart[0]]);
      }

      const existing = data.session?.currentDriverLocation?.coordinates;
      if (Array.isArray(existing) && existing.length === 2) {
        setDriverPosition([existing[1], existing[0]]);
      }
    };

    loadSession();
  }, [sessionId]);

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

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !sessionId || role !== 'driver') return;
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setDriverPosition([latitude, longitude]);
        socket.emit('driver-location-update', { sessionId, latitude, longitude });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [role, sessionId]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Live Ride Tracking</h1>
      <p className="text-slate-600 capitalize">You are viewing as: {role}</p>
      <LiveMap driverPosition={driverPosition} passengerPosition={passengerPosition} />
    </div>
  );
}
