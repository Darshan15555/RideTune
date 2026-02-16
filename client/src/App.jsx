import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
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

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/post-ride" element={<PrivateRoute><PostRide /></PrivateRoute>} />
        <Route path="/search-ride" element={<PrivateRoute><SearchRide /></PrivateRoute>} />
        <Route path="/requests" element={<PrivateRoute><Requests /></PrivateRoute>} />
        <Route path="/live-ride" element={<PrivateRoute><LiveRide /></PrivateRoute>} />
        <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />
      </Route>
    </Routes>
  );
}
