import React from 'react';
import {
  Brain,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  ALLOWED_TARGET_FIELDS,
  TARGET_FIELD_LABELS,
  DATE_FORMATS,
  ATTENDANCE_CONVENTIONS,
} from '../../lib/csvMappingAgent';

export default function ColumnMappingStep({
  headers,
  previewRows,
  // AI state
  mappingLoading,
  mappingError,
  aiMapping,
  // Confirmed (user-editable) state
  confirmedMapping,
  isPivoted,
  dateFormat,
  attendanceConvention,
  dateColumns,
  // Callbacks
  onMappingChange,
  onIsPivotedChange,
  onDateFormatChange,
  onAttendanceConventionChange,
  onRetryAI,
}) {
  // ── Loading state ──
  if (mappingLoading) {
    return (
      <div className="bg-surface rounded-2xl border border-border-default shadow-card p-10 flex flex-col items-center gap-5"
           style={{ backgroundImage: 'var(--card-gradient)' }}>
        <div className="w-14 h-14 rounded-full bg-accent-glow/10 flex items-center justify-center animate-pulse">
          <Brain size={26} className="text-accent-glow" strokeWidth={1.75} />
        </div>
        <div className="text-center">
          <p className="text-h3 text-fg-primary">Analyzing your file…</p>
          <p className="text-body text-fg-secondary mt-1">
            Gemini is detecting column mappings, date formats, and layout type.
          </p>
        </div>
      </div>
    );
  }

  // ── Error / fallback state ──
  if (mappingError && !aiMapping) {
    const isRateLimit = mappingError === 'AI_RATE_LIMIT';

    return (
      <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden"
           style={{ backgroundImage: 'var(--card-gradient)' }}>
        <div className="p-6 border-b border-border-subtle flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-warning" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="text-h3 text-fg-primary">
              {isRateLimit ? 'AI mapping is temporarily rate-limited' : 'AI mapping failed'}
            </p>
            <p className="text-body-sm text-fg-secondary mt-1">
              {isRateLimit 
                ? 'The AI quota has been reached. You can try again in a few minutes or continue with manual mapping below.' 
                : mappingError}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onRetryAI}
              className="bg-surface-raised border border-border-default text-fg-primary px-4 py-2 rounded-md text-[13px] font-medium hover:bg-surface transition-colors flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Retry
            </button>
            {isRateLimit && (
              <div className="text-[13px] text-fg-tertiary px-3 py-2 border border-dashed border-border-subtle rounded-md bg-surface-inset">
                Continue Manual Mapping Below
              </div>
            )}
          </div>
        </div>
        {/* Manual mapping table below */}
        <MappingTable
          headers={headers}
          previewRows={previewRows}
          confirmedMapping={confirmedMapping}
          onMappingChange={onMappingChange}
          aiMapping={null}
        />
      </div>
    );
  }

  // ── Normal state (AI mapping loaded or manual) ──
  return (
    <div className="flex flex-col gap-6">

      {/* Soft warning if AI had partial issues */}
      {mappingError && aiMapping && (
        <div className="bg-warning/[0.06] border border-warning/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-body-sm text-warning">{mappingError} — AI mapping shown below may need review.</p>
        </div>
      )}

      {/* Detected Metadata Pills */}
      <div className="bg-surface rounded-2xl border border-border-default shadow-card p-6"
           style={{ backgroundImage: 'var(--card-gradient)' }}>
        <div className="flex items-center gap-2 mb-5">
          <Brain size={16} className="text-accent-glow" strokeWidth={1.75} />
          <h2 className="text-h3 text-fg-primary">Detected File Properties</h2>
          <span className="ml-auto text-caption text-fg-tertiary">Click to adjust</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Pivoted Layout toggle */}
          <div className="bg-surface-inset rounded-xl border border-border-default p-4">
            <p className="text-label text-fg-tertiary uppercase mb-2">Layout</p>
            <button
              onClick={() => onIsPivotedChange(!isPivoted)}
              className="flex items-center gap-2 text-fg-primary hover:text-fg-secondary transition-colors"
            >
              {isPivoted
                ? <ToggleRight size={22} className="text-accent-glow" />
                : <ToggleLeft size={22} className="text-fg-tertiary" />}
              <span className="text-body font-medium">
                {isPivoted ? 'Pivoted (dates as columns)' : 'Standard (one date column)'}
              </span>
            </button>
            {isPivoted && dateColumns.length > 0 && (
              <p className="text-caption text-fg-tertiary mt-2">
                {dateColumns.length} date column{dateColumns.length !== 1 ? 's' : ''} detected
              </p>
            )}
          </div>

          {/* Date Format selector */}
          <div className="bg-surface-inset rounded-xl border border-border-default p-4">
            <p className="text-label text-fg-tertiary uppercase mb-2">Date Format</p>
            <div className="relative">
              <select
                value={dateFormat}
                onChange={(e) => onDateFormatChange(e.target.value)}
                className="w-full bg-transparent text-fg-primary text-body font-medium appearance-none pr-6 outline-none cursor-pointer"
              >
                {DATE_FORMATS.map(f => (
                  <option key={f} value={f} className="bg-surface-raised">{f}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-fg-tertiary pointer-events-none" />
            </div>
          </div>

          {/* Attendance Convention selector */}
          <div className="bg-surface-inset rounded-xl border border-border-default p-4">
            <p className="text-label text-fg-tertiary uppercase mb-2">Attendance Values</p>
            <div className="relative">
              <select
                value={attendanceConvention}
                onChange={(e) => onAttendanceConventionChange(e.target.value)}
                className="w-full bg-transparent text-fg-primary text-body font-medium appearance-none pr-6 outline-none cursor-pointer"
              >
                {ATTENDANCE_CONVENTIONS.map(c => (
                  <option key={c} value={c} className="bg-surface-raised">{c}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-fg-tertiary pointer-events-none" />
            </div>
          </div>

        </div>
      </div>

      {/* Column Mapping Table */}
      <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden"
           style={{ backgroundImage: 'var(--card-gradient)' }}>
        <div className="p-5 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-h3 text-fg-primary">Column Mapping</h2>
          <span className="text-caption text-fg-tertiary">
            {aiMapping ? 'Pre-filled by AI — override any mapping below' : 'Map each column manually'}
          </span>
        </div>
        <MappingTable
          headers={headers}
          previewRows={previewRows}
          confirmedMapping={confirmedMapping}
          onMappingChange={onMappingChange}
          aiMapping={aiMapping}
        />
      </div>

    </div>
  );
}

// ── Internal: mapping table rows ──
function MappingTable({ headers, previewRows, confirmedMapping, onMappingChange, aiMapping }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-inset">
            <th className="text-left p-4 font-medium text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle w-[220px]">
              Source Column
            </th>
            <th className="text-left p-4 font-medium text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle">
              Sample Values
            </th>
            <th className="text-left p-4 font-medium text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle w-[220px]">
              Maps To
            </th>
          </tr>
        </thead>
        <tbody>
          {headers.map((header, idx) => {
            const currentVal = confirmedMapping[header] || 'IGNORE';
            const isIgnored = currentVal === 'IGNORE';
            const isDate = currentVal === 'date';
            const sampleVals = previewRows
              .map(r => r[header])
              .filter(v => v !== undefined && v !== null && v !== '')
              .slice(0, 3)
              .map(v => String(v));

            return (
              <tr key={idx} className={`transition-colors ${isIgnored ? 'opacity-50' : 'hover:bg-surface-raised'}`}>
                {/* Source column */}
                <td className="p-4 border-b border-border-subtle">
                  <span className="text-body font-mono text-fg-primary">{header}</span>
                  {aiMapping && aiMapping.mapping?.[header] && (
                    <span className="ml-2 text-[10px] text-accent-glow bg-accent-glow/10 border border-accent-glow/20 rounded-full px-2 py-0.5">
                      AI
                    </span>
                  )}
                </td>

                {/* Sample values */}
                <td className="p-4 border-b border-border-subtle">
                  <div className="flex flex-wrap gap-1">
                    {sampleVals.length > 0 ? sampleVals.map((v, i) => (
                      <span key={i} className={`text-[11px] px-2 py-0.5 rounded font-mono
                        ${isDate ? 'bg-accent-glow/10 text-accent-glow border border-accent-glow/20'
                          : 'bg-surface-inset text-fg-secondary border border-border-subtle'}`}>
                        {v}
                      </span>
                    )) : (
                      <span className="text-caption text-fg-tertiary italic">no sample data</span>
                    )}
                  </div>
                </td>

                {/* Target field dropdown */}
                <td className="p-4 border-b border-border-subtle">
                  <div className="relative">
                    <select
                      value={currentVal}
                      onChange={(e) => onMappingChange(header, e.target.value)}
                      className={`w-full bg-surface-inset border rounded-md px-3 py-2 text-[13px] font-medium
                        appearance-none pr-8 outline-none cursor-pointer transition-colors
                        focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)]
                        ${isIgnored
                          ? 'border-border-subtle text-fg-tertiary'
                          : 'border-border-default text-fg-primary'
                        }`}
                    >
                      {ALLOWED_TARGET_FIELDS.map(field => (
                        <option key={field} value={field} className="bg-surface-raised">
                          {TARGET_FIELD_LABELS[field]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary pointer-events-none" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
