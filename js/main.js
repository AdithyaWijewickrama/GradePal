import { getClient, GRADE_POINTS, NON_GPA_GRADES, ALL_GRADES, calcGPA, gpaWeight, fmtGPA, escapeHtml, CLASS_BANDS, classFor, GRADE_ORDER } from './config.js';

const supabase = getClient();

let session = null;
let profile = null;
let isAdmin = false;
let curriculum = null;    // {code, name, weight_common, weight_specialisation} for the student's batch
let semesters = [];      // [{id, semester_number, department, batch_label}]
let modulesBySem = {};   // semesterId -> [module rows]
let gradesByModule = {}; // moduleId -> grade string ('' if pending)
let dirtyBySem = {};     // semesterId -> Set(moduleId) changed since last save
let activeTab = 'overview';

const el = (id) => document.getElementById(id);
const tabRail = el('tab-rail');
const content = el('content');
const loadingState = el('loading-state');
const noDeptBanner = el('no-department-banner');
const cgpaValue = el('cgpa-value');
const userEmailEl = el('user-email');
const adminLink = el('admin-link');
const toast = el('toast');
const profileModal = el('profile-modal');

function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.toggle('error', isError);
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 3200);
}


// ---------------------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------------------
(async function init() {
  const { data: { session: s } } = await supabase.auth.getSession();
  if (!s) { window.location.href = 'login.html'; return; }
  session = s;
  userEmailEl.textContent = session.user.email;

  await loadProfile();
  await checkAdmin();
  await loadCurriculum();
  await loadSemestersAndModules();
  await loadGrades();

  buildTabRail();
  renderAllPanels();
  updateCgpa();
  renderOverview();
  applyDeptLock();

  loadingState.classList.add('hidden');
  activateTab(activeTab);
  maybeShowProfileModal();
})();

el('profile-modal-btn').addEventListener('click', () => {
  profileModal.classList.add('hidden');
  activateTab('profile');
  el('p-name').focus();
});

function maybeShowProfileModal() {
  const incomplete = !profile?.full_name?.trim() || !profile?.student_number?.trim() || !profile?.batch;
  profileModal.classList.toggle('hidden', !incomplete);
}

el('signout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

el('goto-profile-btn')?.addEventListener('click', () => activateTab('profile'));

// ---------------------------------------------------------------------------
// DATA LOADING
// ---------------------------------------------------------------------------
async function loadProfile() {
  let { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error) { console.error(error); showToast('Could not load profile', true); return; }
  if (!data) {
    // fallback in case the DB trigger hasn't fired yet
    const { data: created, error: insErr } = await supabase.from('profiles')
      .insert({ id: session.user.id, email: session.user.email, full_name: session.user.user_metadata?.full_name || '' })
      .select().single();
    if (insErr) { console.error(insErr); }
    data = created;
  }
  profile = data || { id: session.user.id, email: session.user.email };
  fillProfileForm();
}

async function checkAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  isAdmin = !!data && !error;
  adminLink.classList.toggle('hidden', !isAdmin);
}

async function loadCurriculum() {
  curriculum = null;
  if (!profile?.batch) return;
  const { data, error } = await supabase.from('batch_curricula')
    .select('curriculum_code, curricula(*)').eq('batch', profile.batch).maybeSingle();
  // missing tables (curricula.sql not run yet) just means no curriculum-specific rules
  if (error) { console.warn('Could not load curriculum', error); return; }
  curriculum = data?.curricula || null;
}

async function loadSemestersAndModules() {
  const { data: semRows, error } = await supabase.from('semesters').select('*').order('semester_number');
  if (error) { console.error(error); showToast('Could not load semesters', true); return; }

  // keep: both common semesters (1,2) + the ones matching the student's department,
  // limited to shared semesters (no curriculum) and the student's own curriculum
  const visible = (semRows || []).filter(s =>
    (s.department === null || s.department === profile?.department) &&
    (s.curriculum_code == null || s.curriculum_code === curriculum?.code));

  // one semester per number: the curriculum's own version wins over a shared one
  const byNumber = new Map();
  for (const s of visible) {
    const existing = byNumber.get(s.semester_number);
    if (!existing || (existing.curriculum_code == null && s.curriculum_code != null)) byNumber.set(s.semester_number, s);
  }
  semesters = [...byNumber.values()].sort((a, b) => a.semester_number - b.semester_number);

  const ids = semesters.map(s => s.id);
  modulesBySem = {};
  if (ids.length === 0) return;

  const { data: modRows, error: modErr } = await supabase.from('modules').select('*').in('semester_id', ids).order('sort_order');
  if (modErr) { console.error(modErr); showToast('Could not load modules', true); return; }

  modulesBySem = {};
  for (const s of semesters) modulesBySem[s.id] = [];
  for (const m of (modRows || [])) modulesBySem[m.semester_id]?.push(m);
}

