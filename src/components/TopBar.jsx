import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Search } from 'lucide-react';

export default function TopBar() {
  const { session } = useAuth();
  const location = useLocation();
  const userName = session?.user?.user_metadata?.display_name || 'User';
  const initial = userName.charAt(0).toUpperCase();

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Overview / Dashboard';
    if (path.includes('attendance') && !path.includes('me')) return 'Activity / Mark Attendance';
    if (path.includes('history')) return 'Activity / Student History';
    if (path.includes('materials') && !path.includes('me')) return 'Activity / Materials';
    if (path.includes('upload')) return 'Data / Upload CSV';
    if (path.includes('me/attendance')) return 'Activity / My Attendance';
    if (path.includes('me/upcoming')) return 'Activity / Upcoming';
    if (path.includes('me/materials')) return 'Activity / Materials';
    return 'Overview';
  };

  return (
    <header className="h-[72px] px-6 lg:px-12 flex items-center justify-between shrink-0 relative z-10 border-b border-border-subtle lg:border-none">
      <div className="text-body text-fg-secondary">
        {getBreadcrumb()}
      </div>

      <div className="flex items-center gap-6">
        <div className="relative hidden md:block">
          <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="bg-surface-inset border border-border-default rounded-md pl-9 pr-4 py-2 h-[36px] text-[13px] text-fg-primary placeholder-fg-tertiary focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none w-[240px]"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-body-sm text-fg-primary hidden sm:block">{userName}</span>
          <div className="w-8 h-8 rounded-full bg-surface-raised border border-border-default flex items-center justify-center text-body-sm font-semibold text-fg-primary">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
