import mongoose from 'mongoose';

const interestSchema = new mongoose.Schema(
  {
    music: [{ type: String }],
    movies: [{ type: String }],
    anime: [{ type: String }],
    field: [{ type: String }],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    interests: { type: interestSchema, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
