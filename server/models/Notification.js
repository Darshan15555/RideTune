import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'RIDE_REQUEST',
        'REQUEST_ACCEPTED',
        'REQUEST_REJECTED',
        'MESSAGE',
        'STATUS',
        'SOS',
        'REVIEW',
      ],
      required: true,
    },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    message: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('Notification', notificationSchema);
