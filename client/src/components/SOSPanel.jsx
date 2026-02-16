import { useState } from 'react';
import api from '../services/api';

export default function SOSPanel({ sessionId }) {
  const [response, setResponse] = useState(null);

  const triggerSOS = async () => {
    const { data } = await api.post(`/requests/sessions/${sessionId}/sos`);
    setResponse(data);
  };

  if (!sessionId) return null;

  return (
    <div className="border border-rose-300 bg-rose-50 rounded-xl p-3 space-y-2">
      <h4 className="font-semibold text-rose-700">Safety Controls</h4>
      <button type="button" className="px-3 py-2 rounded-full bg-rose-600 text-white" onClick={triggerSOS}>🚨 SOS</button>
      {response?.shareLink && <p className="text-xs break-all">Live share: {response.shareLink}</p>}
    </div>
  );
}
