import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Notification from '../models/Notification.js';
import { validateObjectIdParam } from '../middleware/validateObjectId.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 });
  return res.json(notifications);
});

router.put('/:id/read', authMiddleware, validateObjectIdParam('id'), async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  return res.json(notification);
});

export default router;
