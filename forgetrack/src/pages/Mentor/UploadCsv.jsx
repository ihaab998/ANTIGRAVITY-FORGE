import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trash2,
  FileUp,
  Table,
  Columns3,
  HardDrive,
  Rows3,
  ChevronLeft,
  Layers,
  Settings2,
  ListFilter,
  Info,
} from 'lucide-react';
import { getColumnMapping } from '../../lib/csvMappingAgent';
import { transformAttendanceData } from '../../lib/csv/transformAttendanceData';
import { validateAttendanceData } from '../../lib/csv/validateAttendanceData';
import ColumnMappingStep from './ColumnMappingStep';
import TransformationPreview from './TransformationPreview';
import ValidationStep from './ValidationStep';
import ImportStep from './ImportStep';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_EXTENSIONS = ['csv', 'xlsx', 'xls'];
const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
const MAX_PREVIEW_ROWS = 10;
const PREVIEW_ROW_COUNT = 8;

// Step definitions
const STEPS = [
  { id: 1, label: 'Configure' },
  { id: 2, label: 'Map Columns' },
  { id: 3, label: 'Normalize' },
  { id: 4, label: 'Validate' },
  { id: 5, label: 'Import' },
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
  const inputRef = useRef(null);

  // ── Data Normalization Logic ──
  const classifyHeader = useCallback((val, index, restoredSet = new Set()) => {
    const rawVal = String(val || '').trim();
    
    // 1. Detect Excel Serial Dates (approx 2010 to 2050)
    const num = Number(rawVal);
    const isSerialDate = !isNaN(num) && num > 40000 && num < 60000 && rawVal.length >= 5;
    
    if (isSerialDate) {
      try {
        const date = new Date((num - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
          const formatted = date.toISOString().split('T')[0];
          return {
            id: `col-${index}`,
            originalHeader: rawVal,
            normalizedHeader: formatted,
            classification: 'date',
            reason: 'Excel date serial',
            isIgnored: false
          };
        }
      } catch (e) {}
    }

    // 2. Detect Noise
    let classification = 'data';
    let reason = 'Valid header';
    let isIgnored = false;

    if (!rawVal) {
      classification = 'noise';
      reason = 'Empty column';
      isIgnored = true;
    } else if (!isNaN(num)) {
      classification = 'noise';
      reason = 'Numeric artifact';
      isIgnored = true;
    } else if (rawVal.toLowerCase().startsWith('column ') && /column \d+/i.test(rawVal)) {
      classification = 'noise';
      reason = 'Generic placeholder';
      isIgnored = true;
    }

    // 3. Manual Override Check
    const id = `col-${index}`;
    if (restoredSet.has(id)) {
      isIgnored = false;
    }

    return {
      id,
      originalHeader: rawVal || `(Empty Column ${index + 1})`,
      normalizedHeader: rawVal || `Column ${index + 1}`,
      classification,
      reason,
      isIgnored
    };
  }, []);

  const normalizeData = useCallback((raw, headerIdx, restoredSet = new Set()) => {
    console.log('[Normalize] Start', { rawLength: raw?.length, headerIdx });
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
       return { columnInfos: [], rows: [] };
    }
    if (raw.length <= headerIdx) {
       return { columnInfos: [], rows: [] };
    }

    const headerRow = raw[headerIdx] || [];
    const dataRows = raw.slice(headerIdx + 1);

    // Create unique column info
    const columnInfos = headerRow.map((h, i) => classifyHeader(h, i, restoredSet));

    // Map rows to objects using normalized names
    const mappedRows = dataRows.map(row => {
      const obj = {};
      columnInfos.forEach((info, i) => {
        if (row) {
          obj[info.normalizedHeader] = row[i] === undefined ? '' : row[i];
        }
      });
      return obj;
    });

    return { columnInfos, rows: mappedRows };
  }, [classifyHeader]);

  // ── Step 1 State (Enhanced) ──
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | parsing | configuring | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMode, setUploadMode] = useState('csv');

  // Raw data from parser
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [rawData, setRawData] = useState([]); // Array of arrays
  const [selectedHeaderRow, setSelectedHeaderRow] = useState(0);
  const [manuallyRestoredHeaders, setManuallyRestoredHeaders] = useState(new Set());

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
  const [showIgnored, setShowIgnored] = useState(false);

  // ── Step 4 State (Validation) ──
  const [validatedRecords, setValidatedRecords] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [dbData, setDbData] = useState({ students: [], attendance: [], sessions: [] });

  // ── Step 5 State (Import) ──
  const { session: authSession } = useAuth();
  const userName = authSession?.user?.user_metadata?.display_name || 'System';
  const [importProgress, setImportProgress] = useState({ total: 0, processed: 0, success: 0, skipped: 0, errors: 0 });
  const [importFinalSummary, setImportFinalSummary] = useState(null);

  // ── Derived Data ──

  // Derived normalized data
  const { columnInfos, activeHeaders, ignoredHeaders, normalizedRows, previewRows } = React.useMemo(() => {
    try {
      if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        return { columnInfos: [], activeHeaders: [], ignoredHeaders: [], normalizedRows: [], previewRows: [] };
      }
      
      const result = normalizeData(rawData, selectedHeaderRow, manuallyRestoredHeaders);
      const infos = result.columnInfos || [];
      const active = infos.filter(c => !c.isIgnored).map(c => c.normalizedHeader);
      const ignored = infos.filter(c => c.isIgnored);

      return {
        columnInfos: infos,
        activeHeaders: active,
        ignoredHeaders: ignored,
        normalizedRows: result.rows || [],
        previewRows: (result.rows || []).slice(0, PREVIEW_ROW_COUNT)
      };
    } catch (err) {
      console.error('[UploadCsv] Memo Error:', err);
      return { columnInfos: [], activeHeaders: [], ignoredHeaders: [], normalizedRows: [], previewRows: [] };
    }
  }, [rawData, selectedHeaderRow, manuallyRestoredHeaders, normalizeData]);

  // Derived transformation records
  const transformationResult = React.useMemo(() => {
    if (currentStep < 2 || !normalizedRows.length) {
      return { records: [], stats: { total: 0, skipped: 0 } };
    }
    
    return transformAttendanceData(normalizedRows, confirmedMapping, {
      isPivoted,
      dateColumns,
      dateFormat,
      attendanceConvention
    });
  }, [currentStep, normalizedRows, confirmedMapping, isPivoted, dateColumns, dateFormat, attendanceConvention]);

  const transformedRecords = transformationResult.records;
  const transformationStats = transformationResult.stats;


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

  // ── Parsing Logic ──
  const parseCSV = useCallback((f) => {
    return new Promise((resolve, reject) => {
      Papa.parse(f, {
        header: false, // Always get raw array of arrays first
        skipEmptyLines: 'greedy',
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            reject(new Error('The CSV file contains no data rows.'));
            return;
          }
          resolve(results.data);
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
          const wb = XLSX.read(e.target.result, { type: 'array' });
          if (!wb.SheetNames || wb.SheetNames.length === 0) {
            reject(new Error('The Excel file contains no sheets.'));
            return;
          }
          resolve(wb);
        } catch (err) {
          reject(new Error(`Excel parse failed: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read the file.'));
      reader.readAsArrayBuffer(f);
    });
  }, []);

  // Effect to load sheet data when selectedSheetName changes
  React.useEffect(() => {
    if (workbook && selectedSheetName) {
      const sheet = workbook.Sheets[selectedSheetName];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      setRawData(raw);
      setSelectedHeaderRow(0); // Reset header row on sheet change
    }
  }, [workbook, selectedSheetName]);

  const handleFile = useCallback(
    async (f) => {
      // Reset state
      setFile(f);
      setUploadStatus('parsing');
      setErrorMessage('');
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheetName('');
      setRawData([]);
      setSelectedHeaderRow(0);

      // Validate
      const validationError = validateFile(f);
      if (validationError) {
        setErrorMessage(validationError);
        setUploadStatus('error');
        return;
      }

      try {
        const ext = getFileExtension(f.name);
        if (ext === '.csv') {
          setUploadMode('csv');
          const data = await parseCSV(f);
          setRawData(data);
          setUploadStatus('configuring');
        } else {
          setUploadMode('xlsx');
          const wb = await parseXLSX(f);
          setWorkbook(wb);
          setSheetNames(wb.SheetNames);
          setSelectedSheetName(wb.SheetNames[0]);
          setUploadStatus('configuring');
        }
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
    setUploadStatus('idle');
    setErrorMessage('');
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheetName('');
    setRawData([]);
    setSelectedHeaderRow(0);
    setManuallyRestoredHeaders(new Set());

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
    if (mappingLoading) return;

    setUploadStatus('success'); // Move from configuring to success view
    setCurrentStep(2);
    setMappingLoading(true);
    setMappingError('');
    setAiMapping(null);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );

    try {
      const result = await Promise.race([
        getColumnMapping(activeHeaders, previewRows),
        timeoutPromise
      ]);
      
      setAiMapping(result);
      setConfirmedMapping(result.mapping || {});
      setIsPivoted(result.is_pivoted || false);
      setDateFormat(result.date_format || 'DD/M/YY');
      setAttendanceConvention(result.attendance_convention || 'TRUE/FALSE');
      setDateColumns(result.date_columns || []);
    } catch (err) {
      if (err.message === 'AI_RATE_LIMIT') {
        setMappingError('AI_RATE_LIMIT');
      } else if (err.message === 'TIMEOUT') {
        setMappingError('The request timed out after 15 seconds. Please try again or map manually.');
      } else {
        setMappingError(err.message);
      }

      const fallback = {};
      activeHeaders.forEach(h => { fallback[h] = 'IGNORE'; });
      setConfirmedMapping(fallback);
    } finally {
      setMappingLoading(false);
    }
  }, [activeHeaders, previewRows, mappingLoading]);

  // Per-column mapping change handler
  const handleMappingChange = useCallback((sourceCol, targetField) => {
    setConfirmedMapping(prev => ({ ...prev, [sourceCol]: targetField }));
  }, []);

  const handleRestoreHeader = useCallback((id) => {
    setManuallyRestoredHeaders(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleIgnoreAllNoise = useCallback(() => {
    // This is the default behavior now, but we can use this to clear any manual restores
    setManuallyRestoredHeaders(new Set());
  }, []);

  const handleConfirmMapping = useCallback(() => {
    setCurrentStep(3);
  }, []);

  const handleProceedToValidation = useCallback(async () => {
    if (isValidating) return;
    setIsValidating(true);
    setErrorMessage('');
    
    try {
      // 1. Fetch Students
      const { data: students, error: studentErr } = await supabase
        .from('students')
        .select('id, name, usn, email, admission_number, is_active');
      
      if (studentErr) throw studentErr;

      // 2. Extract unique dates from transformed records
      const uniqueDates = [...new Set(transformedRecords.map(r => r.date))];
      
      // 3. Fetch Sessions for these dates
      const { data: sessions, error: sessionErr } = await supabase
        .from('sessions')
        .select('id, date, topic')
        .in('date', uniqueDates);
      
      if (sessionErr) throw sessionErr;

      // 4. Fetch Existing Attendance for these sessions
      const sessionIds = sessions?.map(s => s.id) || [];
      const { data: attendance, error: attendanceErr } = sessionIds.length > 0 
        ? await supabase.from('attendance').select('student_id, session_id').in('session_id', sessionIds)
        : { data: [], error: null };

      if (attendanceErr) throw attendanceErr;

      const dbState = { 
        students: students || [], 
        attendance: attendance || [], 
        sessions: sessions || [] 
      };
      setDbData(dbState);

      // 5. Run Validation
      const results = validateAttendanceData(transformedRecords, dbState.students, dbState.attendance, dbState.sessions);
      setValidatedRecords(results);
      setCurrentStep(4);
    } catch (err) {
      console.error('Validation error:', err);
      setErrorMessage(`Validation failed: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  }, [transformedRecords, isValidating]);

  // ── Validation Handlers ──
  const handleExcludeRow = useCallback((record) => {
    setValidatedRecords(prev => prev.map(r => 
      (r === record) ? { ...r, isExcluded: true } : r
    ));
  }, []);

  const handleRestoreRow = useCallback((record) => {
    setValidatedRecords(prev => prev.map(r => 
      (r === record) ? { ...r, isExcluded: false } : r
    ));
  }, []);

  const handleAcceptMatch = useCallback((record, match) => {
    setValidatedRecords(prev => prev.map(r => {
      if (r === record) {
        // Re-validate this specific record with the new student mapping
        const updatedRecord = { 
          ...r, 
          student_id: match.id,
          usn: match.usn,
          email: match.email,
          admission_number: match.admission_number,
          // Clear matches after acceptance
          suggestedMatches: []
        };
        
        // Re-run validation for this single record
        const results = validateAttendanceData([updatedRecord], dbData.students, dbData.attendance, dbData.sessions);
        return results[0];
      }
      return r;
    }));
  }, [dbData]);

  const handleStartImport = useCallback(async () => {
    // 1. Filter records to import (exclude errors and manual exclusions)
    const recordsToImport = validatedRecords.filter(r => r.status !== 'error' && !r.isExcluded);
    if (recordsToImport.length === 0) {
      setErrorMessage('No valid records found to import.');
      return;
    }

    setCurrentStep(5);
    setImportFinalSummary(null);
    setImportProgress({ total: recordsToImport.length, processed: 0, success: 0, skipped: 0, errors: 0 });

    let importLogId = null;
    let localSuccess = 0;
    let localSkipped = 0;
    let localErrors = 0;

    try {
      // ── STEP 1: Create Import Log ──
      const { data: logData, error: logErr } = await supabase
        .from('import_log')
        .insert([{
          filename: file.name,
          uploaded_by: userName,
          total_rows: recordsToImport.length,
          imported_rows: 0,
          skipped_rows: 0,
          warnings: validatedRecords.filter(r => r.status === 'warning').length,
          column_mapping: confirmedMapping,
          status: 'in_progress'
        }])
        .select()
        .single();

      if (logErr) throw logErr;
      importLogId = logData.id;

      // ── STEP 2: Session Resolution ──
      // Group unique date+topic combinations from the records
      const sessionRequests = [...new Set(recordsToImport.map(r => `${r.date}|${r.session_topic || 'Imported Session'}`))];
      const sessionCache = {}; // "date|topic" -> session_id

      // Fetch all existing sessions for these dates to populate cache
      const uniqueDates = [...new Set(recordsToImport.map(r => r.date))];
      const { data: existingSessions } = await supabase
        .from('sessions')
        .select('id, date, topic')
        .in('date', uniqueDates);

      existingSessions?.forEach(s => {
        sessionCache[`${s.date}|${s.topic}`] = s.id;
      });

      for (const req of sessionRequests) {
        if (sessionCache[req]) continue;

        const [date, topic] = req.split('|');
        const { data: newSession, error: sErr } = await supabase
          .from('sessions')
          .insert([{
            date,
            topic,
            duration_hours: 1.5,
            session_type: 'offline',
            month_number: new Date(date).getMonth() + 1
          }])
          .select()
          .single();
        
        if (sErr) throw sErr;
        sessionCache[req] = newSession.id;
      }
      
      // Map each record to its resolved session_id
      const recordToSessionId = (record) => sessionCache[`${record.date}|${record.session_topic || 'Imported Session'}`];

      // ── STEP 3 & 4: Batch Prepare and Write ──
      const BATCH_SIZE = 50;
      for (let i = 0; i < recordsToImport.length; i += BATCH_SIZE) {
        const batch = recordsToImport.slice(i, i + BATCH_SIZE);
        
        const attendanceRows = batch.map(r => ({
          student_id: r.student_id,
          session_id: recordToSessionId(r),
          present: r.present,
          marked_at: new Date().toISOString(),
          marked_by: 'csv_import',
          import_id: importLogId
        }));

        // Upsert to handle potential race conditions or manual re-imports
        // student_id + session_id should be unique
        const { data, error: upsertErr } = await supabase
          .from('attendance')
          .upsert(attendanceRows, { 
            onConflict: 'student_id,session_id',
            ignoreDuplicates: false // We want to update if it exists to preserve 'import_id' audit
          })
          .select('id');

        if (upsertErr) {
          console.error('Batch upsert error:', upsertErr);
          localErrors += batch.length;
        } else {
          // Note: data.length might be less if we ignored duplicates, but we used upsert
          localSuccess += batch.length;
        }

        const processed = Math.min(i + BATCH_SIZE, recordsToImport.length);
        setImportProgress(prev => ({
          ...prev,
          processed,
          success: localSuccess,
          errors: localErrors
        }));
      }

      // ── STEP 6: Final Log Update ──
      await supabase
        .from('import_log')
        .update({
          status: 'completed',
          imported_rows: localSuccess,
          skipped_rows: localSkipped,
          uploaded_at: new Date().toISOString()
        })
        .eq('id', importLogId);

      setImportFinalSummary({
        filename: file.name,
        imported: localSuccess,
        skipped: localSkipped,
        total: recordsToImport.length
      });

    } catch (err) {
      console.error('Final Import Error:', err);
      setErrorMessage(`Import failed: ${err.message}`);
      
      if (importLogId) {
        await supabase.from('import_log').update({ status: 'failed' }).eq('id', importLogId);
      }
    }
  }, [validatedRecords, file, userName, confirmedMapping, dbData]);

  const handleConfirmValidation = useCallback(() => {
    handleStartImport();
  }, [handleStartImport]);

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
      {uploadStatus !== 'success' && uploadStatus !== 'configuring' && (
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

      {/* Success / Configuring State */}
      {(uploadStatus === 'success' || uploadStatus === 'configuring') && file && (
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
                    {uploadStatus === 'configuring' ? 'Configure file properties' : 'Processing complete'}
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
                { icon: Rows3, label: 'Rows', value: normalizedRows.length },
                { icon: Columns3, label: 'Active Columns', value: `${activeHeaders.length}/${columnInfos.length}` },
                { icon: HardDrive, label: 'File Size', value: formatFileSize(file.size) },
                { icon: FileUp, label: 'Format', value: uploadMode.toUpperCase() },
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

          {/* ── NEW: Configuration Section ── */}
          {uploadStatus === 'configuring' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side: Selectors */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                
                {/* Sheet Selection (Excel Only) */}
                {uploadMode === 'xlsx' && (
                  <div className="bg-surface rounded-2xl border border-border-default shadow-card p-6" style={{ backgroundImage: 'var(--card-gradient)' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <Layers size={18} className="text-accent-glow" />
                      <h2 className="text-h3 text-fg-primary">Select Sheet</h2>
                    </div>
                    <div className="space-y-2">
                      {sheetNames.map(name => (
                        <button
                          key={name}
                          onClick={() => setSelectedSheetName(name)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between
                            ${selectedSheetName === name 
                              ? 'bg-accent-glow/10 border-accent-glow text-fg-primary shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                              : 'bg-surface-raised border-border-subtle text-fg-secondary hover:border-border-default'
                            }`}
                        >
                          <span className="text-body font-medium truncate">{name}</span>
                          {selectedSheetName === name && <CheckCircle2 size={16} className="text-accent-glow shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Header Row Selection */}
                <div className="bg-surface rounded-2xl border border-border-default shadow-card p-6" style={{ backgroundImage: 'var(--card-gradient)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 size={18} className="text-accent-glow" />
                    <h2 className="text-h3 text-fg-primary">Header Row</h2>
                  </div>
                  <p className="text-caption text-fg-tertiary mb-4">
                    Choose which row contains the column names. Rows above will be ignored.
                  </p>
                  <div className="max-h-[320px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {rawData.slice(0, 8).map((row, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedHeaderRow(idx)}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-all
                          ${selectedHeaderRow === idx 
                            ? 'bg-success/10 border-success/30 text-fg-primary' 
                            : 'bg-surface-inset border-border-subtle text-fg-secondary hover:border-border-default'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-fg-tertiary px-1.5 py-0.5 bg-void/40 rounded">Row {idx + 1}</span>
                          {selectedHeaderRow === idx && <span className="text-[10px] font-bold text-success uppercase tracking-wider">Selected Header</span>}
                        </div>
                        <div className="flex gap-2 overflow-hidden">
                          {row.slice(0, 3).map((cell, i) => (
                            <span key={i} className="text-[11px] truncate px-2 py-0.5 bg-void/20 rounded max-w-[80px]">
                              {String(cell || '')}
                            </span>
                          ))}
                          {row.length > 3 && <span className="text-[11px] text-fg-tertiary self-center">...</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ignored Columns Section */}
                {ignoredHeaders.length > 0 && (
                  <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
                    <button 
                      onClick={() => setShowIgnored(!showIgnored)}
                      className="w-full p-4 flex items-center justify-between hover:bg-surface-raised transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Info size={16} className="text-fg-tertiary" />
                        <span className="text-[13px] font-medium text-fg-primary">
                          {ignoredHeaders.length} Columns Ignored
                        </span>
                        <span className="text-[11px] text-fg-tertiary bg-surface-inset px-2 py-0.5 rounded-full">Noise detected</span>
                      </div>
                      {showIgnored ? <ChevronLeft size={16} className="-rotate-90 text-fg-tertiary" /> : <ChevronLeft size={16} className="text-fg-tertiary" />}
                    </button>
                    
                    {showIgnored && (
                      <div className="p-4 border-t border-border-subtle bg-surface-inset/50 space-y-2">
                        <p className="text-[11px] text-fg-tertiary mb-3 italic">
                          These columns were automatically excluded as noise. Restore them if they contain meaningful data.
                        </p>
                        <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {ignoredHeaders.map(info => (
                            <div key={info.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-surface border border-border-subtle">
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium text-fg-primary truncate">{info.originalHeader}</p>
                                <p className="text-[10px] text-fg-tertiary truncate">{info.reason}</p>
                              </div>
                              <button
                                onClick={() => handleRestoreHeader(info.id)}
                                className="text-[11px] font-semibold text-accent-glow hover:text-accent-glow/80 px-2 py-1 rounded bg-accent-glow/5 border border-accent-glow/10 whitespace-nowrap"
                              >
                                Restore
                              </button>
                            </div>
                          ))}
                        </div>
                        <button 
                          onClick={handleIgnoreAllNoise}
                          className="w-full mt-2 text-[11px] text-fg-tertiary hover:text-fg-primary transition-colors text-center py-1"
                        >
                          Reset all to detected noise
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Side: Configuration Preview */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden h-full flex flex-col" style={{ backgroundImage: 'var(--card-gradient)' }}>
                  <div className="p-5 border-b border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ListFilter size={18} className="text-fg-tertiary" strokeWidth={1.75} />
                      <h2 className="text-h3 text-fg-primary">Preview: Active Columns Only</h2>
                    </div>
                    {ignoredHeaders.length > 0 && (
                       <span className="text-[11px] text-fg-tertiary">
                         {ignoredHeaders.length} columns hidden
                       </span>
                    )}
                  </div>

                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-surface-inset">
                          {columnInfos.filter(c => !c.isIgnored).map((info) => (
                            <th key={info.id} className="text-left p-3 font-medium text-[11px] text-fg-tertiary uppercase border-b border-border-subtle whitespace-nowrap">
                              <div className="flex flex-col">
                                <span>{info.normalizedHeader}</span>
                                {info.classification === 'date' && (
                                  <span className="text-[9px] text-accent-glow lowercase normal-case tracking-normal">Serial Date</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-surface-raised transition-colors">
                            {columnInfos.filter(c => !c.isIgnored).map((info) => (
                              <td key={info.id} className="p-3 text-[13px] text-fg-primary border-b border-border-subtle whitespace-nowrap max-w-[150px]">
                                <span className="truncate block">{String(row[info.normalizedHeader] || '')}</span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-surface-inset border-t border-border-subtle flex items-center gap-3">
                    <Info size={16} className="text-accent-glow shrink-0" />
                    <p className="text-[12px] text-fg-secondary italic">
                      AI analyzed the first few rows to detect the spreadsheet structure. The full file will be processed during validation and import.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button for Configuration */}
          {uploadStatus === 'configuring' && (
            <div className="flex justify-end gap-4">
               <button
                onClick={handleClear}
                className="bg-surface-raised border border-border-default text-fg-primary px-6 py-3 rounded-md text-[14px] font-medium hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNextToMapping}
                disabled={mappingLoading}
                className={`bg-fg-primary text-void rounded-md py-3 px-8 font-medium text-[14px] flex items-center gap-2 transition-colors ${mappingLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#E5E5E7]'}`}
              >
                {mappingLoading ? 'Analyzing Columns...' : 'Confirm & Analyze Columns'}
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 1 Preview Table (Step 2+ view) */}
          {uploadStatus === 'success' && currentStep > 1 && (
            <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
              <div className="p-5 border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Table size={18} className="text-fg-tertiary" strokeWidth={1.75} />
                  <h2 className="text-h3 text-fg-primary">Data Preview</h2>
                </div>
                <div className="flex items-center gap-4 text-caption text-fg-tertiary">
                   <span>Sheet: <strong>{selectedSheetName || 'Default'}</strong></span>
                   <span>Header: <strong>Row {selectedHeaderRow + 1}</strong></span>
                   <span>Loaded: <strong>{normalizedRows.length} rows</strong></span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]" id="preview-table">
                  <thead>
                    <tr className="bg-surface-inset">
                      <th className="text-left p-4 font-medium text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle w-12">#</th>
                      {activeHeaders.map((header, i) => (
                        <th key={i} className="text-left p-4 font-medium text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle whitespace-nowrap max-w-[200px]">
                          <span className="truncate block">{header}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-surface-raised transition-colors">
                        <td className="p-4 text-body-sm text-fg-tertiary border-b border-border-subtle tabular-nums font-mono">{rowIdx + 1}</td>
                        {activeHeaders.map((header, colIdx) => (
                          <td key={colIdx} className="p-4 text-body text-fg-primary border-b border-border-subtle whitespace-nowrap max-w-[200px]">
                            <span className="truncate block">{String(row[header] || '')}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STEP 2: Column Mapping ── */}
      {currentStep === 2 && (
        <>
          <ColumnMappingStep
            headers={activeHeaders}
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
                onClick={() => {
                  setCurrentStep(1);
                  setUploadStatus('configuring');
                }}
                className="bg-surface-raised border border-border-default text-fg-primary px-5 py-3 rounded-md text-[14px] font-medium hover:bg-surface transition-colors flex items-center gap-2"
              >
                <ChevronLeft size={16} />
                Back to Configuration
              </button>
              <button
                onClick={handleConfirmMapping}
                className="bg-fg-primary text-void rounded-md py-3 px-6 font-medium text-[14px] flex items-center gap-2 hover:opacity-90 transition-opacity"
                id="confirm-mapping-btn"
              >
                Confirm & Transform
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {/* ── STEP 3: Review Transformation (Normalization) ── */}
      {currentStep === 3 && (
        <TransformationPreview
          records={transformedRecords}
          stats={transformationStats}
          isLoading={isValidating}
          onBack={() => setCurrentStep(2)}
          onConfirm={handleProceedToValidation}
        />
      )}

      {/* ── STEP 4: Validation ── */}
      {currentStep === 4 && (
        <ValidationStep
          records={validatedRecords}
          onExclude={handleExcludeRow}
          onRestore={handleRestoreRow}
          onAcceptMatch={handleAcceptMatch}
          onBack={() => setCurrentStep(3)}
          onConfirm={handleConfirmValidation}
        />
      )}

      {/* ── STEP 5: Final Import Progress & Success ── */}
      {currentStep === 5 && (
        <ImportStep
          progress={importProgress}
          summary={importFinalSummary}
          onReset={handleClear}
        />
      )}
    </div>
  );
}
