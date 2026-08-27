import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Login } from './pages/Auth/Login'
import { Signup } from './pages/Auth/Signup'
import { Dashboard } from './pages/Dashboard/Dashboard'
import { AdminDashboard } from './pages/Admin/Admin'
import { config } from './config/env'
import './App.css'

function App() {
  return (
    <GoogleOAuthProvider clientId={config.googleClientId}>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  )
}

export default App
