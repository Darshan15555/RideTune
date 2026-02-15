import { io } from 'socket.io-client';

let socket;

function buildSocketUrl() {
  const raw = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim();
  return raw.replace(/\/api\/?$/, '');
}

export function connectSocket(token) {
  if (!token) return null;
  if (socket?.connected) return socket;

  socket = io(buildSocketUrl(), {
    auth: { token },
    transports: ['websocket'],
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
