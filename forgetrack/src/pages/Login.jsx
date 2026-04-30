import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [isStudent, setIsStudent] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const email = isStudent ? `${identifier.toLowerCase()}@forge.local` : identifier;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // The AuthContext and RoleGuard will handle redirecting correctly
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="app-main flex items-center justify-center p-6 bg-void">
      <div className="bg-surface rounded-2xl p-12 max-w-[440px] w-full shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_var(--border-subtle)] relative overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
        
        <div className="relative z-10">
          <div className="mb-8">
            <h2 className="text-display-sm text-fg-primary">ForgeTrack</h2>
          </div>

          <div className="flex gap-2 mb-8 bg-surface-inset p-1 rounded-lg border border-border-subtle">
            <button
              type="button"
              onClick={() => setIsStudent(true)}
              className={`flex-1 py-2 rounded-md text-[13px] font-medium transition-colors ${
                isStudent ? 'bg-surface-raised text-fg-primary shadow-sm' : 'text-fg-secondary hover:text-fg-primary'
              }`}
            >
              Student Login
            </button>
            <button
              type="button"
              onClick={() => setIsStudent(false)}
              className={`flex-1 py-2 rounded-md text-[13px] font-medium transition-colors ${
                !isStudent ? 'bg-surface-raised text-fg-primary shadow-sm' : 'text-fg-secondary hover:text-fg-primary'
              }`}
            >
              Mentor Login
            </button>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-label text-fg-secondary">
                {isStudent ? 'USN' : 'EMAIL'}
              </label>
              <input
                type={isStudent ? 'text' : 'email'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isStudent ? '4SH24CS001' : 'name@example.com'}
                className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] font-[400] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
                required
              />
            </div>
            
            <div className="flex flex-col gap-2 mb-2">
              <label className="text-label text-fg-secondary">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
