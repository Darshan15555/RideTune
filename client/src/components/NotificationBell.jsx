import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const load = async () => {
    const { data } = await api.get('/notifications');
    setItems(data);
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;

    const handler = (notification) => {
      setItems((prev) => [notification, ...prev]);
    };

    socket.on('new-notification', handler);
    return () => socket.off('new-notification', handler);
  }, []);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    setItems((prev) => prev.map((item) => (item._id === id ? { ...item, read: true } : item)));
  };

  return (
    <div className="relative">
      <button className="px-4 py-2 rounded-full border border-slate-300 bg-white" onClick={() => setOpen((prev) => !prev)}>
        🔔 {unreadCount > 0 && <span className="font-bold">{unreadCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-300 rounded-xl shadow-lg p-3 z-20 space-y-2 max-h-96 overflow-auto">
          {items.length === 0 && <p className="text-slate-500">No notifications yet.</p>}
          {items.map((item) => (
            <div key={item._id} className="border rounded-lg p-2">
              <p className="text-sm capitalize text-slate-500">{item.type}</p>
              <p>{item.message}</p>
              {!item.read && <button className="text-indigo-600 text-sm" onClick={() => markRead(item._id)}>Mark as read</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
