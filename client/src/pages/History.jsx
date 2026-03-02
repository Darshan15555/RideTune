import { useEffect, useState } from 'react';
import api from '../services/api';

export default function History() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get('/users/history');
      setHistory(data);
    };
    load();
  }, []);

  const submitReview = async (sessionId, revieweeId) => {
    const rating = Number(prompt('Rate 1-5'));
    const comment = prompt('Comment (optional)') || '';
    if (!rating) return;
    await api.post('/users/reviews', { rideSessionId: sessionId, revieweeId, rating, comment });
    alert('Review submitted');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      <h1 className="text-3xl font-bold">Ride History</h1>
      {history.map((item) => (
        <div key={item._id} className="border rounded-xl bg-white p-4 space-y-1">
          <p>{item.ride?.startLocation?.name} → {item.ride?.endLocation?.name}</p>
          <p className="text-sm text-slate-600">Status: {item.status}</p>
          {item.status === 'completed' && (
            <button className="px-3 py-1 rounded-full bg-indigo-600 text-white text-sm" onClick={() => submitReview(item._id, item.driver)}>Rate Co-rider</button>
          )}
        </div>
      ))}
    </div>
  );
}
