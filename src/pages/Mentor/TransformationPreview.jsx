import React from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Info, 
  Table as TableIcon,
  Filter,
  FileDigit,
  Calendar,
  ChevronRight,
  Loader2
} from 'lucide-react';

export default function TransformationPreview({ records, stats, onBack, onConfirm, isLoading }) {
  // Preview first 50 records to avoid lag
  const previewData = records.slice(0, 50);

  return (
    <div className="flex flex-col gap-8">
      {/* Step Header */}
      <div>
        <h2 className="text-h2 text-fg-primary">Review Normalized Data</h2>
        <p className="text-body text-fg-secondary mt-1">
          Verify that the unpivoting and date normalization worked as expected.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface rounded-2xl border border-border-default p-6 flex items-center gap-4 shadow-sm overflow-hidden relative" style={{ backgroundImage: 'var(--card-gradient)' }}>
          <div className="w-12 h-12 rounded-xl bg-accent-glow/10 flex items-center justify-center text-accent-glow shrink-0">
            <FileDigit size={24} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-label text-fg-tertiary uppercase tracking-wider">Total Records</p>
            <p className="text-display-sm text-fg-primary font-bold tabular-nums">{stats.total.toLocaleString()}</p>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-fg-primary rotate-12">
            <FileDigit size={120} />
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-default p-6 flex items-center gap-4 shadow-sm overflow-hidden relative" style={{ backgroundImage: 'var(--card-gradient)' }}>
          <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center text-warning shrink-0">
            <Filter size={24} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-label text-fg-tertiary uppercase tracking-wider">Empty Cells Skipped</p>
            <p className="text-display-sm text-fg-primary font-bold tabular-nums">{stats.skipped.toLocaleString()}</p>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-fg-primary rotate-12">
            <Filter size={120} />
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-default p-6 flex items-center gap-4 shadow-sm overflow-hidden relative" style={{ backgroundImage: 'var(--card-gradient)' }}>
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success shrink-0">
            <Calendar size={24} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-label text-fg-tertiary uppercase tracking-wider">Format</p>
            <p className="text-h3 text-fg-primary font-bold">Standardized ISO</p>
            <p className="text-caption text-fg-tertiary">YYYY-MM-DD</p>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-fg-primary rotate-12">
            <Calendar size={120} />
          </div>
        </div>
      </div>

      {/* Main Preview Table */}
      <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden" 
           style={{ backgroundImage: 'var(--card-gradient)' }}>
        <div className="p-5 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center text-fg-tertiary">
              <TableIcon size={18} strokeWidth={1.75} />
            </div>
            <h2 className="text-h3 text-fg-primary">Candidate Records Preview</h2>
          </div>
          <div className="bg-accent-glow/5 border border-accent-glow/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Info size={14} className="text-accent-glow" />
            <span className="text-[12px] text-accent-glow font-medium">Showing first 50 records for verification</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-inset text-[11px] text-fg-tertiary uppercase tracking-wider">
                <th className="text-left p-4 font-medium border-b border-border-subtle">#</th>
                <th className="text-left p-4 font-medium border-b border-border-subtle">Student</th>
                <th className="text-left p-4 font-medium border-b border-border-subtle">Date</th>
                <th className="text-left p-4 font-medium border-b border-border-subtle text-center">Attendance</th>
                <th className="text-left p-4 font-medium border-b border-border-subtle">Source Context</th>
                <th className="text-left p-4 font-medium border-b border-border-subtle">Raw Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {previewData.length > 0 ? previewData.map((record, idx) => (
                <tr key={idx} className="hover:bg-surface-raised transition-colors group">
                  <td className="p-4 text-caption text-fg-tertiary tabular-nums font-mono">{idx + 1}</td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-body font-medium text-fg-primary truncate max-w-[200px]" title={record.student_name}>
                        {record.student_name || 'N/A'}
                      </span>
                      <span className="text-[11px] text-fg-tertiary font-mono uppercase tracking-tight">
                        {record.usn || record.email || record.admission_number || 'No Identifier'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-fg-tertiary" />
                      <span className="text-body font-mono text-fg-primary">{record.date}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider
                        ${record.present ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${record.present ? 'bg-success' : 'bg-danger'} shadow-[0_0_8px_rgba(0,0,0,0.1)]`} />
                        {record.present ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-fg-tertiary uppercase tracking-tighter">Col: {record.source_column}</span>
                      <span className="text-[11px] text-fg-tertiary uppercase tracking-tighter">Row: {record.source_row}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-[13px] text-fg-tertiary font-mono bg-surface-inset px-2 py-0.5 rounded border border-border-subtle">
                      {record.original_value}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <TableIcon size={32} className="text-fg-tertiary opacity-20" />
                      <p className="text-body text-fg-tertiary italic">
                        No records generated. Please verify your column mapping and date formats.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {records.length > 50 && (
          <div className="p-4 bg-surface-inset border-t border-border-subtle text-center">
            <p className="text-caption text-fg-tertiary">
              ... and {(records.length - 50).toLocaleString()} more records
            </p>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <button
          onClick={onBack}
          className="w-full md:w-auto bg-surface-raised border border-border-default text-fg-primary px-6 py-3 rounded-xl text-[14px] font-medium hover:bg-surface transition-all flex items-center justify-center gap-2 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Mapping
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={`w-full md:w-auto rounded-xl py-3 px-8 font-semibold text-[14px] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]
            ${isLoading 
              ? 'bg-surface-raised text-fg-tertiary border border-border-default cursor-not-allowed' 
              : 'bg-fg-primary text-void hover:bg-fg-primary/90 shadow-fg-primary/10'}`}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Cross-referencing Database...
            </>
          ) : (
            <>
              Proceed to Verification
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
