import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      validate: {
        validator: (arr) => !arr || arr.length === 2,
        message: 'Coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

const rideSessionSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true, unique: true },
    roomId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    currentDriverLocation: { type: locationSchema, default: () => ({ type: 'Point', coordinates: [] }) },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

rideSessionSchema.index({ currentDriverLocation: '2dsphere' });

export default mongoose.model('RideSession', rideSessionSchema);
