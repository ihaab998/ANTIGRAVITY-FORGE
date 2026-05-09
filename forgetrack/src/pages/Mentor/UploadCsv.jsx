import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Trash2,
  FileUp,
  Table,
  Columns3,
  HardDrive,
  Rows3,
  ChevronLeft,
} from 'lucide-react';
import { getColumnMapping } from '../../lib/csvMappingAgent';
import ColumnMappingStep from './ColumnMappingStep';

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const PREVIEW_ROW_COUNT = 5;

// Step definitions
const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Map Columns' },
  { id: 3, label: 'Validate' },
  { id: 4, label: 'Import' },
];

// Helpers
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileExtension(name) {
  const dot = name.lastIndexOf('.');
  return dot !== -1 ? name.slice(dot).toLowerCase() : '';
}

export default function UploadCsv() {
  // ── Step 1 State ──
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | parsing | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // ── Step 2 State ──
  const [currentStep, setCurrentStep] = useState(1);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingError, setMappingError] = useState('');
  const [aiMapping, setAiMapping] = useState(null);
  const [confirmedMapping, setConfirmedMapping] = useState({});
  const [isPivoted, setIsPivoted] = useState(false);
  const [dateFormat, setDateFormat] = useState('DD/M/YY');
  const [attendanceConvention, setAttendanceConvention] = useState('TRUE/FALSE');
  const [dateColumns, setDateColumns] = useState([]);

  const inputRef = useRef(null);

  // ── Validation ──
  const validateFile = useCallback((f) => {
    const ext = getFileExtension(f.name);

    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(f.type)) {
      return 'Unsupported file type. Please upload a .csv or .xlsx file.';
    }
    if (f.size > MAX_FILE_SIZE) {
      return `File is too large (${formatFileSize(f.size)}). Maximum allowed size is 5 MB.`;
    }
    if (f.size === 0) {
      return 'The file is empty. Please select a file with data.';
    }
    return null;
  }, []);

  // ── Parsing ──
  const parseCSV = useCallback((f) => {
    return new Promise((resolve, reject) => {
      Papa.parse(f, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            reject(new Error('The CSV file contains no data rows.'));
            return;
          }
          resolve({
            headers: results.meta.fields || [],
            rows: results.data,
            errors: results.errors,
          });
        },
        error: (err) => reject(new Error(`CSV parse failed: ${err.message}`)),
      });
    });
  }, []);

  const parseXLSX = useCallback((f) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            reject(new Error('The Excel file contains no sheets.'));
            return;
          }
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (jsonData.length === 0) {
            reject(new Error('The Excel file contains no data rows.'));
            return;
          }
          const hdrs = Object.keys(jsonData[0]);
          resolve({
            headers: hdrs,
            rows: jsonData,
            errors: [],
          });
        } catch (err) {
          reject(new Error(`Excel parse failed: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read the file.'));
      reader.readAsArrayBuffer(f);
    });
  }, []);

  const handleFile = useCallback(
    async (f) => {
      // Reset state
      setFile(null);
      setHeaders([]);
      setRows([]);
      setPreviewRows([]);
      setParseErrors([]);
      setErrorMessage('');
      setUploadStatus('idle');

      // Validate
      const validationError = validateFile(f);
      if (validationError) {
        setErrorMessage(validationError);
        setUploadStatus('error');
        return;
      }

      setFile(f);
      setUploadStatus('parsing');

      try {
        const ext = getFileExtension(f.name);
        let result;

        if (ext === '.csv') {
          result = await parseCSV(f);
        } else {
          result = await parseXLSX(f);
        }

        setHeaders(result.headers);
        setRows(result.rows);
        setPreviewRows(result.rows.slice(0, PREVIEW_ROW_COUNT));
        setParseErrors(result.errors || []);
        setUploadStatus('success');
      } catch (err) {
        setErrorMessage(err.message);
        setUploadStatus('error');
      }
    },
    [validateFile, parseCSV, parseXLSX]
  );

  // ── Drag & Drop ──
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleBrowse = useCallback(
    (e) => {
      const selected = e.target.files?.[0];
      if (selected) handleFile(selected);
    },
    [handleFile]
  );

  const handleClear = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setPreviewRows([]);
    setParseErrors([]);
    setErrorMessage('');
    setUploadStatus('idle');
    setCurrentStep(1);
    setMappingLoading(false);
    setMappingError('');
    setAiMapping(null);
    setConfirmedMapping({});
    setIsPivoted(false);
    setDateFormat('DD/M/YY');
    setAttendanceConvention('TRUE/FALSE');
    setDateColumns([]);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // ── Gemini column mapping call ──
  const handleNextToMapping = useCallback(async () => {
    setCurrentStep(2);
    setMappingLoading(true);
    setMappingError('');
    setAiMapping(null);
    try {
      const result = await getColumnMapping(headers, previewRows);
      setAiMapping(result);
      setConfirmedMapping(result.mapping || {});
      setIsPivoted(result.is_pivoted || false);
      setDateFormat(result.date_format || 'DD/M/YY');
      setAttendanceConvention(result.attendance_convention || 'TRUE/FALSE');
      setDateColumns(result.date_columns || []);
    } catch (err) {
      setMappingError(err.message);
      // Build a fallback mapping: all columns -> IGNORE
      const fallback = {};
      headers.forEach(h => { fallback[h] = 'IGNORE'; });
      setConfirmedMapping(fallback);
    } finally {
      setMappingLoading(false);
    }
  }, [headers, previewRows]);

  // Per-column mapping change handler
  const handleMappingChange = useCallback((sourceCol, targetField) => {
    setConfirmedMapping(prev => ({ ...prev, [sourceCol]: targetField }));
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-display-lg text-fg-primary">Upload CSV</h1>
        <p className="text-body text-fg-secondary mt-2">
          Import historical attendance data from CSV or Excel files.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="bg-surface rounded-2xl border border-border-default shadow-card p-6" style={{ backgroundImage: 'var(--card-gradient)' }}>
        <div className="flex items-center justify-between max-w-[640px] mx-auto">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold transition-all
                    ${step.id === currentStep
                      ? 'bg-accent-glow text-fg-primary ring-4 ring-accent-glow/25'
                      : step.id < currentStep
                        ? 'bg-success/20 text-success border border-success/30'
                        : 'bg-surface-raised text-fg-tertiary border border-border-default'
                    }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle2 size={18} strokeWidth={2} />
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`text-[12px] font-medium tracking-wide
                    ${step.id === currentStep
                      ? 'text-fg-primary'
                      : step.id < currentStep
                        ? 'text-success'
                        : 'text-fg-tertiary'
                    }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 mx-3 mb-6">
                  <div
                    className={`h-[2px] rounded-full transition-colors
                      ${idx < currentStep - 1
                        ? 'bg-success/40'
                        : 'bg-border-default'
                      }`}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      {uploadStatus !== 'success' && (
        <div
          className={`
            relative bg-surface rounded-2xl border-2 border-dashed shadow-card
            transition-all duration-200 cursor-pointer min-h-[240px]
            flex flex-col items-center justify-center gap-4 p-8
            ${isDragging
              ? 'border-accent-glow bg-[rgba(99,102,241,0.06)]'
              : uploadStatus === 'error'
                ? 'border-danger/40 bg-danger/[0.03]'
                : 'border-border-default hover:border-border-strong hover:bg-surface-raised/40'
            }
          `}
          style={{ backgroundImage: uploadStatus === 'error' ? 'none' : 'var(--card-gradient)' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          id="csv-upload-dropzone"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleBrowse}
            className="hidden"
            id="csv-file-input"
          />

          {uploadStatus === 'parsing' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent-glow/10 flex items-center justify-center animate-pulse">
                <FileSpreadsheet size={24} className="text-accent-glow" strokeWidth={1.75} />
              </div>
              <p className="text-body text-fg-secondary">Parsing file…</p>
            </div>
          ) : uploadStatus === 'error' ? (
            <div className="flex flex-col items-center gap-3 text-center max-w-[400px]">
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
                <XCircle size={24} className="text-danger" strokeWidth={1.75} />
              </div>
              <p className="text-body font-medium text-danger">{errorMessage}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="mt-2 bg-surface-raised border border-border-default text-fg-primary px-4 py-2 rounded-md text-[13px] font-medium hover:bg-surface transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors
                ${isDragging ? 'bg-accent-glow/15' : 'bg-surface-raised border border-border-default'}`}>
                <Upload size={24} className={isDragging ? 'text-accent-glow' : 'text-fg-tertiary'} strokeWidth={1.75} />
              </div>
              <div className="text-center">
                <p className="text-body text-fg-primary font-medium">
                  Drop your file here or{' '}
                  <span className="text-accent-glow underline underline-offset-2">click to browse</span>
                </p>
                <p className="text-caption text-fg-tertiary mt-2">
                  Supports .csv and .xlsx files up to 5 MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Success State: File Info + Preview */}
      {uploadStatus === 'success' && file && (
        <>
          {/* File Info Card */}
          <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={22} className="text-success" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-h3 text-fg-primary font-medium">{file.name}</p>
                  <p className="text-caption text-fg-tertiary mt-1">
                    Parsed successfully
                  </p>
                </div>
              </div>
              <button
                onClick={handleClear}
                className="self-start md:self-center bg-surface-raised border border-border-default text-fg-secondary px-3 py-2 rounded-md text-[13px] font-medium hover:text-danger hover:border-danger/30 transition-colors flex items-center gap-2"
                id="clear-file-btn"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>

            {/* Stats Row */}
            <div className="border-t border-border-subtle grid grid-cols-2 md:grid-cols-4 divide-x divide-border-subtle">
              {[
                { icon: Rows3, label: 'Rows', value: rows.length },
                { icon: Columns3, label: 'Columns', value: headers.length },
                { icon: HardDrive, label: 'File Size', value: formatFileSize(file.size) },
                { icon: FileUp, label: 'Format', value: getFileExtension(file.name).replace('.', '').toUpperCase() },
              ].map((stat, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center text-fg-tertiary shrink-0">
                    <stat.icon size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-label text-fg-tertiary uppercase">{stat.label}</p>
                    <p className="text-body text-fg-primary font-semibold tabular-nums mt-0.5">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Parse Warnings (if any) */}
          {parseErrors.length > 0 && (
            <div className="bg-warning/[0.06] border border-warning/20 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-body font-medium text-warning">
                  {parseErrors.length} parse warning{parseErrors.length !== 1 ? 's' : ''} detected
                </p>
                <ul className="mt-2 text-body-sm text-fg-secondary space-y-1">
                  {parseErrors.slice(0, 3).map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                  {parseErrors.length > 3 && (
                    <li className="text-fg-tertiary">
                      and {parseErrors.length - 3} more…
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
            <div className="p-5 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Table size={18} className="text-fg-tertiary" strokeWidth={1.75} />
                <h2 className="text-h3 text-fg-primary">Data Preview</h2>
              </div>
              <span className="text-caption text-fg-tertiary">
                Showing first {Math.min(PREVIEW_ROW_COUNT, rows.length)} of {rows.length} rows
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px]" id="preview-table">
                <thead>
                  <tr className="bg-surface-inset">
                    <th className="text-left p-4 font-medium text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle w-12">
                      #
                    </th>
                    {headers.map((header, i) => (
                      <th
                        key={i}
                        className="text-left p-4 font-medium text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle whitespace-nowrap max-w-[200px]"
                      >
                        <span className="truncate block">{header}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="hover:bg-surface-raised transition-colors"
                    >
                      <td className="p-4 text-body-sm text-fg-tertiary border-b border-border-subtle tabular-nums font-mono">
                        {rowIdx + 1}
                      </td>
                      {headers.map((header, colIdx) => (
                        <td
                          key={colIdx}
                          className="p-4 text-body text-fg-primary border-b border-border-subtle whitespace-nowrap max-w-[200px]"
                        >
                          <span className="truncate block">
                            {row[header] !== undefined && row[header] !== null
                              ? String(row[header])
                              : ''}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Next Button */}
          <div className="flex justify-end">
            <button
              onClick={handleNextToMapping}
              className="bg-fg-primary text-void rounded-md py-3 px-6 font-medium text-[14px] flex items-center gap-2 hover:bg-[#E5E5E7] transition-colors"
              id="next-step-btn"
            >
              Next: Map Columns
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* ── STEP 2: Column Mapping ── */}
      {currentStep === 2 && (
        <>
          <ColumnMappingStep
            headers={headers}
            previewRows={previewRows}
            mappingLoading={mappingLoading}
            mappingError={mappingError}
            aiMapping={aiMapping}
            confirmedMapping={confirmedMapping}
            isPivoted={isPivoted}
            dateFormat={dateFormat}
            attendanceConvention={attendanceConvention}
            dateColumns={dateColumns}
            onMappingChange={handleMappingChange}
            onIsPivotedChange={setIsPivoted}
            onDateFormatChange={setDateFormat}
            onAttendanceConventionChange={setAttendanceConvention}
            onRetryAI={handleNextToMapping}
          />

          {/* Step 2 action bar */}
          {!mappingLoading && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="bg-surface-raised border border-border-default text-fg-primary px-5 py-3 rounded-md text-[14px] font-medium hover:bg-surface transition-colors flex items-center gap-2"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                disabled
                className="bg-fg-primary text-void rounded-md py-3 px-6 font-medium text-[14px] flex items-center gap-2 opacity-50 cursor-not-allowed"
                title="Validation engine coming in Step 3"
                id="confirm-mapping-btn"
              >
                Confirm Mapping
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
