import { getClient, calcGPA, fmtGPA } from './config.js';

const supabase = getClient();
const el = (id) => document.getElementById(id);
const toast = el('toast');

function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.toggle('error', isError);
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 3200);
}

let session = null;
let semesters = [];
let modules = [];

// ---------------------------------------------------------------------------
// BOOT + ADMIN GUARD
// ---------------------------------------------------------------------------
(async function init() {
  const { data: { session: s } } = await supabase.auth.getSession();
  if (!s) { window.location.href = 'login.html'; return; }
  session = s;
  el('user-email').textContent = session.user.email;

  const { data: adminOk, error } = await supabase.rpc('is_admin');
  if (error || !adminOk) {
    el('not-admin-banner').classList.remove('hidden');
    setTimeout(() => (window.location.href = 'index.html'), 1800);
    return;
  }

  await loadAdminEmail();
  await loadSemesters();
  await loadModules();
  populateModuleSemesterSelect();
  renderSemestersTable();
  renderModulesTable();
  await loadStudents();
})();

el('signout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

// ---------------------------------------------------------------------------
// TABS
// ---------------------------------------------------------------------------
document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('[data-tabpanel]').forEach(p => p.classList.add('hidden'));
    document.querySelector(`[data-tabpanel="${btn.dataset.tab}"]`).classList.remove('hidden');
  });
});

// ---------------------------------------------------------------------------
// SETTINGS — CHANGEABLE ADMIN EMAIL
// ---------------------------------------------------------------------------
async function loadAdminEmail() {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'admin_email').maybeSingle();
  if (!error && data) el('admin-email-input').value = data.value;
}

el('admin-email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = el('admin-email-status');
  const newEmail = el('admin-email-input').value.trim();
  statusEl.textContent = 'Saving…';
  const { error } = await supabase.from('app_settings').update({ value: newEmail }).eq('key', 'admin_email');
  if (error) {
    statusEl.textContent = 'Failed to update.';
    statusEl.classList.add('error');
    showToast('Update failed: ' + error.message, true);
    return;
  }
  statusEl.textContent = 'Saved.';
  statusEl.classList.remove('error');
  showToast('Admin email updated.');
});

// ---------------------------------------------------------------------------
// SEMESTERS
// ---------------------------------------------------------------------------
async function loadSemesters() {
  const { data, error } = await supabase.from('semesters').select('*').order('semester_number');
  if (error) { console.error(error); return; }
  semesters = data || [];
}

function renderSemestersTable() {
  const tbody = el('semesters-tbody');
  tbody.innerHTML = '';
  for (const s of semesters) {
    const count = modules.filter(m => m.semester_id === s.id).length;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mod-credits">${s.semester_number}</td>
      <td>${s.department || '<span class="hint">common</span>'}</td>
      <td>${s.batch_label}</td>
      <td class="mod-credits">${count}</td>
    `;
    tbody.appendChild(tr);
  }
}

el('semester-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = el('semester-form-status');
  const number = parseInt(el('s-number').value, 10);
  const dept = el('s-dept').value || null;
  const batch = el('s-batch').value.trim();

  if (number <= 2 && dept) {
    statusEl.textContent = 'Semesters 1 & 2 must have no department (common).';
    statusEl.classList.add('error');
    return;
  }
  if (number >= 3 && !dept) {
    statusEl.textContent = 'Semesters 3–8 need a department.';
    statusEl.classList.add('error');
    return;
  }

  statusEl.textContent = 'Creating…';
  const { error } = await supabase.from('semesters').insert({
    semester_number: number, department: dept, batch_label: batch
  });
  if (error) {
    statusEl.textContent = 'Could not create (it may already exist).';
    statusEl.classList.add('error');
    showToast(error.message, true);
    return;
  }
  statusEl.textContent = 'Created.';
  statusEl.classList.remove('error');
  showToast('Semester created.');
  await loadSemesters();
  renderSemestersTable();
  populateModuleSemesterSelect();
});

// ---------------------------------------------------------------------------
// MODULES
// ---------------------------------------------------------------------------
async function loadModules() {
  const { data, error } = await supabase.from('modules').select('*').order('sort_order');
  if (error) { console.error(error); return; }
  modules = data || [];
}

function populateModuleSemesterSelect() {
  const sel = el('m-semester');
  sel.innerHTML = '';
  for (const s of semesters) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `Semester ${s.semester_number} — ${s.department || 'common'} (${s.batch_label})`;
    sel.appendChild(opt);
  }
}

function renderModulesTable() {
  const tbody = el('modules-tbody');
  tbody.innerHTML = '';
  for (const m of modules) {
    const sem = semesters.find(s => s.id === m.semester_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mod-code">${m.code}</td>
      <td>${m.name}</td>
      <td class="mod-credits">${m.credits}</td>
      <td>${sem ? `Sem ${sem.semester_number} · ${sem.department || 'common'}` : '—'}</td>
      <td><button class="mini-btn" data-del="${m.id}" type="button">Remove</button></td>
    `;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this module? Any saved student grades for it will also be removed.')) return;
      const { error } = await supabase.from('modules').delete().eq('id', btn.dataset.del);
      if (error) { showToast(error.message, true); return; }
      await loadModules();
      renderModulesTable();
      renderSemestersTable();
      showToast('Module removed.');
    });
  });
}

