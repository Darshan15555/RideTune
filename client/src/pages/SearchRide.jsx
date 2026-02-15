import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import RideCard from '../components/RideCard';

export default function SearchRide() {
  const [form, setForm] = useState({ startName: '', startLatitude: '', startLongitude: '', endName: '', endLatitude: '', endLongitude: '' });
  const [rides, setRides] = useState([]);

  const search = async (event) => {
    event.preventDefault();
    const { data } = await api.post('/rides/search', {
      startLatitude: Number(form.startLatitude),
      startLongitude: Number(form.startLongitude),
      endLatitude: Number(form.endLatitude),
      endLongitude: Number(form.endLongitude),
    });
    setRides(data);
  };

  const sendRequest = async (rideId) => {
    await api.post('/requests', { rideId });
    alert('Request sent');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-700 font-medium">← Back</Link>

      <form onSubmit={search} className="glass-card p-7 space-y-7">
        <header>
          <h2 className="text-5xl font-extrabold">Search Rides</h2>
          <p className="text-2xl text-slate-500 mt-1">Find compatible travel companions on your route</p>
        </header>

        <section className="space-y-3">
          <h3 className="text-3xl font-bold">📍 From</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-3 gap-4">
            <input className="soft-input" placeholder="Location Name" value={form.startName} onChange={(e) => setForm({ ...form, startName: e.target.value })} />
            <input className="soft-input" placeholder="Latitude" value={form.startLatitude} onChange={(e) => setForm({ ...form, startLatitude: e.target.value })} required />
            <input className="soft-input" placeholder="Longitude" value={form.startLongitude} onChange={(e) => setForm({ ...form, startLongitude: e.target.value })} required />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-3xl font-bold">📍 To</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-3 gap-4">
            <input className="soft-input" placeholder="Location Name" value={form.endName} onChange={(e) => setForm({ ...form, endName: e.target.value })} />
            <input className="soft-input" placeholder="Latitude" value={form.endLatitude} onChange={(e) => setForm({ ...form, endLatitude: e.target.value })} required />
            <input className="soft-input" placeholder="Longitude" value={form.endLongitude} onChange={(e) => setForm({ ...form, endLongitude: e.target.value })} required />
          </div>
        </section>

        <button className="primary-btn w-full text-xl">🔎 Find Rides</button>
      </form>

      <section className="grid md:grid-cols-2 gap-4">
        {rides.map((ride) => <RideCard key={ride._id} ride={ride} onRequest={sendRequest} />)}
      </section>
    </div>
  );
}
