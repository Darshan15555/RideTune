import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  interests: user.interests,
  education: user.education,
  workDomain: user.workDomain,
  bio: user.bio,
  travelFrequency: user.travelFrequency,
});

const buildToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server misconfiguration: missing JWT_SECRET' });
    }

    const { name, email, password, phone, interests = {}, education = '', workDomain = '', bio = '', travelFrequency = 0 } = req.body;

    const normalized = {
      name: typeof name === 'string' ? name.trim() : '',
      email: typeof email === 'string' ? email.trim().toLowerCase() : '',
      password: typeof password === 'string' ? password : '',
      phone: typeof phone === 'string' ? phone.trim() : '',
    };

    if (!normalized.name || !normalized.email || !normalized.password || !normalized.phone) {
      return res.status(400).json({ message: 'name, email, password, and phone are required' });
    }

    if (normalized.password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: normalized.email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(normalized.password, 10);
    const user = await User.create({
      name: normalized.name,
      email: normalized.email,
      password: hashedPassword,
      phone: normalized.phone,
      interests,
      education,
      workDomain,
      bio,
      travelFrequency,
    });

    const token = buildToken(user._id);

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server misconfiguration: missing JWT_SECRET' });
    }

    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = buildToken(user._id);

    return res.json({
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
