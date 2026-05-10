import React from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  EyeOff, 
  Eye, 
  Search,
  UserPlus,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';

export default function ValidationStep({ 
  records, 
  onExclude, 
  onRestore, 
  onAcceptMatch,
  onBack,
  onConfirm 
}) {
  const [filter, setFilter] = React.useState('all'); // all | clean | warning | error | excluded
  const [search, setSearch] = React.useState('');

  const filteredRecords = records.filter(r => {
    const matchesSearch = (r.student_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (r.usn || '').toLowerCase().includes(search.toLowerCase()) ||
                          (r.email || '').toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'all') return matchesSearch && !r.isExcluded;
    if (filter === 'excluded') return matchesSearch && r.isExcluded;
    return matchesSearch && r.status === filter && !r.isExcluded;
  });

  const stats = {
    clean: records.filter(r => r.status === 'clean' && !r.isExcluded).length,
    warning: records.filter(r => r.status === 'warning' && !r.isExcluded).length,
    error: records.filter(r => r.status === 'error' && !r.isExcluded).length,
    excluded: records.filter(r => r.isExcluded).length,
  };

  const canConfirm = stats.error === 0 && (stats.clean > 0 || stats.warning > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Bar */}
      <div className="bg-surface rounded-2xl border border-border-default p-6 flex flex-wrap items-center justify-between gap-6 shadow-sm" style={{ backgroundImage: 'var(--card-gradient)' }}>
        <div className="flex items-center gap-8">
          <StatPill label="Ready" count={stats.clean} color="text-success" bg="bg-success/10" />
          <StatPill label="Warnings" count={stats.warning} color="text-warning" bg="bg-warning/10" />
          <StatPill label="Errors" count={stats.error} color="text-danger" bg="bg-danger/10" />
          <StatPill label="Excluded" count={stats.excluded} color="text-fg-tertiary" bg="bg-surface-raised" />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
            <input 
              type="text" 
              placeholder="Search USN or Name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-surface-inset border border-border-default rounded-xl text-body-sm focus:outline-none focus:border-accent-glow w-64"
            />
          </div>
          <div className="flex bg-surface-raised p-1 rounded-xl border border-border-default">
            {['all', 'clean', 'warning', 'error', 'excluded'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-label uppercase tracking-wider transition-all
                  ${filter === f ? 'bg-surface text-fg-primary shadow-sm' : 'text-fg-tertiary hover:text-fg-secondary'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-inset text-[11px] text-fg-tertiary uppercase tracking-wider">
                <th className="text-left p-4 font-medium border-b border-border-subtle">Student Details</th>
                <th className="text-left p-4 font-medium border-b border-border-subtle">Date</th>
                <th className="text-left p-4 font-medium border-b border-border-subtle">Status & Issues</th>
                <th className="text-right p-4 font-medium border-b border-border-subtle">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredRecords.length > 0 ? filteredRecords.map((record, idx) => (
                <tr key={`${record.date}-${idx}`} className={`hover:bg-surface-raised transition-colors ${record.isExcluded ? 'opacity-50' : ''}`}>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-body font-medium text-fg-primary">{record.student_name || 'N/A'}</span>
                      <span className="text-[11px] text-fg-tertiary font-mono uppercase tracking-tight">
                        {record.usn || record.email || record.admission_number || 'No Identifier'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-body-sm font-mono text-fg-secondary">{record.date}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        {record.status === 'clean' && <CheckCircle2 size={14} className="text-success" />}
                        {record.status === 'warning' && <AlertTriangle size={14} className="text-warning" />}
                        {record.status === 'error' && <AlertCircle size={14} className="text-danger" />}
                        <span className={`text-[11px] font-bold uppercase tracking-wider
                          ${record.status === 'clean' ? 'text-success' : record.status === 'warning' ? 'text-warning' : 'text-danger'}`}>
                          {record.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {record.issues.map((issue, i) => (
                          <span key={i} className="text-[10px] bg-surface-inset border border-border-subtle px-1.5 py-0.5 rounded text-fg-secondary">
                            {issue}
                          </span>
                        ))}
                      </div>
                      {/* Fuzzy Match UI */}
                      {record.status === 'error' && record.suggestedMatches?.length > 0 && (
                        <div className="mt-2 p-3 bg-accent-glow/[0.03] border border-accent-glow/10 rounded-xl flex flex-col gap-2">
                          <p className="text-[10px] text-accent-glow font-bold uppercase tracking-wider flex items-center gap-1">
                            <Search size={10} />
                            Fuzzy Matches Suggested
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {record.suggestedMatches.map(match => (
                              <button
                                key={match.id}
                                onClick={() => onAcceptMatch(record, match)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface border border-accent-glow/20 text-[10px] text-fg-primary hover:bg-accent-glow/5 transition-all active:scale-[0.95]"
                              >
                                <UserPlus size={10} className="text-accent-glow" />
                                <span>{match.name} <span className="text-fg-tertiary font-mono">({match.usn})</span></span>
                                <span className="text-[9px] bg-accent-glow text-void px-1 rounded-sm">{Math.round(match.similarity * 100)}%</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    {record.isExcluded ? (
                      <button 
                        onClick={() => onRestore(record)}
                        className="p-2 text-fg-tertiary hover:text-fg-primary transition-colors"
                        title="Restore Row"
                      >
                        <Eye size={18} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => onExclude(record)}
                        className="p-2 text-fg-tertiary hover:text-danger transition-colors"
                        title="Exclude Row"
                      >
                        <EyeOff size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="p-16 text-center text-fg-tertiary italic">
                    No records match current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <button
          onClick={onBack}
          className="w-full md:w-auto bg-surface-raised border border-border-default text-fg-primary px-6 py-3 rounded-xl text-[14px] font-medium hover:bg-surface transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Transformation
        </button>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {stats.error > 0 && (
            <div className="flex items-center gap-2 text-danger px-4 py-2 bg-danger/5 border border-danger/10 rounded-xl text-[13px] font-medium">
              <AlertCircle size={16} />
              <span>Fix or exclude {stats.error} error{stats.error !== 1 ? 's' : ''} to continue</span>
            </div>
          )}
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`w-full md:w-auto rounded-xl py-3 px-8 font-semibold text-[14px] flex items-center justify-center gap-2 transition-all shadow-lg
              ${canConfirm 
                ? 'bg-fg-primary text-void hover:bg-fg-primary/90 shadow-fg-primary/10' 
                : 'bg-surface-raised text-fg-tertiary border border-border-default shadow-none cursor-not-allowed opacity-50'}`}
          >
            Review & Finalize Import
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, count, color, bg }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center font-bold tabular-nums ${color}`}>
        {count}
      </div>
      <span className="text-[13px] font-medium text-fg-secondary">{label}</span>
    </div>
  );
}
