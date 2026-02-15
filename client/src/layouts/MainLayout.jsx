import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar />
      <main className="max-w-7xl w-full mx-auto px-4 py-8 flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white/70">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-slate-500">
          <p className="font-semibold gradient-text">TuneTrip</p>
          <p>© 2024 TuneTrip. Smart ride compatibility for the future.</p>
        </div>
      </footer>
    </div>
  );
}
