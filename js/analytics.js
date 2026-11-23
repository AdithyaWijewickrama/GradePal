import { getClient, calcGPA, gpaWeight, fmtGPA, escapeHtml, DEPARTMENTS, BATCHES, GRADE_POINTS, NON_GPA_GRADES, CLASS_BANDS, classFor, GRADE_ORDER } from './config.js';
import { setupViewTabs, setupBatchView } from './analytics-batch.js';

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
  const [{ data: profiles }, { data: grades }, { data: modules }, { data: semesters }, { data: curricula }, { data: batchCurricula }] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('grades').select('user_id, module_id, grade'),
    supabase.from('modules').select('*'),
    supabase.from('semesters').select('*'),
    supabase.from('curricula').select('*'),
    supabase.from('batch_curricula').select('*')
  ]);

  const students = (profiles || []).filter(p => !p.is_admin);
  const studentIds = new Set(students.map(s => s.id));
  const studentGrades = (grades || []).filter(g => studentIds.has(g.user_id));
  const moduleById = Object.fromEntries((modules || []).map(m => [m.id, m]));
  const semNumberById = Object.fromEntries((semesters || []).map(s => [s.id, s.semester_number]));
  const curriculumByBatch = Object.fromEntries((batchCurricula || []).map(b =>
    [b.batch, (curricula || []).find(c => c.code === b.curriculum_code)]));

  const gradesByUser = {};
  for (const g of studentGrades) (gradesByUser[g.user_id] ||= []).push(g);

  const studentStats = students.map(s => {
    const userGrades = gradesByUser[s.id] || [];
    const curriculum = curriculumByBatch[s.batch];
    const entries = userGrades.map(g => {
      const mod = moduleById[g.module_id];
      return { credits: mod?.credits || 0, grade: g.grade, weight: gpaWeight(curriculum, semNumberById[mod?.semester_id]) };
    });
    // SGPA per semester number, over the semesters this student has grades in
    const bySem = {};
    for (const g of userGrades) {
      const mod = moduleById[g.module_id];
      const n = semNumberById[mod?.semester_id];
      if (!n) continue;
      (bySem[n] ||= []).push({ credits: mod.credits, grade: g.grade });
    }
    const sgpaBySem = {};
    for (const [n, list] of Object.entries(bySem)) {
      if (list.some(e => GRADE_POINTS[e.grade] !== undefined)) sgpaBySem[n] = calcGPA(list);
    }
    const gradedCount = userGrades.filter(g => g.grade).length;
    const gpaGradedCount = userGrades.filter(g => GRADE_POINTS[g.grade] !== undefined).length;
    const gpaCredits = userGrades.reduce((sum, g) => sum + (GRADE_POINTS[g.grade] !== undefined ? (Number(moduleById[g.module_id]?.credits) || 0) : 0), 0);
    return { ...s, gradedCount, gpaGradedCount, gpaCredits, rowCount: userGrades.length, semNumbers: new Set(Object.keys(bySem).map(Number)), sgpaBySem, cgpa: calcGPA(entries) };
  });

  renderKpis(students, modules, semesters, studentGrades, studentStats);
  renderClassBreakdown(studentStats);
  renderCgpaHistogram(studentStats);
  renderSemesterAverages(studentStats);
  renderSem12Coverage(studentStats);
  renderGradeDistribution(studentGrades);
  renderGroupAverage('dept-chart', DEPARTMENTS.map(d => d.code), studentStats, 'department');
  renderGroupAverage('batch-chart', BATCHES, studentStats, 'batch', (b) => `Batch ${b}`);
  renderDeptBatchGrid(studentStats);
  setupModuleTable(modules, semesters, studentGrades);
  renderLeaderboard(studentStats);

  setupBatchView({ students, studentStats, studentGrades, modules: modules || [], semesters: semesters || [] }, {
    ranked, median, barRow, renderClassBreakdown, renderCgpaHistogram, renderSemesterAverages,
    renderGradeDistribution, setupModuleTable
  });
}

setupViewTabs();

const ranked = (studentStats) => studentStats.filter(s => s.gpaGradedCount > 0);

