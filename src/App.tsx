import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Login } from './pages/Auth/Login';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { AdminDashboard } from './pages/Admin/Admin';
import { config } from './config/env';
import './App.css';

// Guard component that redirects to /dashboard if logged in or shows Login
const AuthRoute = () => {
  const token = localStorage.getItem('accessToken');
  const user = localStorage.getItem('user');
  if (token && user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Login />;
};

function App() {
  return (
    <GoogleOAuthProvider clientId={config.googleClientId}>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<AuthRoute />} />
          <Route path="/login" element={<AuthRoute />} />
          <Route path="/signup" element={<AuthRoute />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
