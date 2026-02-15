import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import RideSession from './models/RideSession.js';
import Message from './models/Message.js';
import Notification from './models/Notification.js';

const liveLocations = new Map();
const locationFlushTimers = new Map();

async function persistLocation(sessionId) {
  const latest = liveLocations.get(sessionId);
  if (!latest) return;

  await RideSession.findByIdAndUpdate(sessionId, {
    currentDriverLocation: {
      type: 'Point',
      coordinates: [latest.longitude, latest.latitude],
    },
  });
}

function scheduleLocationFlush(sessionId) {
  if (locationFlushTimers.has(sessionId)) {
    return;
  }

  const timer = setInterval(() => {
    persistLocation(sessionId).catch(() => undefined);
  }, 10_000);

  locationFlushTimers.set(sessionId, timer);
}

function stopLocationFlush(sessionId) {
  const timer = locationFlushTimers.get(sessionId);
  if (!timer) return;
  clearInterval(timer);
  locationFlushTimers.delete(sessionId);
}

async function createAndEmitNotification(io, userId, type, message) {
  const notification = await Notification.create({ user: userId, type, message });
  io.to(`user:${String(userId)}`).emit('new-notification', notification);
}

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || !process.env.JWT_SECRET) {
      return next(new Error('Unauthorized'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id };
      return next();
    } catch (_error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);

    socket.on('join-room', async ({ roomId }) => {
      const session = await RideSession.findOne({
        roomId,
        $or: [{ driver: socket.user.id }, { passenger: socket.user.id }],
      });

      if (!session) {
        socket.emit('error-message', 'Not allowed to join room');
        return;
      }

      socket.join(roomId);
    });

    socket.on('driver-location-update', async ({ sessionId, longitude, latitude }) => {
      const session = await RideSession.findOne({ _id: sessionId, driver: socket.user.id, status: 'active' });
      if (!session) {
        socket.emit('error-message', 'Invalid ride session');
        return;
      }

      const payload = {
        sessionId,
        longitude: Number(longitude),
        latitude: Number(latitude),
        updatedAt: new Date().toISOString(),
      };

      if (Number.isNaN(payload.longitude) || Number.isNaN(payload.latitude)) {
        socket.emit('error-message', 'Invalid coordinates');
        return;
      }

      liveLocations.set(sessionId, payload);
      scheduleLocationFlush(sessionId);
      io.to(`user:${String(session.passenger)}`).emit('location-update', payload);
    });

    socket.on('send-message', async ({ roomId, message }) => {
      if (!message || typeof message !== 'string' || !message.trim()) return;

      const session = await RideSession.findOne({
        roomId,
        $or: [{ driver: socket.user.id }, { passenger: socket.user.id }],
      });

      if (!session) {
        socket.emit('error-message', 'Not allowed to send messages in this room');
        return;
      }

      const savedMessage = await Message.create({ roomId, sender: socket.user.id, message: message.trim() });
      const messagePayload = {
        _id: savedMessage._id,
        roomId,
        sender: socket.user.id,
        message: savedMessage.message,
        timestamp: savedMessage.timestamp,
      };

      io.to(roomId).emit('receive-message', messagePayload);

      const receiverId = String(session.driver) === socket.user.id ? session.passenger : session.driver;
      await createAndEmitNotification(io, receiverId, 'message', 'You have a new message.');
    });

    socket.on('disconnect', () => {
      // No-op: active sessions may still have other participants connected.
    });
  });

  return {
    io,
    createAndEmitNotification: (userId, type, message) => createAndEmitNotification(io, userId, type, message),
  };
}