async function loadGrades() {
  const { data, error } = await supabase.from('grades').select('module_id, grade').eq('user_id', session.user.id);
  if (error) { console.error(error); return; }
  gradesByModule = {};
  for (const g of (data || [])) gradesByModule[g.module_id] = g.grade || '';
}

// ---------------------------------------------------------------------------
// TAB RAIL
// ---------------------------------------------------------------------------
function buildTabRail() {
  tabRail.innerHTML = '';

  const overviewBtn = document.createElement('button');
  overviewBtn.className = 'tab-btn';
  overviewBtn.type = 'button';
  overviewBtn.textContent = 'Overview';
  overviewBtn.dataset.tab = 'overview';
  overviewBtn.addEventListener('click', () => activateTab('overview'));
  tabRail.appendChild(overviewBtn);

  const commonLabel = document.createElement('div');
  commonLabel.className = 'tab-section-label';
  commonLabel.textContent = 'Common';
  tabRail.appendChild(commonLabel);

  for (let n = 1; n <= 2; n++) {
    tabRail.appendChild(makeTabButton(n));
  }

  const divider = document.createElement('div');
  divider.className = 'tab-divider';
  tabRail.appendChild(divider);

  const deptLabel = document.createElement('div');
  deptLabel.className = 'tab-section-label';
  deptLabel.textContent = profile?.department ? profile.department : 'Department (locked)';
  tabRail.appendChild(deptLabel);

  for (let n = 3; n <= 8; n++) {
    tabRail.appendChild(makeTabButton(n));
  }

  const divider2 = document.createElement('div');
  divider2.className = 'tab-divider';
  tabRail.appendChild(divider2);

  const profileBtn = document.createElement('button');
  profileBtn.className = 'tab-btn';
  profileBtn.type = 'button';
  profileBtn.textContent = 'Profile';
  profileBtn.dataset.tab = 'profile';
  profileBtn.addEventListener('click', () => activateTab('profile'));
  tabRail.appendChild(profileBtn);
}

function makeTabButton(semNumber) {
  const sem = semesters.find(s => s.semester_number === semNumber);
  const locked = semNumber >= 3 && !profile?.department;
  const btn = document.createElement('button');
  btn.className = 'tab-btn' + (locked ? ' locked' : '');
  btn.type = 'button';
  btn.dataset.tab = 'sem-' + semNumber;
  btn.disabled = locked;

  const label = document.createElement('span');
  label.textContent = 'Semester ' + semNumber;
  btn.appendChild(label);

  const sgpaTag = document.createElement('span');
  sgpaTag.className = 'tab-sgpa';
  sgpaTag.dataset.sgpaFor = 'sem-' + semNumber;
  sgpaTag.textContent = locked ? '🔒' : '—';
  btn.appendChild(sgpaTag);

  if (!locked) btn.addEventListener('click', () => activateTab('sem-' + semNumber));
  return btn;
}

function activateTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('[data-panel]').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('panel-' + tabId);
  if (panel) panel.classList.remove('hidden');
  content.scrollTop = 0;
}

// ---------------------------------------------------------------------------
// RENDER PANELS
// ---------------------------------------------------------------------------
function renderAllPanels() {
  // remove any previously rendered semester panels (idempotent re-render)
  document.querySelectorAll('.semester-panel[id^="panel-sem-"]').forEach(p => p.remove());

  for (let n = 1; n <= 8; n++) {
    const sem = semesters.find(s => s.semester_number === n);
    if (!sem) continue; // locked / not available for this department yet
    renderSemesterPanel(sem, n);
  }

  const profilePanel = document.getElementById('profile-panel');
  if (profilePanel) profilePanel.id = 'panel-profile';
}

