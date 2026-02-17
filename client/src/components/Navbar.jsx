import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white grid place-items-center shadow-[0_6px_20px_rgba(59,130,246,0.45)]">
        TT
      </div>
      <span className="text-4xl font-extrabold tracking-tight gradient-text">TuneTrip</span>
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <header className="bg-white/90 border-b border-slate-200 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-4">
          {user && (
            <Link
              to="/profile"
              className="px-4 py-2 rounded-full border border-slate-300 bg-white hover:bg-slate-100 font-semibold"
            >
              Profile
            </Link>
          )}
          <button className="px-3 py-1 rounded-full border" onClick={() => setDark((prev) => !prev)}>
            {dark ? 'Light' : 'Dark'}
          </button>
          {user && <NotificationBell />}
          {user && <p className="hidden md:block text-slate-500">{user.email}</p>}
          {user ? (
            <button
              className="px-6 py-2.5 rounded-full border border-slate-300 bg-slate-100 hover:bg-slate-200 font-semibold"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Logout
            </button>
          ) : (
            <Link to="/login" className="primary-btn px-8">
              Get Started
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
