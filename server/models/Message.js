import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, trim: true, default: '' },
  messageType: { type: String, enum: ['text', 'voice', 'file'], default: 'text' },
  mediaUrl: { type: String, default: '' },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('Message', messageSchema);