function renderSemesterPanel(sem, semNumber) {
  const mods = modulesBySem[sem.id] || [];
  const isEmpty = mods.length === 0;
  const tpl = document.getElementById(isEmpty ? 'empty-panel-template' : 'semester-panel-template');
  const node = tpl.content.cloneNode(true);
  const panel = node.querySelector('[data-panel]');
  panel.id = 'panel-sem-' + semNumber;

  node.querySelector('[data-eyebrow]').textContent = [sem.department || 'COMMON', curriculum?.name, sem.batch_label]
    .filter(Boolean).join(' · ');
  node.querySelector('[data-title]').textContent = 'Semester ' + semNumber;

  if (isEmpty) {
    content.appendChild(node);
    return;
  }

  const tbody = node.querySelector('[data-tbody]');
  for (const m of mods) {
    tbody.appendChild(buildModuleRow(sem.id, m));
  }

  // target GPA planner only for semester 1 & 2
  if (semNumber === 1 || semNumber === 2) {
    const box = node.querySelector('[data-target-box]');
    box.classList.remove('hidden');
    const input = box.querySelector('[data-target-input]');
    const resultEl = box.querySelector('[data-target-result]');
    box.querySelector('[data-target-calc]').addEventListener('click', () => {
      runTargetCalc(sem.id, mods, input.value, resultEl);
    });
  }

  const saveStatusEl = node.querySelector('[data-save-status]');
  const saveBtnEl = node.querySelector('[data-save-btn]');
  saveBtnEl.addEventListener('click', () => saveSemester(sem.id, saveStatusEl, saveBtnEl));

  content.appendChild(node);
  refreshSemesterStats(sem.id, semNumber, mods);
}

function buildModuleRow(semId, mod) {
  const tr = document.createElement('tr');

  const tdCode = document.createElement('td');
  tdCode.className = 'mod-code';
  tdCode.textContent = mod.code;
  // shown under the code on narrow screens, where the name column is hidden
  const nameSub = document.createElement('span');
  nameSub.className = 'mod-name-sub';
  nameSub.textContent = mod.name;
  tdCode.appendChild(nameSub);
  tr.appendChild(tdCode);

  const tdName = document.createElement('td');
  tdName.textContent = mod.name;
  tr.appendChild(tdName);

  const tdCredits = document.createElement('td');
  tdCredits.className = 'mod-credits';
  tdCredits.textContent = mod.credits;
  tr.appendChild(tdCredits);

  const tdGrade = document.createElement('td');
  const select = document.createElement('select');
  select.className = 'grade-select';
  select.dataset.moduleId = mod.id;

  const pendingOpt = document.createElement('option');
  pendingOpt.value = '';
  pendingOpt.textContent = 'Pending';
  select.appendChild(pendingOpt);

  for (const g of ALL_GRADES) {
    if (g === 'Pending') continue;
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    select.appendChild(opt);
  }

  const current = gradesByModule[mod.id] || '';
  select.value = current;
  select.dataset.grade = current ? 'set' : 'pending';

  select.addEventListener('change', () => {
    gradesByModule[mod.id] = select.value;
    select.dataset.grade = select.value ? 'set' : 'pending';
    dirtyBySem[semId] = dirtyBySem[semId] || new Set();
    dirtyBySem[semId].add(mod.id);
    const semNumber = semesters.find(s => s.id === semId)?.semester_number;
    refreshSemesterStats(semId, semNumber, modulesBySem[semId]);
    updateCgpa();
    renderOverview();

    // auto-save using the live panel's footer controls
    const panel = select.closest('[data-panel]');
    const statusEl = panel?.querySelector('[data-save-status]');
    const btnEl = panel?.querySelector('[data-save-btn]');
    if (statusEl && btnEl) {
      // TEMP MIGRATION: after the first grade change, re-save all of Semester 1 & 2
      saveSemester(semId, statusEl, btnEl).then(() => tempSaveSem12Once());
    }
  });

  const tick = document.createElement('span');
  tick.className = 'save-tick';
  tick.dataset.tickFor = mod.id;
  tick.dataset.state = 'idle';
  tick.setAttribute('aria-hidden', 'true');

  const gradeCell = document.createElement('div');
  gradeCell.className = 'grade-cell';
  gradeCell.append(select, tick);
  tdGrade.appendChild(gradeCell);
  tr.appendChild(tdGrade);
  return tr;
}

function refreshSemesterStats(semId, semNumber, mods) {
  const panel = document.getElementById('panel-sem-' + semNumber);
  if (!panel) return;

  const totalCredits = mods.reduce((s, m) => s + Number(m.credits || 0), 0);
  const gradedCount = mods.filter(m => !!gradesByModule[m.id]).length;
  const pendingCount = mods.length - gradedCount;
  const sgpa = calcGPA(mods.map(m => ({ credits: m.credits, grade: gradesByModule[m.id] })));

  const set = (sel, val) => { const n = panel.querySelector(sel); if (n) n.textContent = val; };
  set('[data-stat-modules]', mods.length);
  set('[data-stat-credits]', totalCredits);
  set('[data-stat-graded]', gradedCount);
  set('[data-stat-pending]', pendingCount);
  set('[data-stat-sgpa]', fmtGPA(sgpa));

  const tag = document.querySelector('[data-sgpa-for="sem-' + semNumber + '"]');
  if (tag) tag.textContent = gradedCount > 0 ? fmtGPA(sgpa) : '—';
}

