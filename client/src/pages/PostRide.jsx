import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import LocationPicker from '../components/LocationPicker';

const initialForm = {
  startLocation: null,
  endLocation: null,
  stopsText: '',
  dateTime: '',
  vehicleType: 'Car',
  seatsAvailable: 1,
  totalFuelCost: 0,
  tollCharges: 0,
};

export default function PostRide() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!form.startLocation || !form.endLocation) {
      setMessage('Please select both start and destination locations.');
      return;
    }

    await api.post('/rides', {
      startLocation: {
        type: 'Point',
        name: form.startLocation.address,
        coordinates: [form.startLocation.lng, form.startLocation.lat],
      },
      endLocation: {
        type: 'Point',
        name: form.endLocation.address,
        coordinates: [form.endLocation.lng, form.endLocation.lat],
      },
      dateTime: form.dateTime,
      vehicleType: form.vehicleType,
      seatsAvailable: Number(form.seatsAvailable),
      totalFuelCost: Number(form.totalFuelCost),
      tollCharges: Number(form.tollCharges),
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
          <LocationPicker label="Choose pickup point" onLocationSelect={(location) => setForm((prev) => ({ ...prev, startLocation: location }))} />
        </section>

        <section className="space-y-3">
          <h3 className="text-3xl font-bold">📍 Destination</h3>
          <LocationPicker label="Choose destination" onLocationSelect={(location) => setForm((prev) => ({ ...prev, endLocation: location }))} />
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">🛑 Multi-stop (optional)</h3>
          <input className="soft-input" placeholder="Hubli, Kolhapur, Satara" value={form.stopsText} onChange={(e) => setForm({ ...form, stopsText: e.target.value })} />
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
            <input className="soft-input" type="number" min="0" placeholder="Total fuel cost" value={form.totalFuelCost} onChange={(e) => setForm({ ...form, totalFuelCost: e.target.value })} />
            <input className="soft-input" type="number" min="0" placeholder="Toll charges" value={form.tollCharges} onChange={(e) => setForm({ ...form, tollCharges: e.target.value })} />
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
