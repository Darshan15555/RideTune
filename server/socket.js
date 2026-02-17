import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import RideSession from './models/RideSession.js';
import Message from './models/Message.js';
import Notification from './models/Notification.js';
import Ride from './models/Ride.js';
import { haversineKm } from './utils/distance.js';

const liveLocations = new Map();
const locationFlushTimers = new Map();
const rideSearchSubscriptions = new Map();
const rideSearchTimers = new Map();
const simulatedDriverPositions = new Map();

async function persistLocation(sessionId) {
  const latest = liveLocations.get(sessionId);
  if (!latest) return;

  await RideSession.findByIdAndUpdate(sessionId, {
    currentDriverLocation: { type: 'Point', coordinates: [latest.longitude, latest.latitude] },
  });
}

function scheduleLocationFlush(sessionId) {
  if (locationFlushTimers.has(sessionId)) return;

  const timer = setInterval(() => {
    persistLocation(sessionId).catch(() => undefined);
  }, 10_000);

  locationFlushTimers.set(sessionId, timer);
}

async function createAndEmitNotification(io, userId, type, message) {
  const notification = await Notification.create({ user: userId, type, message });
  io.to(`user:${String(userId)}`).emit('new-notification', notification);
}

function suspiciousMovement(previous, next) {
  if (!previous) return false;
  const dLat = Math.abs(previous.latitude - next.latitude);
  const dLng = Math.abs(previous.longitude - next.longitude);
  return dLat + dLng > 0.8;
}

