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

const ageRangeSchema = new mongoose.Schema(
  {
    minAge: { type: Number, default: 18 },
    maxAge: { type: Number, default: 99 },
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
    education: { type: String, default: '' },
    workDomain: { type: String, default: '' },
    workType: { type: String, enum: ['remote', 'hybrid', 'onsite', 'other'], default: 'other' },
    bio: { type: String, default: '' },
    travelFrequency: { type: Number, min: 0, default: 0 },
    smokingPreference: { type: String, enum: ['smoker', 'non-smoker', 'any'], default: 'any' },
    conversationStyle: { type: String, enum: ['chatty', 'quiet', 'balanced'], default: 'balanced' },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_say'], default: 'prefer_not_say' },
    genderPreference: { type: String, enum: ['male', 'female', 'other', 'any'], default: 'any' },
    age: { type: Number, min: 18, max: 99, default: 21 },
    ageRange: { type: ageRangeSchema, default: () => ({}) },
    travelPurpose: { type: String, enum: ['work', 'study', 'leisure', 'mixed'], default: 'mixed' },
    emergencyContacts: [{ name: String, phone: String }],
    ratingAverage: { type: Number, min: 0, max: 5, default: 0 },
    totalReviews: { type: Number, min: 0, default: 0 },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    totalRatings: { type: Number, min: 0, default: 0 },
    fraudFlags: { type: Number, min: 0, default: 0 },
    cancelledRidesCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
