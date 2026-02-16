import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    rideSession: { type: mongoose.Schema.Types.ObjectId, ref: 'RideSession', required: true },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

reviewSchema.index({ rideSession: 1, reviewer: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);
