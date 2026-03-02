import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const requestBadgeStyles = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-200 text-slate-700',
};

export default function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/requests/my-requests');
      setRequests(data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-700 font-medium">
        Back
      </Link>

      <section className="glass-card p-7 space-y-5">
        <header>
          <h2 className="text-5xl font-extrabold">My Requests</h2>
          <p className="text-xl text-slate-500 mt-1">Track all ride requests and quickly jump into chat when accepted.</p>
        </header>

        {error && <p className="text-red-600">{error}</p>}
        {loading ? (
          <p className="text-slate-500">Loading requests...</p>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            You have not sent any ride requests yet.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const status = String(request.status || '').toUpperCase();
              const badgeClass = requestBadgeStyles[status] || requestBadgeStyles.PENDING;
              const ride = request.ride || {};
              return (
                <article key={request._id} className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-2xl font-bold">
                      {ride.startLocation?.name || 'Pickup'} to {ride.endLocation?.name || 'Drop'}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>{status}</span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3 text-slate-700">
                    <p>Driver: {ride.driver?.name || '-'}</p>
                    <p>Price: {Number.isFinite(Number(ride.pricePerSeat)) ? `INR ${ride.pricePerSeat}` : '-'}</p>
                    <p>Date: {ride.date || (ride.dateTime ? new Date(ride.dateTime).toISOString().slice(0, 10) : '-')}</p>
                  </div>

                  {status === 'ACCEPTED' && request.roomId && (
                    <div className="flex gap-2">
                      <Link to={`/chat?roomId=${request.roomId}`} className="primary-btn py-2 px-5 text-sm">
                        Chat
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
