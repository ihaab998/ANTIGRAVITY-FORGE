import React from 'react';
import { CheckCircle2, Loader2, FileText, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ImportStep({ progress, summary, onReset }) {
  const navigate = useNavigate();
  const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  if (summary) {
    return (
      <div className="bg-surface rounded-2xl border border-border-default shadow-card p-10 flex flex-col items-center text-center max-w-[600px] mx-auto"
           style={{ backgroundImage: 'var(--card-gradient)' }}>
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center text-success mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-display-sm text-fg-primary">Import Successful!</h2>
        <p className="text-body text-fg-secondary mt-2 mb-8">
          Your attendance records have been successfully processed and stored.
        </p>

        <div className="grid grid-cols-2 gap-4 w-full mb-10">
          <StatBox label="Imported" value={summary.imported} color="text-success" />
          <StatBox label="Skipped / Dupes" value={summary.skipped} color="text-warning" />
          <div className="col-span-2 bg-surface-inset rounded-xl p-4 border border-border-subtle flex items-center justify-between">
            <span className="text-label text-fg-tertiary">Source File</span>
            <span className="text-body-sm font-medium text-fg-primary max-w-[300px] truncate" title={summary.filename}>{summary.filename}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => navigate('/mentor/history')}
            className="w-full bg-fg-primary text-void rounded-xl py-3 px-6 font-semibold text-[14px] flex items-center justify-center gap-2 hover:bg-fg-primary/90 transition-all shadow-lg"
          >
            <FileText size={16} />
            View Attendance History
          </button>
          <button
            onClick={onReset}
            className="w-full bg-surface-raised border border-border-default text-fg-primary rounded-xl py-3 px-6 font-medium text-[14px] flex items-center justify-center gap-2 hover:bg-surface transition-all"
          >
            <ArrowRight size={16} />
            Upload Another File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-border-default shadow-card p-10 flex flex-col items-center text-center max-w-[600px] mx-auto"
         style={{ backgroundImage: 'var(--card-gradient)' }}>
      <div className="w-16 h-16 rounded-full bg-accent-glow/10 flex items-center justify-center text-accent-glow mb-6 animate-pulse">
        <Loader2 size={32} className="animate-spin" />
      </div>
      <h2 className="text-display-sm text-fg-primary">Importing Data...</h2>
      <p className="text-body text-fg-secondary mt-2 mb-8">
        Please stay on this page while we securely write the records to the database.
      </p>

      <div className="w-full mb-6">
        <div className="flex justify-between text-caption mb-2">
          <span className="text-fg-tertiary">Progress: {progress.processed} / {progress.total}</span>
          <span className="text-accent-glow font-bold tabular-nums">{percentage}%</span>
        </div>
        <div className="h-3 w-full bg-surface-inset rounded-full overflow-hidden border border-border-subtle shadow-inner">
          <div 
            className="h-full bg-accent-glow transition-all duration-300 shadow-[0_0_12px_rgba(99,102,241,0.5)]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full text-left">
        <div className="bg-surface-inset rounded-xl p-4 border border-border-subtle">
          <p className="text-label text-fg-tertiary mb-1">Success</p>
          <p className="text-h3 text-success font-bold tabular-nums">{progress.success}</p>
        </div>
        <div className="bg-surface-inset rounded-xl p-4 border border-border-subtle">
          <p className="text-label text-fg-tertiary mb-1">Skipped</p>
          <p className="text-h3 text-warning font-bold tabular-nums">{progress.skipped}</p>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="bg-surface-inset rounded-xl p-5 border border-border-subtle flex flex-col items-center">
      <p className="text-label text-fg-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-display-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
