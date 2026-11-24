// ============================================================================
// SHARED CONFIG — edit SUPABASE_URL / SUPABASE_ANON_KEY for your project.
// Get these from: Supabase Dashboard > Project Settings > API
// Also enable Google as an auth provider under Authentication > Providers,
// and add this app's URL to Authentication > URL Configuration > Redirect URLs.
// ============================================================================

export const SUPABASE_URL = "https://tzrgdzgjeottugzwdatr.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6cmdkemdqZW90dHVnendkYXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDA1MzEsImV4cCI6MjEwMTU3NjUzMX0.uo0eZT5L9sLVuWZURhbyz3acq2UAjAEI9_7olEFxeok";

// Loaded from CDN in each HTML file via:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
export function getClient() {
  if (!window.__sb) {
    window.__sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return window.__sb;
}

// Grade -> grade point map (used everywhere GPA is calculated)
export const GRADE_POINTS = {
  "A+": 4.0, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "E": 0.0
};

// Grades that exist as options but do not count toward GPA
export const NON_GPA_GRADES = ["MC", "AC", "WH"];

// Full selectable list, in display order
export const ALL_GRADES = ["A+","A","A-","B+","B","B-","C+","C","C-","E","MC","AC","WH","Pending"];

export const DEPARTMENTS = [
  { code: "DEIE",  name: "Electrical & Information Engineering" },
  { code: "DMME",  name: "Mechanical & Manufacturing Engineering" },
  { code: "DMENA", name: "Marine Engineering & Naval Architecture" },
  { code: "DCEE",  name: "Civil & Environmental Engineering" },
  { code: "DCE",   name: "Computer Engineering" }
];

export const BATCHES = ["27","26","25","24","23"];

// Degree classes by CGPA, highest first (Student Handbook 2025/26, section 12.5:
// First >= 3.70, Second Upper >= 3.30, Second Lower >= 3.00; a GPA of at least 2.00 is needed to graduate).
export const CLASS_BANDS = [
  { label: "First Class",  min: 3.70 },
  { label: "Second Upper", min: 3.30 },
  { label: "Second Lower", min: 3.00 },
  { label: "Pass",         min: 2.00 },
  { label: "Below pass",   min: 0 }
];

export function classFor(cgpa) {
  return CLASS_BANDS.find(b => cgpa >= b.min) || CLASS_BANDS[CLASS_BANDS.length - 1];
}

// Grades in display order for distribution charts
export const GRADE_ORDER = ["A+","A","A-","B+","B","B-","C+","C","C-","E","MC","AC","WH"];

/**
 * Compute a weighted GPA over a list of {credits, grade, weight?} entries.
 * weight defaults to 1 (plain credit-weighted average, i.e. SGPA).
 * Ignores modules with no grade, 0-credit modules, and non-GPA grades (MC/AC/WH).
 */
export function calcGPA(entries) {
  let creditSum = 0, pointSum = 0;
  for (const e of entries) {
    if (!e.grade || NON_GPA_GRADES.includes(e.grade)) continue;
    const gp = GRADE_POINTS[e.grade];
    if (gp === undefined) continue;
    const c = (Number(e.credits) || 0) * (e.weight ?? 1);
    if (c <= 0) continue;
    creditSum += c;
    pointSum += c * gp;
  }
  return creditSum > 0 ? pointSum / creditSum : 0;
}

/**
 * CGPA weight for a module in the given semester under a curriculum
 * (handbook Eq. 12.2: e.g. 0.05 for semesters 1–2, 0.15 for 3–8).
 * No curriculum, or an unknown semester, falls back to 1.
 */
export function gpaWeight(curriculum, semesterNumber) {
  if (!curriculum || !semesterNumber) return 1;
  const w = Number(semesterNumber) <= 2 ? curriculum.weight_common : curriculum.weight_specialisation;
  return Number(w) || 1;
}

// Escape user-controlled text before interpolating it into innerHTML templates
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

export function fmtGPA(n) {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}
