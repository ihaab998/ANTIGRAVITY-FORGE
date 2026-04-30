import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RoleGuard({ children, allowedRole }) {
  const { session, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-main flex items-center justify-center">
        <div className="text-fg-secondary animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!userRole) {
    return (
      <div className="app-main flex items-center justify-center">
        <div className="text-fg-secondary animate-pulse">Verifying access...</div>
      </div>
    );
  }

  // Force password change for students on first login
  const requiresPasswordChange = userRole === 'student' && session.user.user_metadata?.password_changed !== true;

  if (requiresPasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRole && userRole !== allowedRole) {
    if (userRole === 'mentor') return <Navigate to="/dashboard" replace />;
    if (userRole === 'student') return <Navigate to="/403" replace />;
  }

  return children;
}