function updateCgpa() {
  const all = [];
  for (const sem of semesters) {
    for (const m of (modulesBySem[sem.id] || [])) {
      all.push({ credits: m.credits, grade: gradesByModule[m.id], weight: gpaWeight(curriculum, sem.semester_number) });
    }
  }
  const graded = all.filter(e => e.grade);
  cgpaValue.textContent = graded.length ? fmtGPA(calcGPA(all)) : '—';
}

// ---------------------------------------------------------------------------
// STUDENT OVERVIEW
// ---------------------------------------------------------------------------
const isGpaGrade = (g) => GRADE_POINTS[g] !== undefined;

function renderOverview() {
  const panel = el('panel-overview');
  if (!panel) return;

  // per-semester figures, for every published semester the student can see
  const semRows = semesters.map(sem => {
    const mods = modulesBySem[sem.id] || [];
    const credits = mods.reduce((a, m) => a + Number(m.credits || 0), 0);
    const graded = mods.filter(m => gradesByModule[m.id]);
    const gpaGraded = mods.filter(m => isGpaGrade(gradesByModule[m.id]));
    return {
      sem, n: sem.semester_number, mods, credits,
      graded: graded.length,
      sgpa: gpaGraded.length ? calcGPA(mods.map(m => ({ credits: m.credits, grade: gradesByModule[m.id] }))) : null
    };
  }).filter(r => r.mods.length);

  const all = [];
  for (const r of semRows) {
    const w = gpaWeight(curriculum, r.n);
    for (const m of r.mods) all.push({ m, n: r.n, credits: Number(m.credits || 0), weight: w, grade: gradesByModule[m.id] || '' });
  }
  const gpaDone = all.filter(e => isGpaGrade(e.grade) && e.credits > 0);
  const pending = all.filter(e => !e.grade && e.credits > 0);

  const hasData = gpaDone.length > 0;
  el('ov-empty').classList.toggle('hidden', hasData);
  el('ov-body').classList.toggle('hidden', !hasData);
  el('ov-eyebrow').textContent = [profile?.department || 'COMMON', curriculum?.name, profile?.batch ? 'BATCH ' + profile.batch : null]
    .filter(Boolean).join(' · ');
  if (!hasData) return;

  const cgpa = calcGPA(all);
  const cls = classFor(cgpa);
  const creditsGraded = gpaDone.reduce((a, e) => a + e.credits, 0);
  const creditsPassed = gpaDone.filter(e => e.grade !== 'E').reduce((a, e) => a + e.credits, 0);
  const creditsPending = pending.reduce((a, e) => a + e.credits, 0);
  const fails = gpaDone.filter(e => e.grade === 'E').length;
  const withSgpa = semRows.filter(r => r.sgpa !== null);
  const best = withSgpa.reduce((b, r) => (!b || r.sgpa > b.sgpa ? r : b), null);
  const last = withSgpa[withSgpa.length - 1];
  const prev = withSgpa[withSgpa.length - 2];
  const trend = last && prev ? last.sgpa - prev.sgpa : null;

  const kpis = [
    { label: 'CGPA', value: fmtGPA(cgpa), sub: cls.label },
    { label: 'Credits passed', value: creditsPassed, sub: `${creditsGraded} graded · ${creditsPending} pending` },
    { label: 'Modules graded', value: `${all.filter(e => e.grade).length}/${all.length}`, sub: fails ? `${fails} E grade${fails > 1 ? 's' : ''}` : 'no E grades' },
    { label: 'Best SGPA', value: best ? fmtGPA(best.sgpa) : '—', sub: best ? `Semester ${best.n}` : '' },
    { label: 'Latest trend', value: trend === null ? '—' : (trend >= 0 ? '+' : '') + trend.toFixed(2),
      sub: trend === null ? 'needs 2 semesters' : `Sem ${prev.n} → Sem ${last.n}` }
  ];
  el('ov-kpis').innerHTML = kpis.map(k => `
    <div class="ov-kpi">
      <div class="ov-kpi-value">${k.value}</div>
      <div class="ov-kpi-label">${k.label}</div>
      <div class="ov-kpi-sub">${k.sub}</div>
    </div>`).join('');

  renderClassCard(cgpa, cls, gpaDone, pending);

  // SGPA by semester
  el('ov-sgpa').innerHTML = semRows.map(r => ovBar(`Sem ${r.n}`, r.sgpa ?? 0, 4, r.sgpa === null ? '—' : fmtGPA(r.sgpa), r.sgpa === null)).join('');

  // own grade spread
  const counts = {};
  for (const e of all) if (e.grade) counts[e.grade] = (counts[e.grade] || 0) + 1;
  const present = GRADE_ORDER.filter(g => counts[g]);
  const maxCount = Math.max(1, ...present.map(g => counts[g]));
  el('ov-dist').innerHTML = present.map(g => ovBar(g, counts[g], maxCount, String(counts[g]))).join('');

  // strongest / weakest
  const sorted = [...gpaDone].sort((a, b) => GRADE_POINTS[b.grade] - GRADE_POINTS[a.grade] || b.credits - a.credits);
  const bestCount = Math.min(5, Math.ceil(sorted.length / 2));
  const strongest = sorted.slice(0, bestCount);
  const weakest = [...sorted].reverse().slice(0, Math.min(5, sorted.length - bestCount));
  const li = (e) => `<li><span class="ov-mod"><code>${escapeHtml(e.m.code)}</code>${escapeHtml(e.m.name)}</span><span class="ov-grade">${escapeHtml(e.grade)} · ${e.credits}cr</span></li>`;
  el('ov-best').innerHTML = strongest.map(li).join('') || '<li class="empty">Nothing yet</li>';
  el('ov-worst').innerHTML = weakest.map(li).join('') || '<li class="empty">Grade a few more modules to see this</li>';

  // semester table
  el('ov-sem-tbody').innerHTML = semRows.map(r => {
    const status = r.graded === r.mods.length ? ['Complete', 'ov-status-done']
      : r.graded ? ['In progress', 'ov-status-part'] : ['Not started', 'ov-status-none'];
    return `<tr>
      <td>Semester ${r.n}</td>
      <td class="mod-credits">${r.graded}/${r.mods.length}</td>
      <td class="mod-credits">${r.credits}</td>
      <td class="mod-credits" style="color:var(--gold); font-weight:600;">${r.sgpa === null ? '—' : fmtGPA(r.sgpa)}</td>
      <td class="${status[1]}">${status[0]}</td>
    </tr>`;
  }).join('');

  const missing = [];
  for (let n = 1; n <= 8; n++) if (!semRows.some(r => r.n === n)) missing.push(n);
  el('ov-note').textContent = (curriculum
    ? `CGPA uses your curriculum's weights (${curriculum.weight_common} for Semesters 1–2, ${curriculum.weight_specialisation} for 3–8). `
    : 'CGPA is a plain credit-weighted average (no curriculum set for your batch). ')
    + (missing.length ? `Semester${missing.length > 1 ? 's' : ''} ${missing.join(', ')} ${missing.length > 1 ? 'aren\'t' : 'isn\'t'} published for you yet, so projections only cover modules you can see.` : '');
}

