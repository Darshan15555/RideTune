import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function parseAuthError(error) {
  if (!error?.response) {
    return 'Unable to reach server. Please ensure backend is running and VITE_API_URL is correct.';
  }

  const { status, data } = error.response;
  const apiMessage = data?.message || (typeof data === 'string' ? data : '');
  if (apiMessage) return apiMessage;

  if (status === 404) {
    return 'Auth API route not found. Check VITE_API_URL (it should point to backend base URL).';
  }

  if (status >= 500) {
    return 'Server error during authentication. Check backend terminal logs.';
  }

  return 'Authentication failed';
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      setIsSubmitting(true);
      if (isRegister) {
        await register({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          interests: {},
        });
      } else {
        await login(form.email.trim().toLowerCase(), form.password);
      }
      navigate('/dashboard');
    } catch (e) {
      setError(parseAuthError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto glass-card p-8 space-y-5">
      <h2 className="text-5xl font-extrabold">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
      <p className="text-slate-500 text-xl">Access TuneTrip and start matching by route + interests.</p>
      <form onSubmit={submit} className="space-y-3">
        {isRegister && <input className="soft-input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
        {isRegister && <input className="soft-input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />}
        <input className="soft-input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="soft-input" placeholder="Password (min 6 chars)" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={isSubmitting} className="primary-btn w-full text-lg disabled:opacity-60 disabled:cursor-not-allowed">
          {isSubmitting ? 'Please wait...' : (isRegister ? 'Create account' : 'Login')}
        </button>
      </form>
      <button className="text-sm text-purple-700 font-semibold" onClick={() => setIsRegister((s) => !s)}>
        {isRegister ? 'Already have an account? Login' : 'No account? Register'}
      </button>
    </div>
  );
}
