import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seatsRequested: { type: Number, min: 1, max: 6, default: 1 },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'], default: 'PENDING' },
  },
  { timestamps: true }
);

requestSchema.index({ ride: 1, passenger: 1 }, { unique: true });

export default mongoose.model('Request', requestSchema);