function renderClassCard(cgpa, cls, gpaDone, pending) {
  const idx = CLASS_BANDS.findIndex(b => b.label === cls.label);
  const next = idx > 0 ? CLASS_BANDS[idx - 1] : null;
  const wGraded = gpaDone.reduce((a, e) => a + e.credits * e.weight, 0);
  const pts = gpaDone.reduce((a, e) => a + e.credits * e.weight * GRADE_POINTS[e.grade], 0);
  const wPending = pending.reduce((a, e) => a + e.credits * e.weight, 0);
  const pendingCredits = pending.reduce((a, e) => a + e.credits, 0);
  const need = (target) => (target * (wGraded + wPending) - pts) / wPending;

  const lines = [];
  if (!wPending) {
    lines.push('Every published module is graded, so there is nothing left to project.');
  } else {
    if (next) {
      const r = need(next.min);
      if (r > 4) lines.push(`<span class="hl">${next.label}</span> (${next.min.toFixed(2)}) isn't reachable on the ${pendingCredits} pending credit(s) published so far. Even straight A's would end at <span class="hl">${fmtGPA((pts + wPending * 4) / (wGraded + wPending))}</span>.`);
      else lines.push(`To reach <span class="hl">${next.label}</span> (${next.min.toFixed(2)}), you need an average of <span class="hl">${Math.max(r, 0).toFixed(2)}</span> (about <span class="hl">${nearestGradeLabel(Math.max(r, 0))}</span>) on your ${pendingCredits} pending credit(s).`);
    } else {
      lines.push('You\'re in the top class.');
    }
    if (cls.min > 0) {
      const keep = need(cls.min);
      lines.push(keep <= 0
        ? `You stay in <span class="hl">${cls.label}</span> whatever you get on the pending modules.`
        : `To stay in <span class="hl">${cls.label}</span>, keep at least a <span class="hl">${keep.toFixed(2)}</span> average (about <span class="hl">${nearestGradeLabel(keep)}</span>) on them.`);
    }
  }

  el('ov-class').innerHTML = `
    <div class="ov-class-now">${cls.label} <span class="hint" style="font-size:14px;">· CGPA ${fmtGPA(cgpa)}</span></div>
    ${lines.map(l => `<p class="ov-class-text">${l}</p>`).join('')}
    <div class="ov-ladder">${[...CLASS_BANDS].reverse().map(b =>
      `<span class="ov-step${b.label === cls.label ? ' current' : ''}">${b.label}${b.min ? ' ≥ ' + b.min.toFixed(2) : ''}</span>`).join('')}</div>`;
}

