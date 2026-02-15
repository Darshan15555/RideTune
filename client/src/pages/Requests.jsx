import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

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
    await api.patch(`/requests/${id}/status`, { status });
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
              <div key={entry._id} className="border border-slate-300 rounded-2xl p-4 bg-white">
                {tab === 'received' && <p className="font-semibold">{entry.passenger.name} requested your ride.</p>}
                {tab === 'sent' && <p className="font-semibold">Request for {entry.ride?.startLocation?.name} → {entry.ride?.endLocation?.name}</p>}
                <p className="mt-2">Status: <b className="capitalize">{entry.status}</b></p>
                {entry.contact && <p>Contact: {entry.contact}</p>}
                {tab === 'received' && entry.status === 'pending' && (
                  <div className="space-x-2 mt-3">
                    <button className="px-4 py-2 rounded-full bg-green-600 text-white" onClick={() => updateStatus(entry._id, 'accepted')}>Accept</button>
                    <button className="px-4 py-2 rounded-full bg-red-600 text-white" onClick={() => updateStatus(entry._id, 'rejected')}>Reject</button>
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
