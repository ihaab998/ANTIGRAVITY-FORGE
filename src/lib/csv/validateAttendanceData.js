/**
 * Attendance Validation Engine
 * 
 * Performs multi-stage validation including:
 * - Data integrity checks
 * - File-level duplicate detection
 * - Database cross-referencing (Students, Attendance, Sessions)
 * - Fuzzy student name matching
 */

/**
 * Levenshtein Distance for fuzzy matching
 */
function levenshtein(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
}

/**
 * Similarity ratio based on Levenshtein distance
 */
function getSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshtein(longer.length === s1.length ? s1 : s2, shorter.length === s1.length ? s2 : s1)) / longer.length;
}

/**
 * Find suggested student matches using fuzzy name matching
 */
export function findSuggestedMatches(inputName, students, threshold = 0.8) {
  if (!inputName) return [];
  const normalizedInput = inputName.toLowerCase().trim();
  
  return students
    .map(s => ({
      ...s,
      similarity: getSimilarity(normalizedInput, (s.name || '').toLowerCase().trim())
    }))
    .filter(s => s.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

/**
 * Validates transformed records against database state and integrity rules.
 */
export function validateAttendanceData(records, students = [], attendance = [], sessions = []) {
  const validated = [];
  const fileDuplicates = new Set();

  return records.map((record, idx) => {
    const issues = [];
    let status = 'clean';
    let suggestedMatches = [];
    let studentId = null;
    let sessionId = null;

    // 1. Data Integrity Checks
    if (!record.student_name) issues.push('Missing student name');
    if (!record.usn && !record.email && !record.admission_number) issues.push('No identifier (USN/Email/Adm No)');
    if (!record.date) issues.push('Invalid or missing date');
    if (record.present === null) issues.push('Invalid attendance value');

    // 2. File-level Duplicate Detection
    const recordId = record.usn || record.email || record.admission_number || `row-${idx}`;
    const fileKey = `${recordId}|${record.date}`;
    if (fileDuplicates.has(fileKey)) {
      issues.push('Duplicate entry in this file');
      status = 'error';
    }
    fileDuplicates.add(fileKey);

    // 3. Database Cross-Reference: Student
    const student = students.find(s => 
      (record.usn && String(s.usn).toLowerCase() === String(record.usn).toLowerCase()) || 
      (record.email && String(s.email).toLowerCase() === String(record.email).toLowerCase()) ||
      (record.admission_number && String(s.admission_number).toLowerCase() === String(record.admission_number).toLowerCase())
    );

    if (!student) {
      status = 'error';
      issues.push('Student not found in database');
      suggestedMatches = findSuggestedMatches(record.student_name, students);
      if (suggestedMatches.length > 0) {
        issues.push(`${suggestedMatches.length} fuzzy match(es) suggested`);
      }
    } else {
      studentId = student.id;
      if (!student.is_active) {
        status = 'warning';
        issues.push('Student is marked as inactive');
      }
      
      // Check for significant name mismatch (sanity check)
      const nameSimilarity = getSimilarity(record.student_name?.toLowerCase() || '', student.name?.toLowerCase() || '');
      if (nameSimilarity < 0.7 && record.student_name) {
        if (status !== 'error') status = 'warning';
        issues.push(`Name mismatch: File says "${record.student_name}", DB has "${student.name}"`);
      }
    }

    // 4. Database Cross-Reference: Session
    const session = sessions.find(s => s.date === record.date);
    if (!session) {
      if (status !== 'error') status = 'warning';
      issues.push('No session found for this date');
    } else {
      sessionId = session.id;
    }

    // 5. Database Cross-Reference: Existing Attendance
    if (studentId && sessionId) {
      const alreadyExists = attendance.some(a => 
        a.student_id === studentId && a.session_id === sessionId
      );
      if (alreadyExists) {
        if (status !== 'error') status = 'warning';
        issues.push('Attendance already exists in database');
      }
    }

    // Final Status override: if any critical issue, it's an error
    const criticalIssues = ['Missing student name', 'No identifier', 'Invalid date', 'Student not found', 'Duplicate entry'];
    if (issues.some(issue => criticalIssues.some(ci => issue.includes(ci)))) {
      status = 'error';
    }

    return {
      ...record,
      student_id: studentId,
      session_id: sessionId,
      status,
      issues,
      suggestedMatches,
      isExcluded: false
    };
  });
}
