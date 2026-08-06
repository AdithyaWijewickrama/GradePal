import { getClient, GRADE_POINTS, ALL_GRADES, calcGPA, fmtGPA, DEPARTMENTS } from './config.js';

const supabase = getClient();

let session = null;
let profile = null;
let isAdmin = false;
let semesters = [];      // [{id, semester_number, department, batch_label}]
let modulesBySem = {};   // semesterId -> [module rows]
let gradesByModule = {}; // moduleId -> grade string ('' if pending)
let dirtyBySem = {};     // semesterId -> Set(moduleId) changed since last save
let activeTab = 'sem-1';

const el = (id) => document.getElementById(id);
const tabRail = el('tab-rail');
const content = el('content');
const loadingState = el('loading-state');
const noDeptBanner = el('no-department-banner');
const cgpaValue = el('cgpa-value');
const userEmailEl = el('user-email');
const adminLink = el('admin-link');
const toast = el('toast');

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
  await loadSemestersAndModules();
  await loadGrades();

  buildTabRail();
  renderAllPanels();
  updateCgpa();
  applyDeptLock();

  loadingState.classList.add('hidden');
  activateTab(activeTab);
})();

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

async function loadSemestersAndModules() {
  const { data: semRows, error } = await supabase.from('semesters').select('*').order('semester_number');
  if (error) { console.error(error); showToast('Could not load semesters', true); return; }

  // keep: both common semesters (1,2) + the ones matching the student's department
  semesters = (semRows || []).filter(s => s.department === null || s.department === profile?.department);
  semesters.sort((a, b) => a.semester_number - b.semester_number);

  const ids = semesters.map(s => s.id);
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

  node.querySelector('[data-eyebrow]').textContent = (sem.department || 'COMMON') + ' · ' + sem.batch_label;
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

  node.querySelector('[data-save-btn]').addEventListener('click', () => saveSemester(sem.id, node.querySelector('[data-save-status]'), node.querySelector('[data-save-btn]')));

  content.appendChild(node);
  refreshSemesterStats(sem.id, semNumber, mods);
}

function buildModuleRow(semId, mod) {
  const tr = document.createElement('tr');

  const tdCode = document.createElement('td');
  tdCode.className = 'mod-code';
  tdCode.textContent = mod.code;
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
  });

  tdGrade.appendChild(select);
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
      all.push({ credits: m.credits, grade: gradesByModule[m.id] });
    }
  }
  const graded = all.filter(e => e.grade);
  cgpaValue.textContent = graded.length ? fmtGPA(calcGPA(all)) : '—';
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

  const gpaCredits = mods.filter(m => Number(m.credits) > 0);
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
    resultEl.innerHTML = `You've already secured this target — your GPA can't drop below <span class="hl">${fmtGPA(earnedPoints / totalCredits)}</span> once all modules are pending-cleared at E or better.`;
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
  const rows = mods
    .filter(m => !changed || changed.has(m.id)) // if nothing tracked yet, save all (first save)
    .map(m => ({ user_id: session.user.id, module_id: m.id, grade: gradesByModule[m.id] || null }));

  if (rows.length === 0) { statusEl.textContent = 'Nothing to save.'; return; }

  btn.disabled = true;
  statusEl.textContent = 'Saving…';
  statusEl.classList.remove('error');

  const { error } = await supabase.from('grades').upsert(rows, { onConflict: 'user_id,module_id' });

  btn.disabled = false;
  if (error) {
    console.error(error);
    statusEl.textContent = 'Could not save — try again.';
    statusEl.classList.add('error');
    showToast('Save failed: ' + error.message, true);
    return;
  }
  dirtyBySem[semId] = new Set();
  statusEl.textContent = 'Saved just now.';
  showToast('Grades saved.');
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

  const deptChanged = update.department !== (profile?.department || null);

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

  if (deptChanged) {
    // reload semesters/modules for the newly chosen department and re-render
    loadingState.classList.remove('hidden');
    await loadSemestersAndModules();
    await loadGrades();
    buildTabRail();
    renderAllPanels();
    updateCgpa();
    applyDeptLock();
    loadingState.classList.add('hidden');
    activateTab('profile');
  }
});

function applyDeptLock() {
  noDeptBanner.classList.toggle('hidden', !!profile?.department);
}
