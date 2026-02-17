import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const items = [
  { to: '/profile', title: 'My Profile', desc: 'View, edit, and share your public profile', icon: 'P', tone: 'from-rose-500 to-orange-400' },
  { to: '/post-ride', title: 'Post Ride', desc: 'Share your journey and find compatible travelers', icon: '+', tone: 'from-purple-500 to-indigo-400' },
  { to: '/search-ride', title: 'Search Rides', desc: 'Find rides matching your route and interests', icon: 'S', tone: 'from-cyan-500 to-sky-400' },
  { to: '/requests', title: 'My Requests', desc: 'View and manage your ride requests', icon: 'R', tone: 'from-pink-500 to-fuchsia-400' },
  { to: '/history', title: 'Ride History', desc: 'Track completed rides and reviews', icon: 'H', tone: 'from-emerald-500 to-lime-400' },
];

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [analyticsRes, suggestionRes] = await Promise.all([
        api.get('/users/analytics'),
        api.get('/users/suggestions'),
      ]);
      setAnalytics(analyticsRes.data);
      setSuggestion(suggestionRes.data.suggestion);
    };

    load();
  }, []);

  return (
    <section className="glass-card p-10 max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-6xl font-extrabold mb-3">
          Welcome to <span className="gradient-text">TuneTrip</span>
        </h2>
        <p className="text-3xl text-slate-500">Choose an action to get started</p>
      </div>

      {analytics && (
        <div className="grid md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border">
            Rides: <b>{analytics.totalRides}</b>
          </div>
          <div className="bg-white rounded-2xl p-4 border">
            Saved: <b>INR {analytics.moneySaved}</b>
          </div>
          <div className="bg-white rounded-2xl p-4 border">
            Distance: <b>{analytics.distanceTravelled} km</b>
          </div>
          <div className="bg-white rounded-2xl p-4 border">
            Level: <b>{analytics.level}</b>
          </div>
        </div>
      )}

      {suggestion && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <p className="font-semibold">Suggested Ride Today:</p>
          <p>
            {suggestion.from} to {suggestion.to}
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="border border-slate-300 rounded-3xl p-7 hover:border-purple-300 hover:shadow-md transition"
          >
            <div className={`h-[72px] w-[72px] rounded-3xl bg-gradient-to-br ${item.tone} text-white text-4xl grid place-items-center shadow-xl mb-6`}>
              {item.icon}
            </div>
            <h3 className="text-3xl font-bold mb-3">{item.title}</h3>
            <p className="text-xl text-slate-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
