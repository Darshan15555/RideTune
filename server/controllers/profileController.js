import Profile from '../models/Profile.js';
import User from '../models/User.js';

function sanitizeInterests(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function toProfileResponse(profile) {
  return {
    id: profile._id,
    userId: profile.userId,
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    about: profile.about,
    city: profile.city,
    interests: profile.interests || [],
    profilePicture: profile.profilePicture,
    likesCount: profile.likesCount || 0,
    likedBy: profile.likedBy || [],
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function upsertProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select('name phone email');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized user' });
    }

    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const about = typeof req.body.about === 'string' ? req.body.about.trim() : '';
    const city = typeof req.body.city === 'string' ? req.body.city.trim() : '';
    const profilePicture = typeof req.body.profilePicture === 'string' ? req.body.profilePicture.trim() : '';
    const interests = sanitizeInterests(req.body.interests);

    if (!fullName) return res.status(400).json({ message: 'fullName is required' });
    if (!phone) return res.status(400).json({ message: 'phone is required' });

    // Upsert keeps profile creation and update in a single endpoint.
    const profile = await Profile.findOneAndUpdate(
      { userId: req.user.id },
      {
        userId: req.user.id,
        fullName,
        phone,
        email: user.email,
        about,
        city,
        interests,
        profilePicture,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json(toProfileResponse(profile));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getProfileByUserId(req, res) {
  try {
    const profile = await Profile.findOne({ userId: req.params.id }).lean();
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    return res.json(toProfileResponse(profile));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function likeProfile(req, res) {
  try {
    const likerId = req.user.id;
    const targetUserId = req.params.id;

    if (String(likerId) === String(targetUserId)) {
      return res.status(400).json({ message: 'You cannot like your own profile' });
    }

    const profile = await Profile.findOne({ userId: targetUserId });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Prevent duplicate likes by storing liker ids.
    const alreadyLiked = profile.likedBy.some((id) => String(id) === String(likerId));
    if (alreadyLiked) {
      return res.status(409).json({ message: 'You already liked this profile' });
    }

    profile.likedBy.push(likerId);
    profile.likesCount = profile.likedBy.length;
    await profile.save();

    return res.json({
      message: 'Profile liked successfully',
      likesCount: profile.likesCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getProfileLikes(req, res) {
  try {
    const profile = await Profile.findOne({ userId: req.params.id }).select('likesCount likedBy');
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    return res.json({
      userId: req.params.id,
      likesCount: profile.likesCount || profile.likedBy.length || 0,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
