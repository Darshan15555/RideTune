import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../middleware/validateObjectId.js';
import {
  getProfileByUserId,
  getProfileLikes,
  likeProfile,
  upsertProfile,
} from '../controllers/profileController.js';

const router = express.Router();

router.post('/', authMiddleware, upsertProfile);
router.get('/:id', authMiddleware, validateObjectIdParam('id'), getProfileByUserId);
router.put('/:id/like', authMiddleware, validateObjectIdParam('id'), likeProfile);
router.get('/:id/likes', authMiddleware, validateObjectIdParam('id'), getProfileLikes);

export default router;