function toFixedNumber(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function randomStep() {
  return (Math.random() - 0.5) * 0.0016;
}

function normalizeSearchPayload(payload = {}) {
  const center = payload.center || {};
  const lat = Number(center.lat);
  const lng = Number(center.lng);

  return {
    center: Number.isNaN(lat) || Number.isNaN(lng) ? null : { lat, lng },
    radiusKm: Math.max(1, Number(payload.radiusKm || 10)),
    vehicleType: payload.vehicleType || '',
    genderPreference: payload.genderPreference || '',
  };
}

async function getNearbyDriversSnapshot(subscription = {}) {
  const now = new Date();
  const rides = await Ride.find({
    dateTime: { $gte: now },
    ...(subscription.vehicleType ? { vehicleType: subscription.vehicleType } : {}),
  })
    .populate('driver', 'name gender')
    .select('driver vehicleType startLocation');

  const drivers = [];
  for (const ride of rides) {
    const coords = ride.startLocation?.coordinates;
    if (!coords || coords.length !== 2) continue;
    const [lng, lat] = coords.map(Number);
    if ([lng, lat].some((v) => Number.isNaN(v))) continue;

    const key = String(ride.driver?._id || ride.driver);
    const previous = simulatedDriverPositions.get(key) || { lat, lng };
    const next = {
      lat: toFixedNumber(previous.lat + randomStep(), 6),
      lng: toFixedNumber(previous.lng + randomStep(), 6),
    };
    simulatedDriverPositions.set(key, next);

    if (subscription.center) {
      const distanceFromCenter = haversineKm([subscription.center.lng, subscription.center.lat], [next.lng, next.lat]);
      if (distanceFromCenter > subscription.radiusKm) continue;
    }

    const driverGender = ride.driver?.gender || 'prefer_not_say';
    if (
      subscription.genderPreference &&
      subscription.genderPreference !== 'any' &&
      subscription.genderPreference !== driverGender
    ) {
      continue;
    }

    drivers.push({
      driverId: key,
      name: ride.driver?.name || 'Driver',
      vehicleType: ride.vehicleType,
      gender: driverGender,
      lat: next.lat,
      lng: next.lng,
    });
  }

  return drivers;
}

function clearRideSearchStream(socketId) {
  const timer = rideSearchTimers.get(socketId);
  if (timer) {
    clearInterval(timer);
    rideSearchTimers.delete(socketId);
  }
  rideSearchSubscriptions.delete(socketId);
}

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || !process.env.JWT_SECRET) return next(new Error('Unauthorized'));

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
      const session = await RideSession.findOne({ roomId, $or: [{ driver: socket.user.id }, { passenger: socket.user.id }] });
      if (!session) return socket.emit('error-message', 'Not allowed to join room');
      socket.join(roomId);
    });

    socket.on('ride-search-subscribe', async (payload = {}) => {
      const normalized = normalizeSearchPayload(payload);
      if (!normalized.center) {
        socket.emit('ride-search-error', { message: 'Invalid location for live ride search' });
        return;
      }

      rideSearchSubscriptions.set(socket.id, normalized);
      clearRideSearchStream(socket.id);
      rideSearchSubscriptions.set(socket.id, normalized);

      const emitSnapshot = async () => {
        const subscription = rideSearchSubscriptions.get(socket.id);
        if (!subscription) return;

        const drivers = await getNearbyDriversSnapshot(subscription);
        socket.emit('ride-search-nearby-drivers', {
          drivers,
          updatedAt: new Date().toISOString(),
        });
      };

      await emitSnapshot();

      const timer = setInterval(() => {
        emitSnapshot().catch(() => undefined);
      }, 5000);
      rideSearchTimers.set(socket.id, timer);
    });

    socket.on('ride-search-unsubscribe', () => {
      clearRideSearchStream(socket.id);
    });

    socket.on('driver-location-update', async ({ sessionId, longitude, latitude }) => {
      const session = await RideSession.findOne({ _id: sessionId, driver: socket.user.id });
      if (!session || ['cancelled', 'completed'].includes(session.status)) {
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

      const prev = liveLocations.get(sessionId);
      if (suspiciousMovement(prev, payload)) {
        session.flaggedAsSuspicious = true;
        await session.save();
        io.to(session.roomId).emit('fraud-flag', { sessionId, reason: 'Suspicious location jump detected' });
      }

      liveLocations.set(sessionId, payload);
      scheduleLocationFlush(sessionId);
      io.to(session.roomId).emit('location-update', payload);
    });

    socket.on('typing', ({ roomId, isTyping }) => {
      socket.to(roomId).emit('typing', { roomId, userId: socket.user.id, isTyping: Boolean(isTyping) });
    });

    socket.on('send-message', async ({ roomId, message, messageType = 'text', mediaUrl = '' }) => {
      const session = await RideSession.findOne({ roomId, $or: [{ driver: socket.user.id }, { passenger: socket.user.id }] });
      if (!session) return socket.emit('error-message', 'Not allowed to send messages in this room');

      if (!String(message || '').trim() && !mediaUrl) return;

      const savedMessage = await Message.create({
        roomId,
        sender: socket.user.id,
        message: String(message || '').trim(),
        messageType,
        mediaUrl,
        readBy: [socket.user.id],
      });

      const messagePayload = {
        _id: savedMessage._id,
        roomId,
        sender: socket.user.id,
        message: savedMessage.message,
        messageType: savedMessage.messageType,
        mediaUrl: savedMessage.mediaUrl,
        timestamp: savedMessage.timestamp,
        readBy: savedMessage.readBy,
      };

      io.to(roomId).emit('receive-message', messagePayload);

      const receiverId = String(session.driver) === socket.user.id ? session.passenger : session.driver;
      await createAndEmitNotification(io, receiverId, 'message', 'You have a new message.');
    });

    socket.on('message-read', async ({ roomId, messageId }) => {
      const session = await RideSession.findOne({ roomId, $or: [{ driver: socket.user.id }, { passenger: socket.user.id }] });
      if (!session) return;

      const message = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { readBy: socket.user.id } },
        { new: true }
      );

      if (message) {
        io.to(roomId).emit('message-read', { messageId: message._id, readBy: message.readBy });
      }
    });

    socket.on('disconnect', () => {
      clearRideSearchStream(socket.id);
    });
  });

  return {
    io,
    createAndEmitNotification: (userId, type, message) => createAndEmitNotification(io, userId, type, message),
  };
}
