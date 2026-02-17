import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import rideRoutes from './routes/rideRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import userRoutes from './routes/userRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import { initSocket } from './socket.js';

dotenv.config();

const app = express();

const allowedOrigins = new Set([
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS not allowed for this origin'));
    },
  })
);

app.use(express.json());

const httpServer = http.createServer(app);
const { io, createAndEmitNotification } = initSocket(httpServer);
app.locals.io = io;
app.locals.notify = createAndEmitNotification;

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);

const port = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    httpServer.listen(port, () => {
      console.log(`TuneTrip server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
