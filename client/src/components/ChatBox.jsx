import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export default function ChatBox({ roomId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [fileUrl, setFileUrl] = useState('');

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

    const onTyping = ({ roomId: activeRoom, userId, isTyping }) => {
      if (activeRoom === roomId && String(userId) !== String(user?.id)) {
        setTyping(isTyping);
      }
    };

    const onRead = ({ messageId, readBy }) => {
      setMessages((prev) => prev.map((item) => (String(item._id) === String(messageId) ? { ...item, readBy } : item)));
    };

    socket.on('receive-message', onMessage);
    socket.on('typing', onTyping);
    socket.on('message-read', onRead);

    return () => {
      socket.off('receive-message', onMessage);
      socket.off('typing', onTyping);
      socket.off('message-read', onRead);
    };
  }, [roomId, user?.id]);

  const sendMessage = (messageType = 'text') => {
    const socket = getSocket();
    if (!socket) return;

    if (messageType === 'file' && !fileUrl.trim()) return;
    if (messageType === 'text' && !text.trim()) return;

    socket.emit('send-message', { roomId, message: text, messageType, mediaUrl: fileUrl });
    setText('');
    setFileUrl('');
  };

  const sortedMessages = useMemo(() => messages, [messages]);

  return (
    <div className="border border-slate-300 rounded-2xl p-4 space-y-3 bg-white">
      <h3 className="text-xl font-semibold">Live Chat</h3>
      <div className="h-64 overflow-auto border rounded-lg p-2 space-y-2">
        {sortedMessages.map((item) => {
          const mine = String(item.sender) === String(user?.id);
          return (
            <div key={item._id || item.timestamp} className={mine ? 'text-right' : ''}>
              <span className="inline-block px-3 py-1 rounded-full bg-slate-100">
                {item.messageType === 'file' && item.mediaUrl ? <a href={item.mediaUrl} target="_blank" rel="noreferrer">📎 File</a> : item.message}
              </span>
              {mine && <p className="text-[10px] text-slate-500">{(item.readBy || []).length > 1 ? 'Seen' : 'Sent'}</p>}
            </div>
          );
        })}
      </div>
      {typing && <p className="text-xs text-slate-500">Other rider is typing…</p>}
      <div className="flex gap-2">
        <input
          className="soft-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            getSocket()?.emit('typing', { roomId, isTyping: true });
          }}
          onBlur={() => getSocket()?.emit('typing', { roomId, isTyping: false })}
          placeholder="Type message"
        />
        <button className="primary-btn" onClick={() => sendMessage('text')}>Send</button>
      </div>
      <div className="flex gap-2">
        <input className="soft-input" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="Paste file/voice URL" />
        <button className="px-3 py-2 rounded-full bg-slate-700 text-white" onClick={() => sendMessage('file')}>Share File/Voice</button>
      </div>
    </div>
  );
}
