import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Forbidden() {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (userRole === 'mentor') {
      navigate('/dashboard', { replace: true });
    } else if (userRole === 'student') {
      navigate('/me/attendance', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="app-main flex items-center justify-center p-6 bg-void">
      <div className="text-center">
        <h1 className="text-display-hero text-fg-tertiary mb-4">403</h1>
        <h2 className="text-h2 text-fg-primary mb-2">You don't have access</h2>
        <p className="text-body text-fg-secondary mb-8">
          You are not authorized to view this page based on your current role.
        </p>
        <button
          onClick={handleGoBack}
          className="bg-surface-raised border border-border-default text-fg-primary rounded-md py-3 px-6 font-body font-medium text-[14px] hover:bg-surface transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
