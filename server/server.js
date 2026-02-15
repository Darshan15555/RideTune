import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import rideRoutes from './routes/rideRoutes.js';
import requestRoutes from './routes/requestRoutes.js';

dotenv.config();

const app = express();
connectDB();

app.use(cors({ origin: process.env.CLIENT_URL || '*'}));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/requests', requestRoutes);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`TuneTrip server running on port ${port}`);
});
