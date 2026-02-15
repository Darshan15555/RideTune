import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr) => arr.length === 2,
        message: 'Coordinates must be [longitude, latitude]'
      }
    },
    name: { type: String, required: true }
  },
  { _id: false }
);

const rideSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startLocation: { type: pointSchema, required: true },
    endLocation: { type: pointSchema, required: true },
    dateTime: { type: Date, required: true },
    vehicleType: { type: String, enum: ['Car', 'Bike'], required: true },
    seatsAvailable: { type: Number, min: 1, required: true },
  },
  { timestamps: true }
);

rideSchema.index({ 'startLocation.coordinates': '2dsphere' });
rideSchema.index({ 'endLocation.coordinates': '2dsphere' });

export default mongoose.model('Ride', rideSchema);
