import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

const nextStatuses = ['on_the_way', 'started', 'completed', 'cancelled'];

export default function Requests() {
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [tab, setTab] = useState('sent');

  const load = async () => {
    const [sentRes, receivedRes] = await Promise.all([api.get('/requests/sent'), api.get('/requests/received')]);
    setSent(sentRes.data);
    setReceived(receivedRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id, status) => {
    await api.put(`/requests/${id}/${status}`);
    await load();
  };

  const updateRideState = async (sessionId, status) => {
    await api.put(`/requests/sessions/${sessionId}/status`, { status });
    await load();
  };

  const list = tab === 'sent' ? sent : received;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-700 font-medium">← Back</Link>

      <div className="glass-card p-6">
        <div className="bg-slate-200 rounded-full p-1 grid grid-cols-2 mb-6">
          <button onClick={() => setTab('sent')} className={`rounded-full py-3 font-semibold ${tab === 'sent' ? 'bg-white' : 'text-slate-600'}`}>
            ✈ Sent Requests ({sent.length})
          </button>
          <button onClick={() => setTab('received')} className={`rounded-full py-3 font-semibold ${tab === 'received' ? 'bg-white' : 'text-slate-600'}`}>
            📨 Received Requests ({received.length})
          </button>
        </div>

        {list.length === 0 ? (
          <div className="border border-slate-300 rounded-3xl p-20 text-center text-slate-500">
            <p className="text-5xl mb-3">🕊️</p>
            <p className="text-3xl font-semibold text-slate-700 mb-2">No {tab} requests</p>
            <p className="text-xl">Search for rides and send requests to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((entry) => (
              <div key={entry._id} className="border border-slate-300 rounded-2xl p-4 bg-white space-y-2">
                {tab === 'received' && <p className="font-semibold">{entry.passenger.name} requested your ride.</p>}
                {tab === 'sent' && <p className="font-semibold">Request for {entry.ride?.startLocation?.name} → {entry.ride?.endLocation?.name}</p>}
                <p>Status: <b className="capitalize">{entry.status}</b></p>
                {entry.rideStatus && <StatusBadge status={entry.rideStatus} />}
                {entry.contact && <p>Contact: {entry.contact}</p>}

                {entry.status === 'accepted' && entry.roomId && (
                  <div className="flex flex-wrap gap-2 mt-2 items-center">
                    <Link className="px-3 py-1 rounded-full bg-indigo-600 text-white" to={`/chat?roomId=${entry.roomId}`}>Open Chat</Link>
                    <Link className="px-3 py-1 rounded-full bg-cyan-600 text-white" to={`/live-ride?sessionId=${entry.sessionId}&role=${tab === 'received' ? 'driver' : 'passenger'}`}>Live Tracking</Link>
                    {tab === 'received' && (
                      <select className="soft-input max-w-[220px]" defaultValue="" onChange={(e) => e.target.value && updateRideState(entry.sessionId, e.target.value)}>
                        <option value="" disabled>Update ride status</option>
                        {nextStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                      </select>
                    )}
                  </div>
                )}

                {tab === 'received' && entry.status === 'pending' && (
                  <div className="space-x-2 mt-3">
                    <button className="px-4 py-2 rounded-full bg-green-600 text-white" onClick={() => updateStatus(entry._id, 'accept')}>Accept</button>
                    <button className="px-4 py-2 rounded-full bg-red-600 text-white" onClick={() => updateStatus(entry._id, 'reject')}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
