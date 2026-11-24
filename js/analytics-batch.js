// Batch tab of the admin Analytics page: one batch's distributions and a CGPA rank list.
// Rendering helpers are passed in from analytics.js so both tabs draw charts the same way.
import { fmtGPA, escapeHtml, calcGPA, GRADE_POINTS, DEPARTMENTS, BATCHES, CLASS_BANDS, classFor } from './config.js';

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
  rank.load(inBatch, batch, data);
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
// Rank list, laid out like the faculty's official rank list
// ("27th Batch – Academic Rank List (Semester 1)"):
//  - ranks by one semester's GPA or by overall CGPA, highest first;
//  - standard competition ranking ("1, 1, 1, 4") on the full-precision GPA,
//    so two students share a rank only when their GPAs are exactly equal, even
//    if both show the same 4-decimal value (the official list does the same);
//  - "Ranked students" are those with a GPA for that scope; students without
//    one can be listed at the bottom with 0.0000 and a shared last rank;
//  - "Batch avg" is the mean GPA of the ranked students.
// ---------------------------------------------------------------------------
const EPS = 1e-9;

function assignRanks(list, field) {
  let prev = null, prevRank = 0;
  list.forEach((s, i) => {
    const rank = prev !== null && Math.abs(s.gpa - prev) < EPS ? prevRank : i + 1;
    s[field] = rank;
    prev = s.gpa; prevRank = rank;
  });
}

