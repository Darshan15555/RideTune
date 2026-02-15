import { useEffect, useState } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export default function ChatBox({ roomId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!roomId) return;

    const load = async () => {
      const { data } = await api.get(`/requests/messages/${roomId}`);
      setMessages(data);
    };

    load();

    const socket = getSocket();
    if (!socket) return;

    socket.emit('join-room', { roomId });
    const onMessage = (payload) => {
      if (payload.roomId === roomId) {
        setMessages((prev) => [...prev, payload]);
      }
    };

    socket.on('receive-message', onMessage);
    return () => socket.off('receive-message', onMessage);
  }, [roomId]);

  const sendMessage = () => {
    const socket = getSocket();
    if (!socket || !text.trim()) return;

    socket.emit('send-message', { roomId, message: text });
    setText('');
  };

  return (
    <div className="border border-slate-300 rounded-2xl p-4 space-y-3 bg-white">
      <h3 className="text-xl font-semibold">Live Chat</h3>
      <div className="h-64 overflow-auto border rounded-lg p-2 space-y-2">
        {messages.map((item) => (
          <p key={item._id || item.timestamp} className={String(item.sender) === String(user?.id) ? 'text-right' : ''}>
            <span className="inline-block px-3 py-1 rounded-full bg-slate-100">{item.message}</span>
          </p>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="soft-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type message" />
        <button className="primary-btn" onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
