import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      if (isRegister) {
        await register({ ...form, interests: {} });
      } else {
        await login(form.email, form.password);
      }
      navigate('/dashboard');
    } catch (e) {
      setError(e.response?.data?.message || 'Authentication failed');
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
        <input className="soft-input" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="primary-btn w-full text-lg">{isRegister ? 'Create account' : 'Login'}</button>
      </form>
      <button className="text-sm text-purple-700 font-semibold" onClick={() => setIsRegister((s) => !s)}>
        {isRegister ? 'Already have an account? Login' : 'No account? Register'}
      </button>
    </div>
  );
}
