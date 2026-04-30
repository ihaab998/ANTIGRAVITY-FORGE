import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    const { error } = await supabase.auth.updateUser({
      password: password,
      data: { password_changed: true }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/me/attendance', { replace: true });
    }
  };

  return (
    <div className="app-main flex items-center justify-center p-6">
      <div className="bg-surface rounded-2xl p-10 max-w-[440px] w-full shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_var(--border-subtle)] relative overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
        <div className="relative z-10">
          <h2 className="text-display-sm text-fg-primary mb-2">Change Password</h2>
          <p className="text-body text-fg-secondary mb-8">
            Please set a new password to continue.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-label text-fg-secondary">NEW PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] font-[400] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
                required
              />
            </div>
            
            <div className="flex flex-col gap-2 mb-2">
              <label className="text-label text-fg-secondary">CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] font-[400] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
                required
              />
            </div>

            {error && <div className="text-caption text-danger">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="bg-fg-primary text-void rounded-md py-3 px-5 font-body font-medium text-[14px] hover:bg-[#E5E5E7] tracking-[-0.005em] transition-colors mt-2"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
