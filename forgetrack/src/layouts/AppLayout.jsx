import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

export default function AppLayout() {
  return (
    <div className="app-main flex h-screen overflow-hidden text-fg-primary bg-void">
      <Sidebar />
      <div className="flex-1 flex flex-col relative overflow-hidden bg-canvas">
        <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none" style={{ backgroundImage: 'var(--glow-cosmic)' }}></div>
        
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-12 relative z-10">
          <div className="max-w-[1440px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
