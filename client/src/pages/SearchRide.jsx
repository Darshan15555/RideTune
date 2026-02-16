import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import RideCard from '../components/RideCard';
import LocationPicker from '../components/LocationPicker';

export default function SearchRide() {
  const [form, setForm] = useState({ startLocation: null, endLocation: null });
  const [rides, setRides] = useState([]);
  const [heatmap, setHeatmap] = useState([]);


  useEffect(() => {
    const loadDemand = async () => {
      const { data } = await api.get('/rides/heatmap/demand');
      setHeatmap(data);
    };
    loadDemand();
  }, []);

  const search = async (event) => {
    event.preventDefault();
    if (!form.startLocation || !form.endLocation) return;

    const { data } = await api.post('/rides/search', {
      startLocation: { coordinates: [form.startLocation.lng, form.startLocation.lat] },
      endLocation: { coordinates: [form.endLocation.lng, form.endLocation.lat] },
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
          <LocationPicker
            label="Select starting point"
            onLocationSelect={(location) => setForm((prev) => ({ ...prev, startLocation: location }))}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-3xl font-bold">📍 To</h3>
          <LocationPicker
            label="Select destination"
            onLocationSelect={(location) => setForm((prev) => ({ ...prev, endLocation: location }))}
          />
        </section>

        <button className="primary-btn w-full text-xl" disabled={!form.startLocation || !form.endLocation}>🔎 Find Rides</button>
      </form>

      {heatmap.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="font-semibold mb-2">Demand Heatmap (top zones)</h3>
          <div className="grid md:grid-cols-3 gap-2 text-sm">
            {heatmap.slice(0, 6).map((zone, index) => (
              <div key={index} className="border rounded-lg p-2">
                <p>Lat: {zone.lat}, Lng: {zone.lng}</p>
                <p>Demand: <b>{zone.demand}</b></p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid md:grid-cols-2 gap-4">
        {rides.map((ride) => <RideCard key={ride._id} ride={ride} onRequest={sendRequest} />)}
      </section>
    </div>
  );
}
