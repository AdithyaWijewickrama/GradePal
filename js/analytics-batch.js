// Batch tab of the admin Analytics page: one batch's distributions and a CGPA rank list.
// Rendering helpers are passed in from analytics.js so both tabs draw charts the same way.
import { fmtGPA, escapeHtml, DEPARTMENTS, BATCHES, CLASS_BANDS, classFor } from './config.js';

const el = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Faculty / Batch tabs. The open view and batch live in the URL hash
// (#batch=27) so a reload or a shared link opens the same view.
// ---------------------------------------------------------------------------
export function setupViewTabs() {
  for (const btn of document.querySelectorAll('.view-tab')) {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'batch') {
        const b = el('batch-select').value;
        history.replaceState(null, '', b ? `#batch=${encodeURIComponent(b)}` : '#batch');
      } else {
        history.replaceState(null, '', location.pathname + location.search);
      }
      showView(view);
    });
  }
  showView(readHash().view);
}

function readHash() {
  const m = location.hash.match(/^#batch(?:=([^&]+))?/);
  return m ? { view: 'batch', batch: m[1] ? decodeURIComponent(m[1]) : null } : { view: 'faculty', batch: null };
}

function showView(view) {
  for (const btn of document.querySelectorAll('.view-tab')) {
    const on = btn.dataset.view === view;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
  }
  el('view-faculty').classList.toggle('hidden', view !== 'faculty');
  el('view-batch').classList.toggle('hidden', view !== 'batch');
}

// ---------------------------------------------------------------------------
// Batch view
// ---------------------------------------------------------------------------
export function setupBatchView(data, r) {
  const { students, studentStats } = data;
  const present = new Set(students.map(s => s.batch).filter(Boolean));
  const batches = [...BATCHES.filter(b => present.has(b)), ...[...present].filter(b => !BATCHES.includes(b)).sort().reverse()];

  const select = el('batch-select');
  const counts = Object.fromEntries(batches.map(b => [b, students.filter(s => s.batch === b).length]));
  select.innerHTML = batches.length
    ? batches.map(b => `<option value="${escapeHtml(b)}">Batch ${escapeHtml(b)} · ${counts[b]}</option>`).join('')
    : '<option value="">No batches yet</option>';

  // Default: the batch in the URL, else the batch with the most students.
  const wanted = readHash().batch;
  const biggest = batches.slice().sort((a, b) => counts[b] - counts[a])[0];
  select.value = batches.includes(wanted) ? wanted : (biggest || '');

  const rank = setupRankList();
  const render = () => {
    const batch = select.value;
    if (!el('view-batch').classList.contains('hidden')) {
      history.replaceState(null, '', `#batch=${encodeURIComponent(batch)}`);
    }
    renderBatch(batch, data, r, rank);
  };
  select.onchange = render;
  render();
}

function renderBatch(batch, data, r, rank) {
  const { students, studentStats, studentGrades, modules, semesters } = data;
  const inBatch = studentStats.filter(s => s.batch === batch);
  const ids = new Set(inBatch.map(s => s.id));
  const batchGrades = studentGrades.filter(g => ids.has(g.user_id));

  el('batch-title').textContent = batch ? `Batch ${batch}` : 'Batch';
  renderBatchKpis(inBatch, batchGrades, r);
  r.renderClassBreakdown(inBatch, 'b-class-chart');
  r.renderCgpaHistogram(inBatch, 'b-cgpa-hist', 0.25);
  r.renderSemesterAverages(inBatch, 'b-sem-chart');
  renderDeptComparison(inBatch, r);
  r.renderGradeDistribution(batchGrades, 'b-grade-chart');
  r.setupModuleTable(modules, semesters, batchGrades, 'b-module-sem-filter', 'b-module-tbody');
  rank.load(inBatch);
}

function renderBatchKpis(inBatch, batchGrades, r) {
  const active = r.ranked(inBatch);
  const cgpas = active.map(s => s.cgpa);
  const n = cgpas.length;
  const avg = n ? cgpas.reduce((a, b) => a + b, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(cgpas.reduce((a, v) => a + (v - avg) ** 2, 0) / (n - 1)) : 0;
  const withDept = inBatch.filter(s => s.department).length;
  const first = active.filter(s => classFor(s.cgpa).label === CLASS_BANDS[0].label).length;
  const belowPass = active.filter(s => s.cgpa < 2).length;
  const recorded = batchGrades.filter(g => g.grade).length;
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const dash = (v) => n ? v : '—';

  const cards = [
    { label: 'Students', value: inBatch.length, sub: `${n} with grades` },
    { label: 'Department set', value: pct(withDept, inBatch.length), sub: `${withDept} of ${inBatch.length}` },
    { label: 'Avg. CGPA', value: dash(fmtGPA(avg)), sub: `median ${dash(fmtGPA(r.median(cgpas)))}` },
    { label: 'Highest CGPA', value: dash(fmtGPA(Math.max(...cgpas))), sub: `lowest ${dash(fmtGPA(Math.min(...cgpas)))}` },
    { label: 'Std. deviation', value: n > 1 ? fmtGPA(sd) : '—', sub: 'of CGPA' },
    { label: CLASS_BANDS[0].label, value: first, sub: `${pct(first, n)} of graded` },
    { label: 'Below 2.00', value: belowPass, sub: `${pct(belowPass, n)} of graded` },
    { label: 'Grades recorded', value: recorded, sub: `${n ? (recorded / n).toFixed(1) : '0'} per graded student` }
  ];
  el('b-kpi-row').innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-label">${escapeHtml(c.label)}</div>
      <div class="kpi-sub">${c.sub}</div>
    </div>
  `).join('');
  el('b-kpi-note').textContent = 'Averages, classes and the rank list count only students with at least one GPA grade (MC/AC/WH and pending excluded).';
}

function renderDeptComparison(inBatch, r) {
  const active = r.ranked(inBatch);
  const groups = [...DEPARTMENTS.map(d => d.code), null].map(code => {
    const g = active.filter(s => (s.department || null) === code);
    const avg = g.length ? g.reduce((a, s) => a + s.cgpa, 0) / g.length : 0;
    return { label: code || 'None yet', avg, n: g.length };
  });
  el('b-dept-chart').innerHTML = groups.map(g =>
    r.barRow(g.label, g.avg, 4, g.n ? `${fmtGPA(g.avg)} · ${g.n}` : 'n/a')).join('') +
    '<p class="fine-print" style="margin-top:4px;">Value · number of graded students.</p>';
}

// ---------------------------------------------------------------------------
// Rank list
// Standard competition ranking ("1, 2, 2, 4") on CGPA to 4 decimals, so two
// students only share a rank when their CGPAs really are equal.
// ---------------------------------------------------------------------------
const rankKey = (cgpa) => Math.round(cgpa * 10000);

function assignRanks(list, field) {
  let prevKey = null, prevRank = 0;
  list.forEach((s, i) => {
    const k = rankKey(s.cgpa);
    const rank = k === prevKey ? prevRank : i + 1;
    s[field] = rank;
    prevKey = k; prevRank = rank;
  });
}

function setupRankList() {
  let rows = [];
  let shown = [];
  const deptSel = el('rank-dept');
  const search = el('rank-search');

  const load = (inBatch) => {
    rows = inBatch
      .filter(s => s.gpaGradedCount > 0)
      .map(s => ({ ...s, semCount: Object.keys(s.sgpaBySem).length }))
      .sort((a, b) => b.cgpa - a.cgpa || (a.full_name || '').localeCompare(b.full_name || ''));
    assignRanks(rows, 'rank');
    const byDept = {};
    for (const s of rows) if (s.department) (byDept[s.department] ||= []).push(s);
    for (const list of Object.values(byDept)) assignRanks(list, 'deptRank');

    const keep = deptSel.value;
    const depts = DEPARTMENTS.map(d => d.code).filter(code => rows.some(s => s.department === code));
    const noDept = rows.filter(s => !s.department).length;
    deptSel.innerHTML = `<option value="">All departments · ${rows.length}</option>` +
      depts.map(code => `<option value="${code}">${code} · ${rows.filter(s => s.department === code).length}</option>`).join('') +
      (noDept ? `<option value="__none">None yet · ${noDept}</option>` : '');
    deptSel.value = [...deptSel.options].some(o => o.value === keep) ? keep : '';

    const ungraded = inBatch.length - rows.length;
    el('rank-note').textContent =
      `Students who share a CGPA share a rank. CGPA is shown to 2 decimals; hover it for 4. ` +
      `Dept rank is the position within the student's department in this batch. ` +
      `Sems is the number of semesters with GPA grades, so a student with fewer semesters entered can rank above one with more.` +
      (ungraded ? ` ${ungraded} student${ungraded === 1 ? '' : 's'} in this batch ${ungraded === 1 ? 'has' : 'have'} no GPA grades yet and ${ungraded === 1 ? 'is' : 'are'} not listed.` : '');
    render();
  };

  const render = () => {
    const dept = deptSel.value;
    const q = search.value.trim().toLowerCase();
    shown = rows.filter(s =>
      (!dept || (dept === '__none' ? !s.department : s.department === dept)) &&
      (!q || [s.full_name, s.email, s.student_number].some(v => (v || '').toLowerCase().includes(q))));
    const tbody = el('rank-tbody');
    if (!shown.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-faint); padding:24px;">${rows.length ? 'No students match.' : 'No graded students in this batch yet.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = shown.map(s => {
      const cls = classFor(s.cgpa);
      const clsIdx = CLASS_BANDS.indexOf(cls);
      return `
      <tr>
        <td class="mod-credits rank-cell">${s.rank}</td>
        <td class="mod-credits">${s.deptRank ?? '—'}</td>
        <td>${s.full_name ? escapeHtml(s.full_name) : '<span class="hint">unnamed</span>'}<br><span class="hint" style="font-size:11px;">${escapeHtml(s.email)}</span></td>
        <td class="mod-credits">${escapeHtml(s.student_number || '—')}</td>
        <td class="mod-credits">${escapeHtml(s.department || '—')}</td>
        <td class="mod-credits">${s.semCount}</td>
        <td class="mod-credits">${s.gpaGradedCount}</td>
        <td class="mod-credits" style="color:var(--gold); font-weight:600;" title="${s.cgpa.toFixed(4)}">${fmtGPA(s.cgpa)}</td>
        <td><span class="class-pill class-${clsIdx}">${escapeHtml(cls.label)}</span></td>
      </tr>`;
    }).join('');
  };

  deptSel.onchange = render;
  search.oninput = render;
  el('rank-csv').onclick = () => downloadCsv(shown, el('batch-select').value, deptSel.value);
  return { load };
}

function downloadCsv(list, batch, dept) {
  const header = ['Rank', 'Dept rank', 'Name', 'Email', 'Index no.', 'Department', 'Semesters', 'GPA grades', 'Credits', 'CGPA', 'Class'];
  const cell = (v) => {
    let t = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // keep spreadsheet apps from running it as a formula
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = [header, ...list.map(s => [
    s.rank, s.deptRank ?? '', s.full_name || '', s.email || '', s.student_number || '', s.department || '',
    s.semCount, s.gpaGradedCount, s.gpaCredits ?? '', s.cgpa.toFixed(4), classFor(s.cgpa).label
  ])].map(row => row.map(cell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const suffix = dept ? '-' + (dept === '__none' ? 'no-dept' : dept) : '';
  a.href = URL.createObjectURL(blob);
  a.download = `batch-${batch}${suffix}-rank-list.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

