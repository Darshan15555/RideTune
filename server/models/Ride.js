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
    pickupLocation: { type: pointSchema },
    dropLocation: { type: pointSchema },
    stops: { type: [pointSchema], default: [] },
    date: { type: String, required: true },
    time: { type: String, required: true },
    dateTime: { type: Date, required: true },
    vehicleType: { type: String, enum: ['Car', 'Bike', 'SUV'], required: true },
    seatsAvailable: { type: Number, min: 1, max: 6, required: true },
    pricePerSeat: { type: Number, min: 0, required: true },
    luggageAllowed: { type: Boolean, default: false },
    genderPreference: { type: String, enum: ['any', 'male', 'female'], default: 'any' },
    musicPreference: {
      type: [
        {
          type: String,
          enum: ['Pop', 'Classical', 'Bollywood', 'Rock', 'Jazz', 'Hip Hop', 'EDM', 'No Preference'],
        },
      ],
      default: [],
    },
    allowPreRideChat: { type: Boolean, default: true },
    totalFuelCost: { type: Number, min: 0, default: 0 },
    tollCharges: { type: Number, min: 0, default: 0 },
    distanceKm: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

rideSchema.pre('validate', function deriveDateTime(next) {
  if (!this.pickupLocation && this.startLocation) this.pickupLocation = this.startLocation;
  if (!this.dropLocation && this.endLocation) this.dropLocation = this.endLocation;
  if (!this.startLocation && this.pickupLocation) this.startLocation = this.pickupLocation;
  if (!this.endLocation && this.dropLocation) this.endLocation = this.dropLocation;

  if (this.date && this.time && !this.dateTime) {
    const composed = new Date(`${this.date}T${this.time}:00`);
    if (!Number.isNaN(composed.getTime())) {
      this.dateTime = composed;
    }
  }

  if (this.dateTime && (!this.date || !this.time)) {
    const iso = new Date(this.dateTime).toISOString();
    this.date = this.date || iso.slice(0, 10);
    this.time = this.time || iso.slice(11, 16);
  }

  next();
});

rideSchema.index({ 'startLocation.coordinates': '2dsphere' });
rideSchema.index({ 'endLocation.coordinates': '2dsphere' });
rideSchema.index({ startLocation: '2dsphere' });
rideSchema.index({ endLocation: '2dsphere' });
rideSchema.index({ pickupLocation: '2dsphere' });
rideSchema.index({ dropLocation: '2dsphere' });

export default mongoose.model('Ride', rideSchema);