const ordinal = (n) => {
  const v = Number(n);
  if (!Number.isInteger(v)) return String(n);
  const t = v % 100, o = v % 10;
  return v + (t >= 11 && t <= 13 ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th');
};
const fmt4 = (n) => n.toFixed(4);

function setupRankList() {
  const scopeSel = el('rank-scope');
  const deptSel = el('rank-dept');
  const search = el('rank-search');
  const showUnranked = el('rank-show-unranked');
  let state = null; // { batch, inBatch, perSem }
  let view = null;  // the current table: { title, gpaLabel, ranked, unranked, shown, stats }

  // Per student, per semester number: GPA grades counted and credits behind them.
  function semesterDetail(inBatch, data) {
    const moduleById = Object.fromEntries(data.modules.map(m => [m.id, m]));
    const semNo = Object.fromEntries(data.semesters.map(s => [s.id, s.semester_number]));
    const ids = new Set(inBatch.map(s => s.id));
    const out = {};
    for (const g of data.studentGrades) {
      if (!ids.has(g.user_id) || GRADE_POINTS[g.grade] === undefined) continue;
      const mod = moduleById[g.module_id];
      const n = semNo[mod?.semester_id];
      if (!n) continue;
      const rec = ((out[g.user_id] ||= {})[n] ||= { count: 0, credits: 0 });
      rec.count++;
      rec.credits += Number(mod.credits) || 0;
    }
    return out;
  }

  const load = (inBatch, batch, data) => {
    const perSem = semesterDetail(inBatch, data);
    state = { batch, inBatch, perSem };

    const sems = [...new Set(inBatch.flatMap(s => Object.keys(s.sgpaBySem).map(Number)))].sort((a, b) => a - b);
    const keep = scopeSel.value;
    scopeSel.innerHTML = '<option value="cgpa">Overall CGPA</option>' +
      sems.map(n => `<option value="${n}">Semester ${n} GPA</option>`).join('');
    scopeSel.value = [...scopeSel.options].some(o => o.value === keep) ? keep : (sems.includes(1) ? '1' : 'cgpa');
    build();
  };

  // Rank the whole batch for the chosen scope (department filter applies after ranking).
  function build() {
    if (!state) return;
    const { batch, inBatch, perSem } = state;
    const scope = scopeSel.value;
    const isSem = scope !== 'cgpa';
    const n = Number(scope);

    const all = inBatch.map(s => {
      const sem = isSem ? perSem[s.id]?.[n] : null;
      const has = isSem ? s.sgpaBySem[n] !== undefined && sem?.credits > 0 : s.gpaGradedCount > 0;
      return {
        ...s,
        has,
        gpa: has ? (isSem ? s.sgpaBySem[n] : s.cgpa) : 0,
        graded: isSem ? (sem?.count || 0) : s.gpaGradedCount,
        credits: isSem ? (sem?.credits || 0) : (s.gpaCredits || 0),
        semCount: Object.keys(s.sgpaBySem).length
      };
    });
    const regCmp = (a, b) => (a.student_number || '~').localeCompare(b.student_number || '~', undefined, { numeric: true });
    const ranked = all.filter(s => s.has).sort((a, b) => (b.gpa - a.gpa) || regCmp(a, b));
    assignRanks(ranked, 'rank');
    const byDept = {};
    for (const s of ranked) if (s.department) (byDept[s.department] ||= []).push(s);
    for (const list of Object.values(byDept)) assignRanks(list, 'deptRank');
    const unranked = all.filter(s => !s.has).sort(regCmp);
    for (const s of unranked) { s.rank = ranked.length + 1; s.deptRank = null; }

    const scopeName = isSem ? `Semester ${n}` : 'Overall CGPA';
    view = {
      isSem, scopeName,
      title: `${ordinal(batch)} Batch – Academic Rank List (${scopeName})`,
      gpaLabel: isSem ? `${ordinal(n)} Sem` : 'CGPA',
      ranked, unranked, stats: null
    };

    // Department filter options, with counts of ranked students.
    const keep = deptSel.value;
    const depts = DEPARTMENTS.map(d => d.code).filter(code => all.some(s => s.department === code));
    const noDept = all.filter(s => !s.department).length;
    deptSel.innerHTML = `<option value="">All departments</option>` +
      depts.map(code => `<option value="${code}">${code}</option>`).join('') +
      (noDept ? `<option value="__none">None yet</option>` : '');
    deptSel.value = [...deptSel.options].some(o => o.value === keep) ? keep : '';

    el('rank-title').textContent = `Ranked by ${isSem ? `Semester ${n} GPA` : 'CGPA'}`;
    el('rank-thead').innerHTML = `<tr>
      <th>No.</th><th>Reg. no.</th><th>${escapeHtml(view.gpaLabel)}</th><th>Rank</th><th>Dept rank</th>
      <th>Student</th><th>Dept</th><th>${isSem ? 'Modules' : 'Sems'}</th><th>Credits</th><th>Class</th>
    </tr>`;

    el('rank-note').textContent =
      `Ranked on the full GPA, highest first. Students share a rank only when their GPAs are exactly equal, so two students showing the same 4-decimal GPA can have different ranks. ` +
      `Dept rank is the position within the student's department. ` +
      (isSem ? `Modules and Credits count only that semester's GPA grades (MC/AC/WH and pending are left out). `
             : `CGPA uses the curriculum's semester weights. Sems is the number of semesters with GPA grades, so a student with fewer semesters entered can rank above one with more. `) +
      `Students with no GPA are listed last with 0.0000 and a shared rank, like the official list.`;
    render();
  }

  function render() {
    if (!view) return;
    const dept = deptSel.value;
    const q = search.value.trim().toLowerCase();
    const match = (s) => inDept(s) &&
      (!q || [s.full_name, s.email, s.student_number].some(v => (v || '').toLowerCase().includes(q)));
    const inDept = (s) => !dept || (dept === '__none' ? !s.department : s.department === dept);
    const list = [...view.ranked, ...(showUnranked.checked ? view.unranked : [])];

    // Summary boxes follow the department filter (not the search box).
    const deptRanked = view.ranked.filter(inDept);
    const total = deptRanked.length + view.unranked.filter(inDept).length;
    const avg = deptRanked.length ? deptRanked.reduce((a, s) => a + s.gpa, 0) / deptRanked.length : 0;
    view.stats = { total, ranked: deptRanked.length, avg };
    const where = dept ? (dept === '__none' ? 'With no department' : `In ${dept}`) : 'In this batch';
    el('rank-summary').innerHTML = [
      ['Total students', total, where],
      ['Ranked students', deptRanked.length, view.isSem ? `With a ${view.scopeName} GPA` : 'With a CGPA'],
      [`Batch avg ${view.isSem ? `GPA (${view.scopeName.replace('Semester', 'Sem')})` : 'CGPA'}`, deptRanked.length ? fmt4(avg) : '—', 'Ranked students’ average']
    ].map(([label, value, sub]) => `
      <div class="rank-stat">
        <div class="rank-stat-label">${escapeHtml(label)}</div>
        <div class="rank-stat-value">${value}</div>
        <div class="rank-stat-sub">${escapeHtml(sub)}</div>
      </div>`).join('');

    // "No." is the position in the full list, so it stays the same while filtering or searching.
    list.forEach((s, i) => { s.no = i + 1; });
    view.shown = list.filter(match);

    const tbody = el('rank-tbody');
    if (!view.shown.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-faint); padding:24px;">${list.length ? 'No students match.' : 'No students in this batch yet.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = view.shown.map(s => {
      const cls = s.has ? classFor(s.gpa) : null;
      return `
      <tr class="${s.has ? '' : 'rank-unranked'}">
        <td class="mod-credits">${s.no}</td>
        <td class="mod-credits">${escapeHtml(s.student_number || '—')}</td>
        <td class="mod-credits rank-gpa" title="${s.has ? s.gpa.toFixed(6) : 'No GPA yet'}">${fmt4(s.gpa)}</td>
        <td class="mod-credits rank-cell">${s.rank}</td>
        <td class="mod-credits">${s.deptRank ?? '—'}</td>
        <td>${s.full_name ? escapeHtml(s.full_name) : '<span class="hint">unnamed</span>'}<br><span class="hint" style="font-size:11px;">${escapeHtml(s.email)}</span></td>
        <td class="mod-credits">${escapeHtml(s.department || '—')}</td>
        <td class="mod-credits">${view.isSem ? s.graded : s.semCount}</td>
        <td class="mod-credits">${s.credits ? +s.credits.toFixed(2) : '—'}</td>
        <td>${cls ? `<span class="class-pill class-${CLASS_BANDS.indexOf(cls)}">${escapeHtml(cls.label)}</span>` : '<span class="hint">No GPA</span>'}</td>
      </tr>`;
    }).join('');
  }

  scopeSel.onchange = build;
  deptSel.onchange = render;
  search.oninput = render;
  showUnranked.onchange = render;
  el('rank-csv').onclick = () => view && downloadCsv(view, state.batch, deptSel.value);
  el('rank-print').onclick = () => view && printRankList(view, deptSel.value);
  return { load };
}

