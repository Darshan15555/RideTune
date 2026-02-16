import mongoose from 'mongoose';

const rideStatusEventSchema = new mongoose.Schema(
  {
    rideSession: { type: mongoose.Schema.Types.ObjectId, ref: 'RideSession', required: true, index: true },
    status: {
      type: String,
      enum: ['searching', 'matched', 'driver_accepted', 'on_the_way', 'started', 'completed', 'cancelled'],
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model('RideStatusEvent', rideStatusEventSchema);
