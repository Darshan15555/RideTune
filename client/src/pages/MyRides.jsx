import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const badgeStyles = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  FULL: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

function StatusBadge({ status }) {
  const normalized = String(status || 'ACTIVE').toUpperCase();
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeStyles[normalized] || badgeStyles.ACTIVE}`}>
      {normalized}
    </span>
  );
}

export default function MyRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRideId, setExpandedRideId] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const loadMyRides = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/rides/my-posted');
      setRides(data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load posted rides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyRides();
  }, []);

  const loadRideRequests = async (rideId) => {
    setRequestsLoading(true);
    try {
      const { data } = await api.get(`/requests/ride/${rideId}`);
      setRideRequests(data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load ride requests');
    } finally {
      setRequestsLoading(false);
    }
  };

  const toggleRequests = async (rideId) => {
    if (expandedRideId === rideId) {
      setExpandedRideId(null);
      setRideRequests([]);
      return;
    }
    setExpandedRideId(rideId);
    await loadRideRequests(rideId);
  };

  const updateRideStatus = async (rideId, status) => {
    try {
      await api.patch(`/rides/${rideId}/status`, { status });
      await loadMyRides();
      if (expandedRideId === rideId) await loadRideRequests(rideId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update ride status');
    }
  };

  const updateRequestStatus = async (requestId, status) => {
    try {
      await api.patch(`/requests/${requestId}/status`, { status });
      if (expandedRideId) await loadRideRequests(expandedRideId);
      await loadMyRides();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update request status');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-700 font-medium">
        Back
      </Link>

      <section className="glass-card p-7 space-y-5">
        <header>
          <h2 className="text-5xl font-extrabold">My Posted Rides</h2>
          <p className="text-xl text-slate-500 mt-1">Manage your rides, requests, and ride status in one place.</p>
        </header>

        {error && <p className="text-red-600">{error}</p>}
        {loading ? (
          <p className="text-slate-500">Loading rides...</p>
        ) : rides.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            You have not posted any rides yet.
          </div>
        ) : (
          <div className="space-y-4">
            {rides.map((ride) => (
              <article key={ride._id} className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-2xl font-bold">
                    {ride.startLocation?.name} to {ride.endLocation?.name}
                  </h3>
                  <StatusBadge status={ride.status} />
                </div>

                <div className="grid md:grid-cols-3 gap-3 text-slate-700">
                  <p>Date: {ride.date || '-'}</p>
                  <p>Time: {ride.time || '-'}</p>
                  <p>Price/seat: {Number.isFinite(Number(ride.pricePerSeat)) ? `INR ${ride.pricePerSeat}` : '-'}</p>
                  <p>Seats available: {ride.seatsAvailable}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="primary-btn py-2 px-5 text-sm" type="button" onClick={() => toggleRequests(ride._id)}>
                    {expandedRideId === ride._id ? 'Hide Requests' : 'View Requests'}
                  </button>
                  <button
                    className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm"
                    type="button"
                    onClick={() => updateRideStatus(ride._id, 'COMPLETED')}
                    disabled={ride.status === 'COMPLETED'}
                  >
                    Mark as Completed
                  </button>
                  <button
                    className="px-4 py-2 rounded-full bg-rose-600 text-white text-sm"
                    type="button"
                    onClick={() => updateRideStatus(ride._id, 'CANCELLED')}
                    disabled={ride.status === 'CANCELLED'}
                  >
                    Cancel Ride
                  </button>
                </div>

                {expandedRideId === ride._id && (
                  <section className="rounded-2xl border border-slate-200 p-4 bg-slate-50 space-y-3">
                    <h4 className="text-lg font-semibold">Passenger Requests</h4>
                    {requestsLoading ? (
                      <p className="text-slate-500">Loading requests...</p>
                    ) : rideRequests.length === 0 ? (
                      <p className="text-slate-500">No requests for this ride yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {rideRequests.map((request) => (
                          <div key={request._id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold">{request.passenger?.name || 'Passenger'}</p>
                              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 border border-slate-300">
                                {String(request.status || '').toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700">Compatibility: {request.compatibilityScore ?? 0}%</p>
                            <p className="text-sm text-slate-700">Seats requested: {request.seatsRequested || 1}</p>
                            {String(request.status || '').toUpperCase() === 'PENDING' && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  type="button"
                                  className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs"
                                  onClick={() => updateRequestStatus(request._id, 'ACCEPTED')}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs"
                                  onClick={() => updateRequestStatus(request._id, 'REJECTED')}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
