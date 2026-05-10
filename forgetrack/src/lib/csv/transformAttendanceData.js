/**
 * Attendance Data Transformation Engine
 * 
 * Converts raw spreadsheet rows into normalized candidate records.
 * Supports pivoted sheets (unpivoting), date normalization, and 
 * attendance value parsing.
 */

/**
 * Normalizes attendance values into a boolean.
 * Returns null if the value is empty or not recognized.
 */
export function parseAttendanceValue(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toLowerCase();
  if (s === '') return null;

  const trueValues = ['true', 'p', 'present', '1', 'y', 'yes', 'verified'];
  const falseValues = ['false', 'a', 'absent', '0', 'n', 'no', 'unverified'];

  if (trueValues.includes(s)) return true;
  if (falseValues.includes(s)) return false;

  return null; // Not an attendance value
}

/**
 * Normalizes dates into YYYY-MM-DD.
 * Supports Excel serials and common string formats.
 */
export function parseDate(val, preferredFormat = 'DD/MM/YY') {
  if (!val) return null;

  // Handle Excel Serial Dates (40,000 to 60,000 range)
  const num = Number(val);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    try {
      const date = new Date((num - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('Failed to parse Excel serial date:', val);
    }
  }

  // Handle string formats
  const s = String(val).trim();
  if (!s) return null;

  // Simple regex-based parsing for common formats
  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return s;

  // DD/MM/YY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmyMatch) {
    let [_, d, m, y] = dmyMatch;
    if (y.length === 2) {
      // Logic: if year < 50 assume 20xx, else 19xx
      y = parseInt(y) < 50 ? `20${y}` : `19${y}`;
    }
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Fallback to JS Date (use with caution)
  try {
    const date = new Date(s);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {}

  return null;
}

/**
 * Transforms normalized spreadsheet rows into attendance candidate records.
 * 
 * @param {Object[]} rows - Array of objects where keys are normalized headers
 * @param {Object} mapping - Current column mapping (source_header -> target_field)
 * @param {Object} options - { isPivoted, dateColumns, dateFormat, attendanceConvention }
 * @returns {Object} { records: Object[], stats: { total: number, skipped: number } }
 */
export function transformAttendanceData(rows, mapping, options) {
  const { isPivoted, dateColumns = [], dateFormat = 'DD/MM/YY' } = options;
  const records = [];
  let skipped = 0;

  // Inverse mapping to find which target fields are mapped to which source columns
  const targetToSource = {};
  Object.entries(mapping).forEach(([source, target]) => {
    if (target !== 'IGNORE') {
      if (!targetToSource[target]) targetToSource[target] = [];
      targetToSource[target].push(source);
    }
  });

  // Helper to get value for a target field from a row
  const getField = (row, field) => {
    const sources = targetToSource[field] || [];
    for (const src of sources) {
      if (row[src] !== undefined && row[src] !== null && String(row[src]).trim() !== '') {
        return row[src];
      }
    }
    return null;
  };

  rows.forEach((row, rowIdx) => {
    const baseInfo = {
      student_name: getField(row, 'student_name'),
      usn: getField(row, 'usn'),
      email: getField(row, 'email'),
      admission_number: getField(row, 'admission_number'),
      branch_code: getField(row, 'branch_code'),
      session_topic: getField(row, 'session_topic'),
      source_row: rowIdx + 1,
      status: 'pending',
      issues: []
    };

    if (isPivoted) {
      // For pivoted sheets, every date column is a potential attendance record
      dateColumns.forEach(dateCol => {
        const val = row[dateCol];
        const present = parseAttendanceValue(val);

        if (present === null) {
          skipped++;
          return;
        }

        records.push({
          ...baseInfo,
          date: parseDate(dateCol, dateFormat),
          present,
          source_column: dateCol,
          original_value: val
        });
      });
    } else {
      // Standard row-based sheet
      const dateVal = getField(row, 'date');
      const attendanceVal = getField(row, 'attendance_status');
      
      const present = parseAttendanceValue(attendanceVal);
      const date = parseDate(dateVal, dateFormat);

      if (present === null || !date) {
        skipped++;
        return;
      }

      records.push({
        ...baseInfo,
        date,
        present,
        source_column: targetToSource['attendance_status']?.[0] || 'unknown',
        original_value: attendanceVal
      });
    }
  });

  return {
    records,
    stats: {
      total: records.length,
      skipped
    }
  };
}
