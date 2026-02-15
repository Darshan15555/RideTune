import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import rideRoutes from './routes/rideRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { initSocket } from './socket.js';

dotenv.config();

const app = express();
connectDB();

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

const port = process.env.PORT || 5000;
httpServer.listen(port, () => {
  console.log(`TuneTrip server running on port ${port}`);
});