function ovBar(label, value, max, display, muted = false) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return `<div class="ov-bar"><span class="ov-bar-label">${label}</span><span class="ov-track"><span class="ov-fill${muted ? ' muted' : ''}" style="width:${pct}%"></span></span><span class="ov-bar-value">${display}</span></div>`;
}

// ---------------------------------------------------------------------------
// TARGET GPA PLANNER (semesters 1 & 2)
// ---------------------------------------------------------------------------
function runTargetCalc(semId, mods, targetRaw, resultEl) {
  const target = parseFloat(targetRaw);
  resultEl.classList.remove('error');

  if (isNaN(target) || target < 0 || target > 4) {
    resultEl.textContent = 'Enter a target GPA between 0.00 and 4.00.';
    resultEl.classList.add('error');
    return;
  }

  // MC/AC/WH modules don't count toward GPA, so they're neither graded nor pending here
  const gpaCredits = mods.filter(m => Number(m.credits) > 0 && !NON_GPA_GRADES.includes(gradesByModule[m.id]));
  const totalCredits = gpaCredits.reduce((s, m) => s + Number(m.credits), 0);
  const graded = gpaCredits.filter(m => gradesByModule[m.id] && GRADE_POINTS[gradesByModule[m.id]] !== undefined);
  const pending = gpaCredits.filter(m => !gradesByModule[m.id] || GRADE_POINTS[gradesByModule[m.id]] === undefined);

  const earnedPoints = graded.reduce((s, m) => s + Number(m.credits) * GRADE_POINTS[gradesByModule[m.id]], 0);
  const pendingCredits = pending.reduce((s, m) => s + Number(m.credits), 0);

  if (pendingCredits === 0) {
    const current = totalCredits > 0 ? earnedPoints / totalCredits : 0;
    resultEl.innerHTML = `All graded modules are already in. Your semester GPA stands at <span class="hl">${fmtGPA(current)}</span>.`;
    return;
  }

  const neededPoints = target * totalCredits - earnedPoints;
  const requiredAvg = neededPoints / pendingCredits;

  if (requiredAvg > 4.0) {
    resultEl.innerHTML = `Not reachable — even straight A grades on the remaining ${pendingCredits} credit(s) only get you to <span class="hl">${fmtGPA((earnedPoints + pendingCredits * 4.0) / totalCredits)}</span>.`;
    resultEl.classList.add('error');
    return;
  }
  if (requiredAvg <= 0) {
    resultEl.innerHTML = `You've already secured this target — even with E grades on every pending module, your GPA would be <span class="hl">${fmtGPA(earnedPoints / totalCredits)}</span>.`;
    return;
  }

  const nearestGrade = nearestGradeLabel(requiredAvg);
  resultEl.innerHTML = `On the remaining <span class="hl">${pendingCredits}</span> pending credit(s), you need an average grade point of <span class="hl">${requiredAvg.toFixed(2)}</span> — roughly a steady <span class="hl">${nearestGrade}</span> average — to land on ${target.toFixed(2)}.`;
}

