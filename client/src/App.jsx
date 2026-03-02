import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import api from './services/api';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PostRide from './pages/PostRide';
import SearchRide from './pages/SearchRide';
import Requests from './pages/Requests';
import LiveRide from './pages/LiveRide';
import ChatPage from './pages/ChatPage';
import History from './pages/History';
import MyRides from './pages/MyRides';
import MyRequests from './pages/MyRequests';
import ProfileForm from './components/ProfileForm';
import ProfileView from './components/ProfileView';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function RequireProfile({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState({ checking: true, exists: false });

  useEffect(() => {
    let active = true;

    const checkProfile = async () => {
      if (!user?.id) {
        if (active) setStatus({ checking: false, exists: false });
        return;
      }

      try {
        await api.get(`/profile/${user.id}`);
        if (active) setStatus({ checking: false, exists: true });
      } catch (error) {
        if (error?.response?.status === 404) {
          if (active) setStatus({ checking: false, exists: false });
          return;
        }
        if (active) setStatus({ checking: false, exists: true });
      }
    };

    setStatus({ checking: true, exists: false });
    checkProfile();

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (status.checking) {
    return <div className="glass-card p-6 text-slate-600">Checking profile...</div>;
  }

  if (!status.exists) {
    return <Navigate to="/profile/setup" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile/setup" element={<PrivateRoute><ProfileForm /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><RequireProfile><ProfileView /></RequireProfile></PrivateRoute>} />
        <Route path="/profile/:id" element={<PrivateRoute><RequireProfile><ProfileView /></RequireProfile></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><RequireProfile><Dashboard /></RequireProfile></PrivateRoute>} />
        <Route path="/post-ride" element={<PrivateRoute><RequireProfile><PostRide /></RequireProfile></PrivateRoute>} />
        <Route path="/search-ride" element={<PrivateRoute><RequireProfile><SearchRide /></RequireProfile></PrivateRoute>} />
        <Route path="/my-rides" element={<PrivateRoute><RequireProfile><MyRides /></RequireProfile></PrivateRoute>} />
        <Route path="/my-requests" element={<PrivateRoute><RequireProfile><MyRequests /></RequireProfile></PrivateRoute>} />
        <Route path="/requests" element={<PrivateRoute><RequireProfile><Requests /></RequireProfile></PrivateRoute>} />
        <Route path="/live-ride" element={<PrivateRoute><RequireProfile><LiveRide /></RequireProfile></PrivateRoute>} />
        <Route path="/chat" element={<PrivateRoute><RequireProfile><ChatPage /></RequireProfile></PrivateRoute>} />
        <Route path="/history" element={<PrivateRoute><RequireProfile><History /></RequireProfile></PrivateRoute>} />
      </Route>
    </Routes>
  );
}
