import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const fallbackAvatar =
  'https://images.unsplash.com/photo-1542204625-de293a06df5d?auto=format&fit=crop&w=600&q=80';

export default function ProfileView() {
  const { user } = useAuth();
  const { id } = useParams();
  const profileUserId = id || user?.id;

  const [profile, setProfile] = useState(null);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!profileUserId) return;
    let active = true;

    const load = async () => {
      try {
        setError('');
        const [profileRes, likesRes] = await Promise.all([
          api.get(`/profile/${profileUserId}`),
          api.get(`/profile/${profileUserId}/likes`),
        ]);
        if (!active) return;
        const loadedProfile = profileRes.data;
        setProfile(loadedProfile);
        setLikesCount(likesRes.data.likesCount || loadedProfile.likesCount || 0);
        setLiked((loadedProfile.likedBy || []).some((likedUserId) => String(likedUserId) === String(user?.id)));
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.response?.data?.message || 'Unable to load profile');
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [profileUserId, user?.id]);

  const isOwnProfile = useMemo(() => String(profileUserId) === String(user?.id), [profileUserId, user?.id]);

  const onLike = async () => {
    if (isOwnProfile || liked || isLiking) return;

    const previousLikes = likesCount;
    setLikesCount((prev) => prev + 1);
    setLiked(true);
    setIsLiking(true);
    setError('');

    try {
      const { data } = await api.put(`/profile/${profileUserId}/like`);
      setLikesCount(data.likesCount);
    } catch (likeError) {
      if (likeError?.response?.status === 409) {
        setLiked(true);
      } else {
        setLiked(false);
        setLikesCount(previousLikes);
        setError(likeError?.response?.data?.message || 'Unable to like this profile');
      }
    } finally {
      setIsLiking(false);
    }
  };

  if (error && !profile) {
    return (
      <div className="max-w-3xl mx-auto bg-white border border-red-200 rounded-2xl p-6 text-red-600">
        {error}
      </div>
    );
  }

  if (!profile) {
    return <div className="glass-card p-6 text-slate-600">Loading profile...</div>;
  }

  return (
    <section className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-40 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600" />
      <div className="px-8 pb-8 -mt-14">
        <img
          src={profile.profilePicture || fallbackAvatar}
          alt={profile.fullName}
          className="h-28 w-28 rounded-full object-cover border-4 border-white shadow-lg"
        />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">{profile.fullName}</h1>
            <p className="text-slate-500">{profile.city || 'City not added'}</p>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 font-semibold">
              <span aria-hidden>&#10084;</span>
              <span>Likes: {likesCount}</span>
            </div>
            {!isOwnProfile && (
              <button
                className="mt-3 px-5 py-2 rounded-full bg-rose-600 text-white font-semibold disabled:opacity-60"
                onClick={onLike}
                disabled={liked || isLiking}
              >
                {liked ? 'Liked' : isLiking ? 'Liking...' : 'Like'}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-slate-700 leading-relaxed">{profile.about || 'No bio added yet.'}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {(profile.interests || []).length ? (
            profile.interests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-sm text-slate-700"
              >
                {interest}
              </span>
            ))
          ) : (
            <span className="text-slate-500">No interests added</span>
          )}
        </div>

        {isOwnProfile && (
          <Link to="/profile/setup" className="inline-block mt-7 primary-btn">
            Edit Profile
          </Link>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
