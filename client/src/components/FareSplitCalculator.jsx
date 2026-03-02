import { useState } from 'react';
import api from '../services/api';

export default function FareSplitCalculator({ rideId }) {
  const [fuel, setFuel] = useState('');
  const [toll, setToll] = useState('');
  const [result, setResult] = useState(null);

  const calculate = async () => {
    if (!rideId) return;
    const { data } = await api.post(`/rides/${rideId}/fare-split`, {
      totalFuelCost: Number(fuel || 0),
      tollCharges: Number(toll || 0),
    });
    setResult(data);
  };

  return (
    <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-2">
      <h4 className="font-semibold">Fare Split Calculator</h4>
      <div className="grid grid-cols-2 gap-2">
        <input className="soft-input" type="number" placeholder="Fuel cost" value={fuel} onChange={(e) => setFuel(e.target.value)} />
        <input className="soft-input" type="number" placeholder="Toll" value={toll} onChange={(e) => setToll(e.target.value)} />
      </div>
      <button type="button" className="px-3 py-1 rounded-full bg-indigo-600 text-white" onClick={calculate}>Calculate</button>
      {result && <p className="text-sm">Per passenger: <b>₹{result.perPassenger}</b> ({result.passengers} riders)</p>}
    </div>
  );
}