function nearestGradeLabel(gp) {
  let best = 'E', bestDiff = Infinity;
  for (const [label, val] of Object.entries(GRADE_POINTS)) {
    const diff = Math.abs(val - gp);
    if (diff < bestDiff) { bestDiff = diff; best = label; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// SAVE GRADES
// ---------------------------------------------------------------------------
async function saveSemester(semId, statusEl, btn) {
  const changed = dirtyBySem[semId];
  const mods = modulesBySem[semId] || [];
  const toSave = mods.filter(m => !changed || changed.has(m.id)); // if nothing tracked yet, save all (first save)
  const rows = toSave.map(m => ({ user_id: session.user.id, module_id: m.id, grade: gradesByModule[m.id] || null }));
  const savedValues = new Map(rows.map(r => [r.module_id, r.grade]));

  if (rows.length === 0) { statusEl.textContent = 'Nothing to save.'; return; }

  const panel = btn.closest('[data-panel]');
  const ticks = rows.map(r => panel?.querySelector(`[data-tick-for="${r.module_id}"]`)).filter(Boolean);
  setTicks(ticks, 'saving');

  btn.disabled = true;
  statusEl.textContent = 'Saving…';
  statusEl.classList.remove('error');

  const { error } = await supabase.from('grades').upsert(rows, { onConflict: 'user_id,module_id' });

  btn.disabled = false;
  if (error) {
    console.error(error);
    setTicks(ticks, 'error');
    statusEl.textContent = 'Could not save — try again.';
    statusEl.classList.add('error');
    showToast('Save failed: ' + error.message, true);
    return;
  }
  // only clear modules whose value hasn't changed again while this save was in flight
  const dirty = dirtyBySem[semId] || new Set();
  for (const [moduleId, grade] of savedValues) {
    if ((gradesByModule[moduleId] || null) === grade) dirty.delete(moduleId);
  }
  dirtyBySem[semId] = dirty;
  // a newer save for the same module may already be in flight — leave its spinner alone
  setTicks(ticks.filter(t => !dirty.has(Number(t.dataset.tickFor))), 'saved');
  statusEl.textContent = 'Saved just now.';
}

// ---------------------------------------------------------------------------
// TEMP MIGRATION — delete this block (and its call in buildModuleRow) once
// every active student has been through it.
// Before the curriculum update, Semester 1 & 2 grades were saved on the shared
// (no-curriculum) modules. Students on a curriculum now see that curriculum's
// own Semester 1 & 2 modules, and seed_curriculum_2023.sql copied their grades
// across only once, so anything saved later from the old page is missing.
// After the student's first grade change: copy any grade from the shared
// Semester 1 & 2 modules into a curriculum module with the same code that is
// still Pending here (never overwriting a grade they can see), then save every
// Semester 1 & 2 module. Runs once per student per browser.
// ---------------------------------------------------------------------------
const TEMP_SEM12_KEY = () => `gp_sem12_saved_v2_${session.user.id}`;
let tempSem12Running = false;
const normCode = (c) => String(c || '').toUpperCase().replace(/\s+/g, '');

function tempSem12Done() {
  try { return localStorage.getItem(TEMP_SEM12_KEY()) === '1'; } catch { return false; }
}

// grades the student saved on the shared Semester 1 & 2 modules, keyed by "semNumber|CODE"
async function tempLoadSharedSem12Grades() {
  const { data: shared, error } = await supabase.from('semesters').select('id, semester_number')
    .in('semester_number', [1, 2]).is('department', null).is('curriculum_code', null);
  if (error || !shared?.length) return null;
  const semNum = Object.fromEntries(shared.map(s => [s.id, s.semester_number]));
  const { data: mods, error: modErr } = await supabase.from('modules').select('id, code, semester_id')
    .in('semester_id', shared.map(s => s.id));
  if (modErr || !mods?.length) return null;
  const { data: rows, error: gErr } = await supabase.from('grades').select('module_id, grade')
    .eq('user_id', session.user.id).in('module_id', mods.map(m => m.id));
  if (gErr) return null;
  const modById = Object.fromEntries(mods.map(m => [m.id, m]));
  const out = {};
  for (const r of rows || []) {
    const m = modById[r.module_id];
    if (m && r.grade) out[semNum[m.semester_id] + '|' + normCode(m.code)] = r.grade;
  }
  return out;
}

async function tempSaveSem12Once() {
  if (tempSem12Running || tempSem12Done()) return;
  const targets = semesters.filter(s => s.semester_number === 1 || s.semester_number === 2);
  const mods = targets.flatMap(s => (modulesBySem[s.id] || []).map(m => ({ sem: s, m })));
  if (mods.length === 0) return;

  tempSem12Running = true;
  try {
    // 1. pull old grades across, only when the student is on a curriculum's own Sem 1 & 2
    let recovered = 0;
    if (targets.some(s => s.curriculum_code != null)) {
      const old = await tempLoadSharedSem12Grades();
      if (old === null) return; // couldn't read the old rows: try again on the next change
      for (const { sem, m } of mods) {
        if (sem.curriculum_code == null || gradesByModule[m.id]) continue;
        const g = old[sem.semester_number + '|' + normCode(m.code)];
        if (!g) continue;
        gradesByModule[m.id] = g;
        const sel = document.querySelector(`select.grade-select[data-module-id="${m.id}"]`);
        if (sel) { sel.value = g; sel.dataset.grade = 'set'; }
        recovered++;
      }
      if (recovered) {
        for (const s of targets) refreshSemesterStats(s.id, s.semester_number, modulesBySem[s.id]);
        updateCgpa();
        renderOverview();
      }
    }

    // 2. save every Semester 1 & 2 module as it now stands
    const rows = mods.map(({ m }) => ({ user_id: session.user.id, module_id: m.id, grade: gradesByModule[m.id] || null }));
    const { error } = await supabase.from('grades').upsert(rows, { onConflict: 'user_id,module_id' });
    if (error) { console.error('Semester 1 & 2 save failed', error); return; } // retried on the next change

    // a grade changed while this was in flight: queue it so the newer value wins
    for (const { sem, m } of mods) {
      const sent = rows.find(r => r.module_id === m.id).grade;
      if ((gradesByModule[m.id] || null) !== sent) {
        dirtyBySem[sem.id] = dirtyBySem[sem.id] || new Set();
        dirtyBySem[sem.id].add(m.id);
      }
    }
    for (const s of targets) {
      if (!dirtyBySem[s.id]?.size) continue;
      const p = el('panel-sem-' + s.semester_number);
      const statusEl = p?.querySelector('[data-save-status]');
      const btnEl = p?.querySelector('[data-save-btn]');
      if (statusEl && btnEl) await saveSemester(s.id, statusEl, btnEl);
    }
    try { localStorage.setItem(TEMP_SEM12_KEY(), '1'); } catch { /* runs again next time, harmless */ }
    if (recovered) showToast(`Restored ${recovered} Semester 1 & 2 grade${recovered > 1 ? 's' : ''} from your earlier saves.`);
    console.info(`Semester 1 & 2 save: ${rows.length} rows stored, ${recovered} recovered`);
  } finally {
    tempSem12Running = false;
  }
}
// ---------------------------- END TEMP MIGRATION ----------------------------

function setTicks(ticks, state) {
  for (const t of ticks) {
    t.dataset.state = state;
    clearTimeout(t._fade);
    if (state === 'saved') t._fade = setTimeout(() => { t.dataset.state = 'idle'; }, 2200);
  }
}

// ---------------------------------------------------------------------------
// PROFILE FORM
// ---------------------------------------------------------------------------
function fillProfileForm() {
  el('p-name').value = profile?.full_name || '';
  el('p-number').value = profile?.student_number || '';
  el('p-batch').value = profile?.batch || '';
  el('p-dept').value = profile?.department || '';
}

el('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = el('profile-save-status');
  statusEl.textContent = 'Saving…';
  statusEl.classList.remove('error');

  const update = {
    full_name: el('p-name').value.trim(),
    student_number: el('p-number').value.trim(),
    batch: el('p-batch').value,
    department: el('p-dept').value || null
  };

  // department and batch both decide which semesters/curriculum apply
  const structureChanged = update.department !== (profile?.department || null) || update.batch !== (profile?.batch || '');

  const { data, error } = await supabase.from('profiles').update(update).eq('id', session.user.id).select().single();
  if (error) {
    console.error(error);
    statusEl.textContent = 'Could not save profile.';
    statusEl.classList.add('error');
    showToast('Save failed: ' + error.message, true);
    return;
  }
  profile = data;
  statusEl.textContent = 'Saved.';
  showToast('Profile saved.');

  if (structureChanged) {
    // reload curriculum/semesters/modules for the new batch or department and re-render
    loadingState.classList.remove('hidden');
    await loadCurriculum();
    await loadSemestersAndModules();
    await loadGrades();
    buildTabRail();
    renderAllPanels();
    updateCgpa();
    renderOverview();
    applyDeptLock();
    loadingState.classList.add('hidden');
    activateTab('profile');
  }
});

function applyDeptLock() {
  noDeptBanner.classList.toggle('hidden', !!profile?.department);
}

el('delete-profile-btn').addEventListener('click', async () => {
  const sure = confirm('Delete your profile? This permanently removes your name, student number, batch, department, and every saved grade. This cannot be undone.');
  if (!sure) return;

  const btn = el('delete-profile-btn');
  btn.disabled = true;

  const { error } = await supabase.from('profiles').delete().eq('id', session.user.id);
  if (error) {
    btn.disabled = false;
    showToast('Could not delete profile: ' + error.message, true);
    return;
  }

  await supabase.auth.signOut();
  window.location.href = 'login.html';
});