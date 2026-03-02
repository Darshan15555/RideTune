import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LiveMap from '../components/LiveMap';
import { getSocket } from '../services/socket';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import SOSPanel from '../components/SOSPanel';

export default function LiveRide() {
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId');
  const [role, setRole] = useState(params.get('role') || 'passenger');
  const [driverPosition, setDriverPosition] = useState(null);
  const [passengerPosition, setPassengerPosition] = useState(null);
  const [status, setStatus] = useState('driver_accepted');
  const [otp, setOtp] = useState('');
  const [shareLink, setShareLink] = useState('');
  const watchIdRef = useRef(null);

  const loadSession = async () => {
    if (!sessionId) return;
    const { data } = await api.get(`/requests/sessions/${sessionId}`);
    setRole(data.role);
    setStatus(data.session?.status || 'driver_accepted');
    setShareLink(data.shareLink || '');

    const rideStart = data.session?.ride?.startLocation?.coordinates;
    if (Array.isArray(rideStart) && rideStart.length === 2) setPassengerPosition([rideStart[1], rideStart[0]]);

    const existing = data.session?.currentDriverLocation?.coordinates;
    if (Array.isArray(existing) && existing.length === 2) setDriverPosition([existing[1], existing[0]]);
  };

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !sessionId) return;

    const onLocation = (payload) => {
      if (payload.sessionId === sessionId) setDriverPosition([payload.latitude, payload.longitude]);
    };

    const onStatus = (payload) => {
      if (String(payload.sessionId) === String(sessionId)) setStatus(payload.status);
    };

    socket.on('location-update', onLocation);
    socket.on('ride-status-update', onStatus);

    return () => {
      socket.off('location-update', onLocation);
      socket.off('ride-status-update', onStatus);
    };
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
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [role, sessionId]);

  const updateStatus = async (nextStatus) => {
    await api.put(`/requests/sessions/${sessionId}/status`, { status: nextStatus });
    setStatus(nextStatus);
  };

  const verifyOtp = async () => {
    await api.post(`/requests/sessions/${sessionId}/verify-otp`, { otp });
    alert('Ride verified successfully');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Live Ride Tracking</h1>
        <StatusBadge status={status} />
      </div>
      <p className="text-slate-600 capitalize">You are viewing as: {role}</p>
      {shareLink && <p className="text-xs break-all">Share link: {shareLink}</p>}
      <LiveMap driverPosition={driverPosition} passengerPosition={passengerPosition} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-2">
          <h3 className="font-semibold">Ride Controls</h3>
          <div className="flex gap-2 flex-wrap">
            {['on_the_way', 'started', 'completed', 'cancelled'].map((next) => (
              <button key={next} className="px-3 py-1 rounded-full bg-slate-800 text-white text-xs" onClick={() => updateStatus(next)}>{next.replaceAll('_', ' ')}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="soft-input" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
            <button className="px-3 py-1 rounded-full bg-indigo-600 text-white" onClick={verifyOtp}>Verify OTP</button>
          </div>
        </div>

        <SOSPanel sessionId={sessionId} />
      </div>
    </div>
  );
}
