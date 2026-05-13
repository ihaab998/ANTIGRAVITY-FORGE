import React from 'react';

export default function DevTokens() {
  return (
    <div className="app-main flex flex-col items-center justify-center p-8 gap-12">
      <h1 className="text-display-lg text-fg-primary">Design System Test</h1>
      
      <div className="bg-surface rounded-xl p-8 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_var(--border-subtle)] w-full max-w-md relative overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
        
        <div className="relative z-10 flex flex-col gap-6">
          <div>
            <h2 className="text-label text-fg-tertiary mb-2">TEST COMPONENT</h2>
            <h3 className="text-display-sm text-fg-primary">Token Verification</h3>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-label text-fg-secondary">INPUT FIELD</label>
            <input 
              type="text" 
              placeholder="Test input focus..." 
              className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] font-[400] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
            />
          </div>

          <div className="flex gap-4 items-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold tabular-nums bg-success-bg text-success border border-success-border">
              + 1.09%
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold tabular-nums bg-danger-bg text-danger border border-danger-border">
              - 4.20%
            </span>
          </div>

          <button className="bg-fg-primary text-void rounded-md py-3 px-5 font-body font-medium text-[14px] hover:bg-[#E5E5E7] tracking-[-0.005em] transition-colors mt-4">
            Primary Action
          </button>
        </div>
      </div>
    </div>
  );
}
