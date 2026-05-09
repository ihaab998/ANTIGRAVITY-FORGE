/**
 * CSV Column Mapping Agent — Gemini Integration
 *
 * Sends parsed CSV headers + sample rows to Gemini and returns
 * a structured column mapping for the ForgeTrack attendance schema.
 *
 * Phase 4 Step 2 — does NOT perform validation or DB writes.
 */
console.log(import.meta.env.VITE_GEMINI_API_KEY);
import { gemini } from './gemini';

// ── Allowed target fields (enum) ──
export const ALLOWED_TARGET_FIELDS = [
  'student_name',
  'usn',
  'admission_number',
  'email',
  'branch_code',
  'date',
  'session_topic',
  'attendance_status',
  'IGNORE',
];

// Human-readable labels for the UI dropdowns
export const TARGET_FIELD_LABELS = {
  student_name: 'Student Name',
  usn: 'USN',
  admission_number: 'Admission Number',
  email: 'Email',
  branch_code: 'Branch Code',
  date: 'Date',
  session_topic: 'Session Topic',
  attendance_status: 'Attendance Status',
  IGNORE: 'IGNORE',
};

// ── Allowed metadata values ──
export const DATE_FORMATS = ['DD/M/YY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'D-MMM', 'OTHER'];
export const ATTENDANCE_CONVENTIONS = ['TRUE/FALSE', 'P/A', 'Present/Absent', '1/0', 'Y/N'];

// ── System prompt ──
const SYSTEM_PROMPT = `You are a CSV attendance mapping assistant for an educational bootcamp.

You will receive spreadsheet column headers and the first 5 sample data rows.

Your task is to map each source column to ONE of these target fields:
- student_name
- usn
- admission_number
- email
- branch_code
- date
- session_topic
- attendance_status
- IGNORE

Important rules:
1. If the spreadsheet is "pivoted" (dates are column headers like "15/4/26", "8/4/26"), set is_pivoted to true and list those date columns in date_columns. Map each date column to "date" in the mapping.
2. Detect the date format used (DD/M/YY, DD/MM/YYYY, YYYY-MM-DD, D-MMM, or OTHER).
3. Detect the attendance marker convention (TRUE/FALSE, P/A, Present/Absent, 1/0, Y/N).
4. Columns like "SL No", "n8n invite link", serial numbers, or any column that does not match the target fields should be mapped to "IGNORE".
5. Map "name" or "student name" or similar to "student_name".
6. Map "USN" or "usn" or "roll number" to "usn".
7. Only use target fields from the allowed list above. Never invent new field names.

Return ONLY valid JSON in this exact format:
{
  "mapping": { "<source_column>": "<target_field>" },
  "date_format": "DD/M/YY",
  "attendance_convention": "TRUE/FALSE",
  "is_pivoted": true,
  "date_columns": ["15/4/26", "8/4/26"]
}

If the sheet is NOT pivoted, set is_pivoted to false and date_columns to an empty array.`;

/**
 * Call Gemini to map CSV columns to the ForgeTrack schema.
 *
 * @param {string[]} headers — the column headers from the uploaded file
 * @param {Object[]} sampleRows — the first 5 rows of data
 * @returns {Promise<Object>} — the validated mapping response
 * @throws {Error} — on API failure, malformed JSON, or invalid fields
 */
export async function getColumnMapping(headers, sampleRows) {
  const userPrompt = `Here are the column headers and sample data from the uploaded attendance file:

HEADERS:
${JSON.stringify(headers)}

SAMPLE DATA (first ${sampleRows.length} rows):
${JSON.stringify(sampleRows, null, 2)}

Please analyze and return the column mapping JSON.`;

  const model = gemini.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });

  const result = await model.generateContent([SYSTEM_PROMPT, userPrompt]);
  const responseText = result.response.text();

  // Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error('AI returned invalid JSON. Please map columns manually.');
  }

  // Validate structure
  const validationError = validateMappingResponse(parsed);
  if (validationError) {
    throw new Error(validationError);
  }

  return parsed;
}

/**
 * Validate the Gemini response against the allowed schema.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateMappingResponse(response) {
  if (!response || typeof response !== 'object') {
    return 'AI response is not a valid object.';
  }

  // Check mapping exists and is an object
  if (!response.mapping || typeof response.mapping !== 'object') {
    return 'AI response is missing the "mapping" field.';
  }

  // Validate every mapped target field is in the allowed list
  const mappedValues = Object.values(response.mapping);
  for (const value of mappedValues) {
    if (!ALLOWED_TARGET_FIELDS.includes(value)) {
      return `AI returned an unsupported target field: "${value}". Allowed: ${ALLOWED_TARGET_FIELDS.join(', ')}`;
    }
  }

  // Validate is_pivoted is boolean
  if (typeof response.is_pivoted !== 'boolean') {
    return 'AI response "is_pivoted" must be a boolean.';
  }

  // Validate date_columns is array
  if (!Array.isArray(response.date_columns)) {
    return 'AI response "date_columns" must be an array.';
  }

  // Validate date_format
  if (response.date_format && !DATE_FORMATS.includes(response.date_format)) {
    // Non-fatal — we'll let it through but the user can correct it
  }

  // Validate attendance_convention
  if (response.attendance_convention && !ATTENDANCE_CONVENTIONS.includes(response.attendance_convention)) {
    // Non-fatal — we'll let it through but the user can correct it
  }

  return null; // valid
}