function deptSuffix(dept) {
  return dept ? (dept === '__none' ? ' · No department' : ` · ${dept}`) : '';
}

function downloadCsv(view, batch, dept) {
  const header = ['No.', 'Reg. no.', view.gpaLabel, 'Rank', 'Dept rank', 'Name', 'Email', 'Department',
    view.isSem ? 'Modules' : 'Semesters', 'Credits', 'Class'];
  const cell = (v) => {
    let t = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // keep spreadsheet apps from running it as a formula
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = [header, ...view.shown.map(s => [
    s.no, s.student_number || '', fmt4(s.gpa), s.rank, s.deptRank ?? '', s.full_name || '', s.email || '',
    s.department || '', view.isSem ? s.graded : s.semCount, s.credits ? +s.credits.toFixed(2) : '',
    s.has ? classFor(s.gpa).label : 'No GPA'
  ])].map(row => row.map(cell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const scope = view.isSem ? view.scopeName.toLowerCase().replace(' ', '-') : 'cgpa';
  const suffix = dept ? '-' + (dept === '__none' ? 'no-dept' : dept) : '';
  a.href = URL.createObjectURL(blob);
  a.download = `batch-${batch}-${scope}${suffix}-rank-list.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// A printable page in the official list's layout: title band, three summary
// boxes, and a No. / Reg. no. / GPA / Rank table. Names and emails are left
// out, like the official list. The browser's print dialog can save it as PDF.
function printRankList(view, dept) {
  const rows = view.shown.map(s => `
    <tr><td>${s.no}</td><td>${escapeHtml(s.student_number || '—')}</td><td class="num">${fmt4(s.gpa)}</td><td class="rank">${s.rank}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(view.title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #1b2433; margin: 0; padding: 24px; }
  .band { background: #1d3557; color: #fff; text-align: center; font-size: 22px; font-weight: 700; padding: 8px 12px; }
  .sub { background: #e3e8f0; text-align: center; font-style: italic; font-size: 13px; color: #3b4658; padding: 3px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #cfd6e0; margin: 22px 0 36px; background: #f6f8fb; }
  .stats div { text-align: center; padding: 8px; border-left: 1px solid #cfd6e0; }
  .stats div:first-child { border-left: none; }
  .stats b { display: block; font-size: 11px; letter-spacing: .04em; color: #3b4658; }
  .stats strong { display: block; font-size: 22px; color: #1d3557; margin: 4px 0; }
  .stats span { font-size: 11px; color: #7a8597; }
  table { border-collapse: collapse; margin: 0 auto; width: 60%; min-width: 360px; font-size: 13px; }
  th, td { border: 1px solid #cfd6e0; padding: 6px 10px; text-align: center; }
  th { font-weight: 700; }
  tbody tr:nth-child(even) { background: #f6f8fb; }
  td.num { text-align: right; }
  td.rank { font-weight: 700; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  @media print { body { padding: 0; } .band, .sub, .stats, tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div class="band">${escapeHtml(view.title)}</div>
  <div class="sub">Faculty of Engineering | Ranked by ${view.isSem ? 'Final GPA' : 'CGPA'} in Descending Order${escapeHtml(deptSuffix(dept))}</div>
  <div class="stats">
    <div><b>TOTAL STUDENTS</b><strong>${view.stats.total}</strong><span>Enrolled in Batch</span></div>
    <div><b>RANKED STUDENTS</b><strong>${view.stats.ranked}</strong><span>With Completed GPA</span></div>
    <div><b>BATCH AVG ${view.isSem ? `GPA (${escapeHtml(view.scopeName.replace('Semester', 'SEM'))})` : 'CGPA'}</b><strong>${view.stats.ranked ? fmt4(view.stats.avg) : '—'}</strong><span>Active Students Avg</span></div>
  </div>
  <table><thead><tr><th>No.</th><th>REG No.</th><th>${escapeHtml(view.gpaLabel)}</th><th>Rank</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups for this page to print the rank list.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
