import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  BookOpen, 
  Upload, 
  UserCheck, 
  Calendar, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const mentorLinks = [
  { label: 'OVERVIEW', items: [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
  ]},
  { label: 'ACTIVITY', items: [
    { name: 'Mark Attendance', path: '/attendance', icon: CheckSquare },
    { name: 'Student History', path: '/history', icon: Users },
    { name: 'Materials', path: '/materials', icon: BookOpen },
  ]},
  { label: 'DATA', items: [
    { name: 'Upload CSV', path: '/upload', icon: Upload }
  ]}
];

const studentLinks = [
  { label: 'ACTIVITY', items: [
    { name: 'My Attendance', path: '/me/attendance', icon: UserCheck },
    { name: 'Upcoming', path: '/me/upcoming', icon: Calendar },
    { name: 'Materials', path: '/me/materials', icon: BookOpen },
  ]}
];

export default function Sidebar() {
  const { userRole, session, logout } = useAuth();
  const location = useLocation();
  
  const links = userRole === 'mentor' ? mentorLinks : studentLinks;
  const userName = session?.user?.user_metadata?.display_name || 'User';

  return (
    <div className="w-[260px] bg-canvas border-r border-border-subtle h-screen flex flex-col hidden lg:flex shrink-0">
      <div className="p-6 pb-4 flex items-center h-[72px]">
        <h1 className="text-display-sm text-fg-primary tracking-[-0.015em] leading-none">ForgeTrack</h1>
      </div>
      
      <div className="px-6 pb-6 border-b border-border-subtle mb-6">
        <p className="text-body text-fg-secondary">Welcome Back,</p>
        <p className="text-body text-fg-primary font-medium">{userName.split(' ')[0]}</p>
      </div>

      <nav className="flex-1 px-2 overflow-y-auto">
        {links.map((section, idx) => (
          <div key={idx} className="mb-6">
            <h3 className="text-label text-fg-tertiary px-4 mb-3">{section.label}</h3>
            <ul className="flex flex-col gap-1">
              {section.items.map((item, i) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <li key={i}>
                    <NavLink
                      to={item.path}
                      className={`flex items-center gap-3 px-4 h-[44px] rounded-lg transition-colors text-body ${
                        isActive 
                          ? 'bg-surface-raised text-fg-primary shadow-[inset_2px_0_0_0_var(--accent-glow)]' 
                          : 'text-fg-secondary hover:bg-surface hover:text-fg-primary'
                      }`}
                    >
                      <item.icon size={20} strokeWidth={1.75} className={isActive ? 'text-fg-primary' : 'text-fg-secondary'} />
                      {item.name}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mb-6 mt-auto">
          <h3 className="text-label text-fg-tertiary px-4 mb-3">ACCOUNT</h3>
          <ul className="flex flex-col gap-1">
            <li>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 h-[44px] rounded-lg transition-colors text-body text-fg-secondary hover:bg-surface hover:text-fg-primary"
              >
                <LogOut size={20} strokeWidth={1.75} />
                Logout
              </button>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  );
}