function median(nums) {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function renderKpis(students, modules, semesters, grades, studentStats) {
  const active = ranked(studentStats);
  const cgpas = active.map(s => s.cgpa);
  const avgCgpa = cgpas.length ? cgpas.reduce((a, b) => a + b, 0) / cgpas.length : 0;
  const complete = students.filter(s => s.full_name?.trim() && s.student_number?.trim() && s.batch).length;
  const noDept = students.filter(s => !s.department).length;
  const recorded = grades.filter(g => g.grade).length;
  const pendingRows = grades.filter(g => !g.grade).length;
  const pct = (n, d) => d ? Math.round((n / d) * 100) + '%' : '—';

  const cards = [
    { label: 'Students', value: students.length, sub: `${active.length} with grades` },
    { label: 'Profiles complete', value: pct(complete, students.length), sub: `${complete} of ${students.length}` },
    { label: 'No department', value: noDept, sub: 'Sem 3–8 locked' },
    { label: 'Faculty avg. CGPA', value: active.length ? fmtGPA(avgCgpa) : '—', sub: `median ${active.length ? fmtGPA(median(cgpas)) : '—'}` },
    { label: 'Highest CGPA', value: active.length ? fmtGPA(Math.max(...cgpas)) : '—', sub: `lowest ${active.length ? fmtGPA(Math.min(...cgpas)) : '—'}` },
    { label: 'Grades recorded', value: recorded, sub: `${active.length ? (recorded / active.length).toFixed(1) : '0'} per active student` },
    { label: 'Saved as pending', value: pct(pendingRows, grades.length), sub: `${pendingRows} rows without a grade` },
    { label: 'Catalogue', value: (modules || []).length, sub: `modules in ${(semesters || []).length} semesters` }
  ];

  el('kpi-row').innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-sub">${c.sub}</div>
    </div>
  `).join('');
  el('kpi-note').textContent = 'Averages, classes and the leaderboard count only students with at least one GPA grade (MC/AC/WH and pending excluded).';
}

function renderClassBreakdown(studentStats, target = 'class-chart') {
  const active = ranked(studentStats);
  const counts = CLASS_BANDS.map(b => ({ label: b.label, n: active.filter(s => classFor(s.cgpa).label === b.label).length }));
  const max = Math.max(1, ...counts.map(c => c.n));
  el(target).innerHTML = counts.map(c =>
    barRow(c.label, c.n, max, `${c.n}${active.length ? ' · ' + Math.round(c.n / active.length * 100) + '%' : ''}`)).join('');
}

function renderCgpaHistogram(studentStats, target = 'cgpa-hist', step = 0.5) {
  const active = ranked(studentStats);
  const bins = [];
  const nBins = Math.round(4 / step);
  for (let i = 0; i < nBins; i++) bins.push({ lo: i * step, hi: (i + 1) * step, n: 0 });
  for (const s of active) {
    const i = Math.min(bins.length - 1, Math.floor(s.cgpa / step + 1e-9));
    bins[i].n++;
  }
  const shown = bins.filter(b => b.lo >= 1.5 || b.n > 0); // hide empty low bins
  const max = Math.max(1, ...shown.map(b => b.n));
  const fmt = (v) => step < 0.5 ? v.toFixed(2) : v.toFixed(1);
  el(target).innerHTML = shown.reverse().map(b =>
    barRow(`${fmt(b.lo)}–${b.hi >= 4 ? (step < 0.5 ? '4.00' : '4.0') : (b.hi - 0.01).toFixed(2)}`, b.n, max)).join('');
}

function renderSemesterAverages(studentStats, target = 'sem-chart') {
  const rows = [];
  for (let n = 1; n <= 8; n++) {
    const vals = studentStats.map(s => s.sgpaBySem[n]).filter(v => v !== undefined);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    rows.push(barRow(`Semester ${n}`, avg, 4, vals.length ? `${fmtGPA(avg)} · ${vals.length}` : 'n/a'));
  }
  el(target).innerHTML = rows.join('') +
    '<p class="fine-print" style="margin-top:4px;">Value · number of students with grades in that semester.</p>';
}

function renderSem12Coverage(studentStats) {
  const total = studentStats.length;
  const has1 = studentStats.filter(s => s.semNumbers.has(1)).length;
  const has2 = studentStats.filter(s => s.semNumbers.has(2)).length;
  const both = studentStats.filter(s => s.semNumbers.has(1) && s.semNumbers.has(2)).length;
  const none = studentStats.filter(s => s.rowCount === 0).length;
  const max = Math.max(1, total);
  const pct = (n) => total ? ` · ${Math.round(n / total * 100)}%` : '';
  el('coverage-chart').innerHTML = [
    barRow('Semester 1', has1, max, has1 + pct(has1)),
    barRow('Semester 2', has2, max, has2 + pct(has2)),
    barRow('Both', both, max, both + pct(both)),
    barRow('Nothing saved', none, max, none + pct(none))
  ].join('');
}

function renderDeptBatchGrid(studentStats) {
  const active = ranked(studentStats);
  const depts = [...DEPARTMENTS.map(d => d.code), null];
  const head = `<thead><tr><th>Dept</th>${BATCHES.map(b => `<th>Batch ${b}</th>`).join('')}<th>All</th></tr></thead>`;
  const cell = (group) => {
    if (!group.length) return '<td class="mod-credits">—</td>';
    const avg = group.reduce((a, s) => a + s.cgpa, 0) / group.length;
    return `<td><span style="color:var(--gold); font-weight:600;">${fmtGPA(avg)}</span><span class="grid-cell-n">n=${group.length}</span></td>`;
  };
  const body = depts.map(d => {
    const inDept = active.filter(s => (s.department || null) === d);
    return `<tr><td class="mod-code">${d || 'None yet'}</td>${BATCHES.map(b => cell(inDept.filter(s => s.batch === b))).join('')}${cell(inDept)}</tr>`;
  }).join('');
  const allRow = `<tr><td class="mod-code">All</td>${BATCHES.map(b => cell(active.filter(s => s.batch === b))).join('')}${cell(active)}</tr>`;
  el('dept-batch-grid').innerHTML = head + `<tbody>${body}${allRow}</tbody>`;
}

function setupModuleTable(modules, semesters, grades, filterId = 'module-sem-filter', tbodyId = 'module-tbody') {
  const semById = Object.fromEntries((semesters || []).map(s => [s.id, s]));
  const byModule = {};
  for (const g of grades) (byModule[g.module_id] ||= []).push(g.grade);

  const stats = (modules || []).map(m => {
    const list = byModule[m.id] || [];
    const gpa = list.filter(g => GRADE_POINTS[g] !== undefined);
    const avg = gpa.length ? gpa.reduce((a, g) => a + GRADE_POINTS[g], 0) / gpa.length : null;
    const sem = semById[m.semester_id];
    return {
      m, sem, semNumber: sem?.semester_number,
      graded: gpa.length, avg,
      eRate: gpa.length ? list.filter(g => g === 'E').length / gpa.length : 0,
      nonGpa: list.filter(g => NON_GPA_GRADES.includes(g)).length,
      pending: list.filter(g => !g).length
    };
  }).filter(s => s.graded > 0)
    .sort((a, b) => a.avg - b.avg || b.graded - a.graded);

  const filter = el(filterId);
  const nums = [...new Set(stats.map(s => s.semNumber).filter(Boolean))].sort((a, b) => a - b);
  filter.innerHTML = '<option value="">All semesters</option>' + nums.map(n => `<option value="${n}">Semester ${n}</option>`).join('');

  const render = () => {
    const want = filter.value ? Number(filter.value) : null;
    const rows = stats.filter(s => !want || s.semNumber === want);
    const tbody = el(tbodyId);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-faint); padding:24px;">No graded modules yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(s => `
      <tr>
        <td class="mod-code">${escapeHtml(s.m.code)}<span class="mod-name-sub">${escapeHtml(s.m.name)}</span></td>
        <td>${escapeHtml(s.m.name)}</td>
        <td class="mod-credits">${s.semNumber ?? '—'}${s.sem?.department ? ' ' + escapeHtml(s.sem.department) : ''}</td>
        <td class="mod-credits">${s.graded}</td>
        <td class="mod-credits" style="color:var(--gold); font-weight:600;">${s.avg.toFixed(2)}</td>
        <td class="mod-credits ${s.eRate >= 0.1 ? 'rate-bad' : ''}">${Math.round(s.eRate * 100)}%</td>
        <td class="mod-credits">${s.nonGpa}</td>
        <td class="mod-credits">${s.pending}</td>
      </tr>
    `).join('');
  };
  filter.onchange = render;
  render();
}

function renderGradeDistribution(grades, target = 'grade-chart') {
  const order = GRADE_ORDER;
  const counts = Object.fromEntries(order.map(g => [g, 0]));
  for (const g of (grades || [])) {
    if (g.grade && counts[g.grade] !== undefined) counts[g.grade]++;
  }
  const max = Math.max(1, ...Object.values(counts));
  const container = el(target);
  container.innerHTML = order.map(g => barRow(g, counts[g], max)).join('');
}

function renderGroupAverage(containerId, keys, studentStats, field, labelFn) {
  const rows = keys.map(k => {
    const group = studentStats.filter(s => s[field] === k && s.gpaGradedCount > 0);
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
  const top = studentStats.filter(s => s.gpaGradedCount > 0).sort((a, b) => b.cgpa - a.cgpa).slice(0, 100);
  const tbody = el('top-tbody');
  if (top.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-faint); padding:24px;">No graded students yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = top.map((s, i) => `
    <tr>
      <td class="mod-credits">${i + 1}</td>
      <td>${s.full_name ? escapeHtml(s.full_name) : '<span class="hint">unnamed</span>'}<br><span class="hint" style="font-size:11px;">${escapeHtml(s.email)}</span></td>
      <td class="mod-credits">${escapeHtml(s.batch || '—')}</td>
      <td class="mod-credits">${escapeHtml(s.department || '—')}</td>
      <td class="mod-credits">${s.gradedCount}</td>
      <td class="mod-credits" style="color:var(--gold); font-weight:600;">${fmtGPA(s.cgpa)}</td>
    </tr>
  `).join('');
}
