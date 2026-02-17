import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    about: { type: String, default: '', trim: true, maxlength: 500 },
    city: { type: String, default: '', trim: true, maxlength: 120 },
    interests: [{ type: String, trim: true }],
    profilePicture: { type: String, default: '', trim: true },
    likesCount: { type: Number, default: 0, min: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default mongoose.model('Profile', profileSchema);
