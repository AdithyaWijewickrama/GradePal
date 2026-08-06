import { getClient, calcGPA, fmtGPA, GRADE_POINTS, NON_GPA_GRADES, DEPARTMENTS, BATCHES } from './config.js';

const supabase = getClient();
const el = (id) => document.getElementById(id);

(async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  el('user-email').textContent = session.user.email;

  const { data: adminOk, error } = await supabase.rpc('is_admin');
  if (error || !adminOk) {
    el('not-admin-banner').classList.remove('hidden');
    setTimeout(() => (window.location.href = 'index.html'), 1800);
    return;
  }

  await loadAndRender();
})();

el('signout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

async function loadAndRender() {
  const [{ data: profiles }, { data: grades }, { data: modules }, { data: semesters }] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('grades').select('user_id, module_id, grade'),
    supabase.from('modules').select('*'),
    supabase.from('semesters').select('*')
  ]);

  const students = (profiles || []).filter(p => !p.is_admin);
  const moduleById = Object.fromEntries((modules || []).map(m => [m.id, m]));

  const gradesByUser = {};
  for (const g of (grades || [])) (gradesByUser[g.user_id] ||= []).push(g);

  const studentStats = students.map(s => {
    const userGrades = gradesByUser[s.id] || [];
    const entries = userGrades.map(g => ({ credits: moduleById[g.module_id]?.credits || 0, grade: g.grade }));
    const gradedCount = userGrades.filter(g => g.grade).length;
    return { ...s, gradedCount, cgpa: calcGPA(entries) };
  });

  renderKpis(students, modules, semesters, grades, studentStats);
  renderGradeDistribution(grades);
  renderGroupAverage('dept-chart', DEPARTMENTS.map(d => d.code), studentStats, 'department');
  renderGroupAverage('batch-chart', BATCHES, studentStats, 'batch', (b) => `Batch ${b}`);
  renderLeaderboard(studentStats);
}

function renderKpis(students, modules, semesters, grades, studentStats) {
  const gradedStudents = studentStats.filter(s => s.gradedCount > 0);
  const avgCgpa = gradedStudents.length
    ? gradedStudents.reduce((sum, s) => sum + s.cgpa, 0) / gradedStudents.length
    : 0;

  const cards = [
    { label: 'Students', value: students.length },
    { label: 'Semesters', value: (semesters || []).length },
    { label: 'Modules', value: (modules || []).length },
    { label: 'Grades recorded', value: (grades || []).filter(g => g.grade).length },
    { label: 'Faculty avg. CGPA', value: gradedStudents.length ? fmtGPA(avgCgpa) : '—' }
  ];

  const row = el('kpi-row');
  row.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-label">${c.label}</div>
    </div>
  `).join('');
}

function renderGradeDistribution(grades) {
  const order = ['A+','A','A-','B+','B','B-','C+','C','C-','E','MC','AC','WH'];
  const counts = Object.fromEntries(order.map(g => [g, 0]));
  for (const g of (grades || [])) {
    if (g.grade && counts[g.grade] !== undefined) counts[g.grade]++;
  }
  const max = Math.max(1, ...Object.values(counts));
  const container = el('grade-chart');
  container.innerHTML = order.map(g => barRow(g, counts[g], max)).join('');
}

function renderGroupAverage(containerId, keys, studentStats, field, labelFn) {
  const rows = keys.map(k => {
    const group = studentStats.filter(s => s[field] === k && s.gradedCount > 0);
    const avg = group.length ? group.reduce((sum, s) => sum + s.cgpa, 0) / group.length : 0;
    return { key: labelFn ? labelFn(k) : k, avg, count: group.length };
  });
  const max = 4.0;
  const container = el(containerId);
  container.innerHTML = rows.map(r => barRow(r.key, r.avg, max, fmtGPA(r.avg) + (r.count ? '' : ' (n/a)'))).join('');
}

function barRow(label, value, max, displayValue) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return `
    <div class="bar-row">
      <span class="bar-label">${label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
      <span class="bar-value">${displayValue !== undefined ? displayValue : value}</span>
    </div>
  `;
}

function renderLeaderboard(studentStats) {
  const top = studentStats.filter(s => s.gradedCount > 0).sort((a, b) => b.cgpa - a.cgpa).slice(0, 10);
  const tbody = el('top-tbody');
  if (top.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-faint); padding:24px;">No graded students yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = top.map((s, i) => `
    <tr>
      <td class="mod-credits">${i + 1}</td>
      <td>${s.full_name || '<span class="hint">unnamed</span>'}<br><span class="hint" style="font-size:11px;">${s.email}</span></td>
      <td class="mod-credits">${s.batch || '—'}</td>
      <td class="mod-credits">${s.department || '—'}</td>
      <td class="mod-credits">${s.gradedCount}</td>
      <td class="mod-credits" style="color:var(--gold); font-weight:600;">${fmtGPA(s.cgpa)}</td>
    </tr>
  `).join('');
}
