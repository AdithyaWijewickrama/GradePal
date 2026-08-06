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
  "C+": 2.4, "C": 2.0, "C-": 1.7,
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

/**
 * Compute a weighted GPA over a list of {credits, grade} entries.
 * Ignores modules with no grade, 0-credit modules, and non-GPA grades (MC/AC/WH).
 */
export function calcGPA(entries) {
  let creditSum = 0, pointSum = 0;
  for (const e of entries) {
    if (!e.grade || NON_GPA_GRADES.includes(e.grade)) continue;
    const gp = GRADE_POINTS[e.grade];
    if (gp === undefined) continue;
    const c = Number(e.credits) || 0;
    if (c <= 0) continue;
    creditSum += c;
    pointSum += c * gp;
  }
  return creditSum > 0 ? pointSum / creditSum : 0;
}

export function fmtGPA(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}
