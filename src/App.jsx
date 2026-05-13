import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import RoleGuard from './components/RoleGuard';
import AppLayout from './layouts/AppLayout';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Forbidden from './pages/Forbidden';
import DevTokens from './pages/DevTokens';
import DevSupabase from './pages/DevSupabase';

// Mentor Pages
import Dashboard from './pages/Mentor/Dashboard';
import MarkAttendance from './pages/Mentor/MarkAttendance';
import History from './pages/Mentor/History';
import Materials from './pages/Mentor/Materials';
import UploadCsv from './pages/Mentor/UploadCsv';

// Student Pages
import MyAttendance from './pages/Student/MyAttendance';
import Upcoming from './pages/Student/Upcoming';
import StudentMaterials from './pages/Student/StudentMaterials';

function RootRedirect() {
  const { userRole, loading, session } = useAuth();
  
  if (loading) {
    return (
      <div className="app-main flex items-center justify-center">
        <div className="text-fg-secondary animate-pulse">Loading...</div>
      </div>
    );
  }
  
  if (!session) return <Navigate to="/login" replace />;
  if (userRole === 'mentor') return <Navigate to="/dashboard" replace />;
  if (userRole === 'student') {
    const requiresPasswordChange = session.user.user_metadata?.password_changed !== true;
    if (requiresPasswordChange) return <Navigate to="/change-password" replace />;
    return <Navigate to="/me/attendance" replace />;
  }
  
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<RoleGuard><ChangePassword /></RoleGuard>} />
          <Route path="/403" element={<RoleGuard><Forbidden /></RoleGuard>} />
          <Route path="/dev-tokens" element={<DevTokens />} />
          <Route path="/dev-supabase" element={<DevSupabase />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Mentor Routes */}
          <Route element={<RoleGuard allowedRole="mentor"><AppLayout /></RoleGuard>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/attendance" element={<MarkAttendance />} />
            <Route path="/history" element={<History />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/upload" element={<UploadCsv />} />
          </Route>

          {/* Student Routes */}
          <Route element={<RoleGuard allowedRole="student"><AppLayout /></RoleGuard>}>
            <Route path="/me/attendance" element={<MyAttendance />} />
            <Route path="/me/upcoming" element={<Upcoming />} />
            <Route path="/me/materials" element={<StudentMaterials />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
