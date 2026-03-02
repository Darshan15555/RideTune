import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function parseInterests(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProfileForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    about: '',
    city: '',
    interests: '',
    profilePicture: '',
  });

  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    const load = async () => {
      try {
        const { data } = await api.get(`/profile/${user.id}`);
        if (!active) return;
        setForm({
          fullName: data.fullName || user.name || '',
          phone: data.phone || user.phone || '',
          email: data.email || user.email || '',
          about: data.about || '',
          city: data.city || '',
          interests: (data.interests || []).join(', '),
          profilePicture: data.profilePicture || '',
        });
      } catch (loadError) {
        if (!active) return;
        setForm((prev) => ({
          ...prev,
          fullName: user.name || '',
          phone: user.phone || '',
          email: user.email || '',
        }));
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [user?.id, user?.email, user?.name, user?.phone]);

  const canSubmit = useMemo(
    () => form.fullName.trim() && form.phone.trim() && !isSaving,
    [form.fullName, form.phone, isSaving]
  );

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      setIsSaving(true);
      await api.post('/profile', {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        about: form.about.trim(),
        city: form.city.trim(),
        interests: parseInterests(form.interests),
        profilePicture: form.profilePicture.trim(),
      });
      navigate('/profile');
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Fill Your Profile</h1>
        <p className="text-slate-600 mt-2">Complete your details so riders can discover and like your profile.</p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <input
            className="soft-input"
            placeholder="Full Name"
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            required
          />
          <input
            className="soft-input"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            required
          />
          <input
            className="soft-input bg-slate-100 text-slate-500"
            placeholder="Email"
            value={form.email}
            disabled
          />
          <textarea
            className="soft-input min-h-28"
            placeholder="About"
            value={form.about}
            onChange={(e) => setForm((prev) => ({ ...prev, about: e.target.value }))}
          />
          <input
            className="soft-input"
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
          />
          <input
            className="soft-input"
            placeholder="Interests (comma separated)"
            value={form.interests}
            onChange={(e) => setForm((prev) => ({ ...prev, interests: e.target.value }))}
          />
          <input
            className="soft-input"
            placeholder="Profile picture URL"
            value={form.profilePicture}
            onChange={(e) => setForm((prev) => ({ ...prev, profilePicture: e.target.value }))}
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button className="primary-btn w-full disabled:opacity-60" disabled={!canSubmit}>
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </section>
  );
}