el('module-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = el('module-form-status');
  const semesterId = parseInt(el('m-semester').value, 10);
  const code = el('m-code').value.trim();
  const name = el('m-name').value.trim();
  const credits = parseFloat(el('m-credits').value);

  statusEl.textContent = 'Adding…';
  const { error } = await supabase.from('modules').insert({
    semester_id: semesterId, code, name, credits, sort_order: modules.filter(m => m.semester_id === semesterId).length
  });
  if (error) {
    statusEl.textContent = 'Could not add module.';
    statusEl.classList.add('error');
    showToast(error.message, true);
    return;
  }
  statusEl.textContent = 'Added.';
  statusEl.classList.remove('error');
  showToast('Module added.');
  el('module-form').reset();
  await loadModules();
  renderModulesTable();
  renderSemestersTable();
});

// ---------------------------------------------------------------------------
// STUDENTS & GRADES
// ---------------------------------------------------------------------------
let studentsCache = [];

async function loadStudents() {
  const { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); showToast('Could not load students', true); return; }

  const { data: grades } = await supabase.from('grades').select('user_id, module_id, grade');
  const gradesByUser = {};
  for (const g of (grades || [])) {
    (gradesByUser[g.user_id] ||= []).push(g);
  }

  studentsCache = (profiles || []).filter(p => !p.is_admin).map(p => {
    const userGrades = gradesByUser[p.id] || [];
    const entries = userGrades.map(g => {
      const mod = modules.find(m => m.id === g.module_id);
      return { credits: mod?.credits || 0, grade: g.grade };
    });
    const gradedCount = userGrades.filter(g => g.grade).length;
    return { ...p, gradedCount, cgpa: calcGPA(entries) };
  });

  renderStudentsTable();
}

function renderStudentsTable() {
  const tbody = el('students-tbody');
  const search = el('student-search').value.trim().toLowerCase();
  const dept = el('student-dept-filter').value;
  const batch = el('student-batch-filter').value;

  const filtered = studentsCache.filter(s => {
    if (dept && s.department !== dept) return false;
    if (batch && s.batch !== batch) return false;
    if (search) {
      const hay = `${s.full_name || ''} ${s.student_number || ''} ${s.email || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-faint); padding:24px;">No students match.</td></tr>`;
    return;
  }
  for (const s of filtered) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.full_name || '<span class="hint">unnamed</span>'}<br><span class="hint" style="font-size:11px;">${s.email}</span></td>
      <td class="mod-code">${s.student_number || '—'}</td>
      <td class="mod-credits">${s.batch || '—'}</td>
      <td class="mod-credits">${s.department || '—'}</td>
      <td class="mod-credits">${s.gradedCount}</td>
      <td class="mod-credits" style="color:var(--gold); font-weight:600;">${s.gradedCount ? fmtGPA(s.cgpa) : '—'}</td>
    `;
    tbody.appendChild(tr);
  }
}

['input', 'change'].forEach(evt => {
  el('student-search').addEventListener(evt, renderStudentsTable);
  el('student-dept-filter').addEventListener(evt, renderStudentsTable);
  el('student-batch-filter').addEventListener(evt, renderStudentsTable);
});
