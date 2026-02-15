import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const initialForm = {
  startName: '', startLatitude: '', startLongitude: '',
  endName: '', endLatitude: '', endLongitude: '',
  dateTime: '', vehicleType: 'Car', seatsAvailable: 1,
};

export default function PostRide() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    await api.post('/rides', {
      startLocation: { type: 'Point', name: form.startName, coordinates: [Number(form.startLongitude), Number(form.startLatitude)] },
      endLocation: { type: 'Point', name: form.endName, coordinates: [Number(form.endLongitude), Number(form.endLatitude)] },
      dateTime: form.dateTime,
      vehicleType: form.vehicleType,
      seatsAvailable: Number(form.seatsAvailable),
    });
    setMessage('Ride posted successfully');
    setForm(initialForm);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-700 font-medium">← Back</Link>

      <form onSubmit={submit} className="glass-card p-7 space-y-7">
        <header>
          <h2 className="text-5xl font-extrabold">Post a Ride</h2>
          <p className="text-2xl text-slate-500 mt-1">Share your journey and connect with compatible travelers</p>
        </header>

        <section className="space-y-3">
          <h3 className="text-3xl font-bold">📍 Start Location</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-3 gap-4">
            <input className="soft-input" placeholder="Location Name" value={form.startName} onChange={(e) => setForm({ ...form, startName: e.target.value })} required />
            <input className="soft-input" placeholder="Latitude" value={form.startLatitude} onChange={(e) => setForm({ ...form, startLatitude: e.target.value })} required />
            <input className="soft-input" placeholder="Longitude" value={form.startLongitude} onChange={(e) => setForm({ ...form, startLongitude: e.target.value })} required />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-3xl font-bold">📍 Destination</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-3 gap-4">
            <input className="soft-input" placeholder="Location Name" value={form.endName} onChange={(e) => setForm({ ...form, endName: e.target.value })} required />
            <input className="soft-input" placeholder="Latitude" value={form.endLatitude} onChange={(e) => setForm({ ...form, endLatitude: e.target.value })} required />
            <input className="soft-input" placeholder="Longitude" value={form.endLongitude} onChange={(e) => setForm({ ...form, endLongitude: e.target.value })} required />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-3xl font-bold">✨ Ride Details</h3>
          <div className="rounded-3xl border border-slate-300 p-5 grid md:grid-cols-3 gap-4">
            <input className="soft-input" type="datetime-local" value={form.dateTime} onChange={(e) => setForm({ ...form, dateTime: e.target.value })} required />
            <select className="soft-input" value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
              <option>Car</option>
              <option>Bike</option>
            </select>
            <input className="soft-input" type="number" min="1" value={form.seatsAvailable} onChange={(e) => setForm({ ...form, seatsAvailable: e.target.value })} />
          </div>
        </section>

        {message && <p className="text-green-600 font-medium">{message}</p>}

        <div className="flex gap-4">
          <button className="primary-btn flex-1">✨ Post Ride</button>
          <Link to="/dashboard" className="px-8 py-3 rounded-full border border-slate-300 bg-slate-100 font-medium">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
