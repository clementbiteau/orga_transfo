/* ================================================================
   AVA2i — Roadmap Transformation · Application
   ================================================================ */


// ── CONFIGURATION FIREBASE ──────────────────────────────────────
// Remplacer les valeurs VOTRE_... par les vraies valeurs Firebase
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAQK7ethzw3endOp8aSo0xcSc3DRM8xu_0",
  authDomain:        "ava2i-roadmap.firebaseapp.com",
  databaseURL:       "https://ava2i-roadmap-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "ava2i-roadmap",
  storageBucket:     "ava2i-roadmap.firebasestorage.app",
  messagingSenderId: "277914557085",
  appId:             "1:277914557085:web:32cd2c6efeee26ca611274"
};


// ── ÉTAT GLOBAL ─────────────────────────────────────────────────
let tasks   = {};
let editId  = null;
let curView = 'list';
let _drag   = null;
let _db     = null;
let _ref    = null;

// Filtres actifs
const F = { status: new Set(), priority: new Set(), type: new Set() };

// ── ÉTAT BOARD ───────────────────────────────────────────────────
let phases      = {};
let documents   = {};
let editPhaseId = null;
let _pendingDoc = null;

const QCOLORS = { Q1: '#2563eb', Q2: '#16a34a', Q3: '#b45309', Q4: '#7c3aed' };
const QDATES  = {
  Q1: { start: '-01-01', end: '-03-31' },
  Q2: { start: '-04-01', end: '-06-30' },
  Q3: { start: '-07-01', end: '-09-30' },
  Q4: { start: '-10-01', end: '-12-31' },
};


// ── CONSTANTES / MAPPINGS ────────────────────────────────────────
const TC = {
  'Offre':            '#2563eb',
  'Compétences':      '#7c3aed',
  'Go-to-Market':     '#16a34a',
  'Modèle Economique':'#b45309',
};

const PL = { basse: 'Basse', moyenne: 'Moyenne', haute: 'Haute', critique: 'Critique' };
const SN = { todo: 'À faire', wip: 'En cours', review: 'Review', done: 'Terminé', block: 'Bloqué' };

const DC = {
  Data:  '#0891b2',
  Dev:   '#7c3aed',
  Infra: '#b45309',
  Sec:   '#dc2626',
  Strat: '#16a34a',
  Exp:   '#4f46e5',
  Archi: '#db2777'
};


// ── FIREBASE ────────────────────────────────────────────────────

function setSyncStatus(s) {
  const colors  = { connecting: '#f59e0b', connected: '#16a34a', offline: '#9ca3af', saving: '#2563eb' };
  const labels  = { connecting: 'Connexion…', connected: 'Sync actif', offline: 'Local', saving: 'Sauvegarde…' };
  document.getElementById('sdot').style.background = colors[s] || '#9ca3af';
  document.getElementById('stxt').textContent = labels[s] || 'Local';
}
// Alias court utilisé dans le code
const setSS = setSyncStatus;

function initFB() {
  try {
    const { initializeApp, getDatabase, ref, onValue } = window._fb;
    _db  = getDatabase(initializeApp(FIREBASE_CONFIG));
    _ref = ref(_db, 'ava2i/tasks');
    setSS('connecting');
    onValue(
      _ref,
      snap => { tasks = snap.val() || {}; render(); setSS('connected'); },
      ()   => setSS('offline')
    );
    onValue(ref(_db, 'ava2i/phases'), snap => {
      phases = snap.val() || {};
      lsSavePhases();
      populatePhaseSidebar();
      if (document.getElementById('panel-board').classList.contains('on')) renderPhases();
      if (curView === 'timeline') renderTimeline();
    });
    onValue(ref(_db, 'ava2i/documents'), snap => {
      documents = snap.val() || {};
      lsSaveDocs();
      if (document.getElementById('panel-board').classList.contains('on')) renderDocs();
    });
  } catch (e) {
    setSS('offline');
  }
}

function save(t) {
  if (_db) {
    setSS('saving');
    const { ref, set } = window._fb;
    set(ref(_db, 'ava2i/tasks/' + t.id), t)
      .then(() => setSS('connected'))
      .catch(() => setSS('offline'));
  }
  tasks[t.id] = t;
  lsSave();
}

function del(id) {
  if (_db) {
    const { ref, remove } = window._fb;
    remove(ref(_db, 'ava2i/tasks/' + id));
  }
  delete tasks[id];
  lsSave();
}

function lsSave() {
  try { localStorage.setItem('ava2i_rm', JSON.stringify(tasks)); } catch (e) {}
}

function lsLoad() {
  try {
    const d = localStorage.getItem('ava2i_rm');
    if (d) tasks = JSON.parse(d);
  } catch (e) {}
}

function lsSavePhases() { try { localStorage.setItem('ava2i_ph', JSON.stringify(phases)); } catch(e) {} }
function lsLoadPhases() { try { const d = localStorage.getItem('ava2i_ph'); if (d) phases = JSON.parse(d); } catch(e) {} }
function lsSaveDocs()   { try { localStorage.setItem('ava2i_dc', JSON.stringify(documents)); } catch(e) {} }
function lsLoadDocs()   { try { const d = localStorage.getItem('ava2i_dc'); if (d) documents = JSON.parse(d); } catch(e) {} }

// Initialisation au chargement de la page
window.addEventListener('load', () => {
  lsLoad();
  lsLoadPhases();
  lsLoadDocs();
  setTimeout(() => {
    if (window._fb) initFB();
    else setSS('offline');
  }, 500);
  renderPeople();
  render();
});


// ── MODAL TÂCHE ──────────────────────────────────────────────────

function openNew() {
  editId = null;
  ['mt', 'mo', 'mdl', 'mde'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ms').value  = 'todo';
  document.getElementById('mp').value  = 'moyenne';
  document.getElementById('mty').value = 'Offre';
  document.getElementById('mst').value = new Date().toISOString().slice(0, 10);
  populatePhaseDropdown();
  document.getElementById('mph').value = '';
  document.getElementById('mbdel').style.display = 'none';
  document.getElementById('taskOv').classList.add('on');
  setTimeout(() => document.getElementById('mt').focus(), 150);
}

function openTask(id) {
  const t = tasks[id];
  if (!t) return;
  editId = id;
  document.getElementById('mt').value  = t.title    || '';
  document.getElementById('ms').value  = t.status   || 'todo';
  document.getElementById('mp').value  = t.priority || 'moyenne';
  document.getElementById('mty').value = t.type     || 'Offre';
  document.getElementById('mo').value  = t.owner    || '';
  document.getElementById('mst').value = t.start    || '';
  document.getElementById('mdl').value = t.deadline || '';
  document.getElementById('mde').value = t.desc     || '';
  populatePhaseDropdown();
  document.getElementById('mph').value = t.phaseId  || '';
  document.getElementById('mbdel').style.display = '';
  document.getElementById('taskOv').classList.add('on');
}

function saveTask() {
  const title = document.getElementById('mt').value.trim();
  if (!title) return;
  const id = editId || 't' + Date.now();
  const phaseId = document.getElementById('mph').value;
  save({
    id, title,
    status:    document.getElementById('ms').value,
    priority:  document.getElementById('mp').value,
    type:      document.getElementById('mty').value,
    owner:     document.getElementById('mo').value.trim(),
    start:     document.getElementById('mst').value,
    deadline:  document.getElementById('mdl').value,
    desc:      document.getElementById('mde').value.trim(),
    phaseId:   phaseId || null,
    createdAt: tasks[id]?.createdAt || Date.now(),
    updatedAt: Date.now()
  });
  closeOv('taskOv');
  render();
}

function delTask() {
  if (!editId || !confirm('Supprimer cette tâche ?')) return;
  del(editId);
  closeOv('taskOv');
  render();
}

function closeOv(id)       { document.getElementById(id).classList.remove('on'); }
function ovc(e, id)        { if (e.target.id === id) closeOv(id); }
function openSetup()       { document.getElementById('setupOv').classList.add('on'); }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeOv('taskOv'); closeOv('setupOv'); closeOv('phaseOv'); closeOv('docUploadOv'); }
});


// ── FILTRES ──────────────────────────────────────────────────────

function tog(el) {
  el.classList.toggle('on');
  const { g, v } = el.dataset;
  el.classList.contains('on') ? F[g].add(v) : F[g].delete(v);
  render();
}

function clearF() {
  document.getElementById('fs').value = '';
  document.getElementById('fo').value = '';
  document.getElementById('fd').value = '';
  document.getElementById('fph').value = '';
  ['status', 'priority', 'type'].forEach(g => F[g].clear());
  document.querySelectorAll('.chip.on').forEach(c => c.classList.remove('on'));
  render();
}

function matches(t) {
  const s   = (document.getElementById('fs').value || '').toLowerCase();
  const o   = (document.getElementById('fo').value || '').toLowerCase();
  const dl  = document.getElementById('fd').value;
  const fph = document.getElementById('fph').value;

  if (s && !(t.title || '').toLowerCase().includes(s) && !(t.owner || '').toLowerCase().includes(s)) return false;
  if (o && !(t.owner || '').toLowerCase().includes(o)) return false;
  if (F.status.size   && !F.status.has(t.status))     return false;
  if (F.priority.size && !F.priority.has(t.priority)) return false;
  if (F.type.size     && !F.type.has(t.type))         return false;
  if (fph && t.phaseId !== fph)                        return false;

  if (dl && t.deadline) {
    const diff = Math.ceil((new Date(t.deadline) - new Date()) / 864e5);
    if (dl === 'overdue' && diff >= 0)       return false;
    if (dl === 'week'    && (diff < 0 || diff > 7))  return false;
    if (dl === 'month'   && (diff < 0 || diff > 30)) return false;
    if (dl === 'quarter' && (diff < 0 || diff > 90)) return false;
  }
  return true;
}

function vis() {
  return Object.values(tasks).filter(matches);
}


// ── RENDU PRINCIPAL ──────────────────────────────────────────────

function render() {
  const vt  = vis();
  const tot = Object.keys(tasks).length;

  document.getElementById('fcount').innerHTML =
    `<strong>${vt.length}</strong> tâche${vt.length !== 1 ? 's' : ''} affichée${vt.length !== 1 ? 's' : ''}`;
  document.getElementById('ph-sub').textContent =
    `${tot} tâche${tot !== 1 ? 's' : ''} · 2026`;

  if (curView === 'list')     renderList();
  else if (curView === 'kanban') renderKanban();
  else                           renderTimeline();
}


// ── VUE LISTE ────────────────────────────────────────────────────

function renderList() {
  const vt    = vis().sort((a, b) => {
    const p = { critique: 0, haute: 1, moyenne: 2, basse: 3 };
    return (p[a.priority] || 2) - (p[b.priority] || 2);
  });
  const body  = document.getElementById('list-body');
  const empty = document.getElementById('list-empty');

  if (!vt.length) { body.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  const G     = { wip: [], todo: [], review: [], block: [], done: [] };
  vt.forEach(t => (G[t.status] || G.todo).push(t));

  const order = ['wip', 'todo', 'review', 'block', 'done'];
  const GN    = { wip: 'En cours', todo: 'À faire', review: 'Review', block: 'Bloqué', done: 'Terminé' };
  const GC    = { wip: 'var(--amber)', todo: 'var(--g500)', review: 'var(--purple)', block: 'var(--red)', done: 'var(--green)' };

  body.innerHTML = order.filter(g => G[g].length).map(g => `
    <div class="lv-group">
      <div class="lv-gh" onclick="togGrp(this)">
        <span class="lv-arr open" style="color:${GC[g]}">▶</span>
        <span class="lv-gname" style="color:${GC[g]}">${GN[g]}</span>
        <span class="lv-gcount">${G[g].length}</span>
      </div>
      <div>
        <div class="tbl">
          <div class="tbl-head">
            <span></span><span>Titre</span><span>Type</span>
            <span>Priorité</span><span>Owner</span>
            <span>Deadline</span><span></span>
          </div>
          ${G[g].map(t => trow(t)).join('')}
        </div>
      </div>
    </div>`
  ).join('');
}

function togGrp(h) {
  const arr = h.querySelector('.lv-arr');
  arr.classList.toggle('open');
  h.nextElementSibling.style.display = arr.classList.contains('open') ? '' : 'none';
}

function trow(t) {
  const tc = TC[t.type] || 'var(--g400)';
  const ow = t.owner
    ? `<span class="owner"><span class="oav" style="background:${sc(t.owner)}">${ini(t.owner)}</span>${x(t.owner)}</span>`
    : '<span style="color:var(--g300)">—</span>';
  return `<div class="trow" onclick="openTask('${t.id}')">
    <div><span class="tdot" style="background:${tc}"></span></div>
    <div>
      <div class="cell-title">${x(t.title)}</div>
      ${t.desc ? `<div class="cell-sub">${x(t.desc)}</div>` : ''}
    </div>
    <div><span class="type-pill" style="background:${tc}15;color:${tc}">${t.type || '—'}</span></div>
    <div><span class="badge bp-${t.priority || 'moyenne'}">${PL[t.priority] || '—'}</span></div>
    <div>${ow}</div>
    <div>${dltag(t.deadline)}</div>
    <div><button class="row-btn" onclick="event.stopPropagation();openTask('${t.id}')">···</button></div>
  </div>`;
}

function dltag(dl) {
  if (!dl) return '<span style="color:var(--g300)">—</span>';
  const d    = new Date(dl);
  const diff = Math.ceil((d - new Date()) / 864e5);
  const cls  = diff < 0 ? 'late' : diff <= 7 ? 'soon' : '';
  return `<span class="dl ${cls}">${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>`;
}


// ── VUE KANBAN ───────────────────────────────────────────────────

function renderKanban() {
  ['todo', 'wip', 'review', 'block', 'done'].forEach(s => {
    const items = vis().filter(t => t.status === s);
    document.getElementById('kb-' + s).innerHTML = items.map(t => kcard(t)).join('');
    document.getElementById('kn-' + s).textContent = items.length;
  });
}

function kcard(t) {
  const tc = TC[t.type] || 'var(--g400)';
  return `<div class="kcard" draggable="true" data-id="${t.id}"
    ondragstart="kdstart(event,'${t.id}')" ondragend="kdend()"
    onclick="openTask('${t.id}')">
    <div class="kcard-title">${x(t.title)}</div>
    <div style="font-size:11px;color:${tc};font-weight:500;margin-bottom:8px">${t.type || ''}</div>
    <div class="kcard-footer">
      <span class="badge bp-${t.priority || 'moyenne'}">${PL[t.priority] || ''}</span>
      ${t.owner ? `<span class="owner"><span class="oav" style="background:${sc(t.owner)};width:16px;height:16px;font-size:9px">${ini(t.owner)}</span>${x(t.owner)}</span>` : ''}
    </div>
    ${t.deadline ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--g100)">${dltag(t.deadline)}</div>` : ''}
  </div>`;
}

// Drag & drop Kanban
function kdstart(e, id) { _drag = id; e.currentTarget.classList.add('dragging'); }
function kdend()         { _drag = null; document.querySelectorAll('.kcard.dragging').forEach(c => c.classList.remove('dragging')); }
function kdo(e, s)       { e.preventDefault(); document.getElementById('kb-' + s).classList.add('over'); }
function kdl(s)          { document.getElementById('kb-' + s).classList.remove('over'); }
function kdd(e, s) {
  e.preventDefault(); kdl(s);
  if (!_drag) return;
  const t = tasks[_drag];
  if (!t) return;
  t.status = s;
  save(t);
  render();
}


// ── VUE TIMELINE ─────────────────────────────────────────────────

function renderTimeline() {
  const root    = document.getElementById('tl-root');
  const empty   = document.getElementById('tl-empty');
  const vt      = vis().filter(t => t.start && t.deadline);
  const phList  = Object.values(phases).filter(ph => ph.start && ph.end);

  if (!vt.length && !phList.length) {
    root.innerHTML = '';
    root.style.display  = 'none';
    empty.style.display = '';
    return;
  }
  root.style.display  = '';
  empty.style.display = 'none';

  // Bornes de la timeline (tâches + phases)
  const allStarts = [...vt.map(t => new Date(t.start)), ...phList.map(p => new Date(p.start))];
  const allEnds   = [...vt.map(t => new Date(t.deadline)), ...phList.map(p => new Date(p.end))];
  let mn = new Date(Math.min(...allStarts));
  let mx = new Date(Math.max(...allEnds));
  mn = new Date(mn.getFullYear(), mn.getMonth(), 1);
  mx = new Date(mx.getFullYear(), mx.getMonth() + 2, 0);

  const tot = (mx - mn) / 864e5;
  const pct = d => ((new Date(d) - mn) / 864e5 / tot * 100).toFixed(2);

  // Construction des mois
  const months = [];
  let cur = new Date(mn);
  while (cur <= mx) {
    months.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  // Grouper par phase
  const phaseOrder = Object.values(phases)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter.localeCompare(b.quarter));
  const lanes = [
    ...phaseOrder
      .map(ph => ({ c: `${ph.quarter} ${ph.year} — ${ph.name}`, tasks: vt.filter(t => t.phaseId === ph.id), color: ph.color || QCOLORS[ph.quarter] }))
      .filter(l => l.tasks.length),
    { c: 'Sans phase', tasks: vt.filter(t => !t.phaseId), color: 'var(--g400)' }
  ].filter(l => l.tasks.length);

  const tp = pct(new Date());

  // Ligne des phases
  const phasesRowHtml = phList.length ? `
    <div class="tl-phases-row">
      <div class="tl-phases-label">Phases</div>
      <div class="tl-phases-area">
        ${phList.map(ph => {
          const l     = pct(ph.start);
          const w     = Math.max(Number(pct(ph.end)) - Number(l), 0.5);
          const color = ph.color || QCOLORS[ph.quarter] || '#6b7280';
          const prog  = phaseProgress(ph.id).pct;
          return `<div class="tl-phase-bar"
            style="left:${l}%;width:${w}%;background:${color}"
            title="${ph.name} — ${prog}% terminé">${x(ph.quarter)} ${ph.year} · ${prog}%</div>`;
        }).join('')}
        ${tp > 0 && tp < 100 ? `<div class="tl-now" style="left:${tp}%"></div>` : ''}
      </div>
    </div>` : '';

  root.innerHTML = `<div class="tl-box">
    <div class="tl-hrow">
      <div class="tl-llabel-h">Centre</div>
      <div class="tl-months">
        ${months.map(m => {
          const isCur = m.getMonth() === new Date().getMonth() && m.getFullYear() === new Date().getFullYear();
          return `<div class="tl-mo${isCur ? ' cur' : ''}">${m.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</div>`;
        }).join('')}
      </div>
    </div>
    ${phasesRowHtml}
    ${lanes.map(lane => `
      <div class="tl-row">
        <div class="tl-llabel">${lane.c}</div>
        <div class="tl-area" style="min-height:${Math.max(48, lane.tasks.length * 36 + 20)}px">
          ${lane.tasks.map((t, i) => {
            const tc = TC[t.type] || '#2563eb';
            const l  = pct(t.start);
            const w  = Math.max(Number(pct(t.deadline)) - Number(l), 0.5);
            return `<div class="tl-bar"
              style="left:${l}%;width:${w}%;background:${tc}15;border:1px solid ${tc}35;color:${tc};top:${10 + i * 34}px"
              onclick="openTask('${t.id}')">${x(t.title)}</div>`;
          }).join('')}
          ${tp > 0 && tp < 100 ? `<div class="tl-now" style="left:${tp}%"></div>` : ''}
        </div>
      </div>`
    ).join('')}
  </div>`;
}


// ── NAVIGATION (vues & onglets) ──────────────────────────────────

function switchView(v) {
  curView = v;
  ['list', 'kanban', 'timeline'].forEach(n => {
    document.getElementById('v-' + n).style.display = n === v ? (n === 'kanban' ? 'flex' : 'block') : 'none';
    document.getElementById('vb-' + n).classList.toggle('on', n === v);
  });
  render();
}

function switchTab(t, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.ntab').forEach(b => b.classList.remove('on'));
  document.getElementById('panel-' + t).classList.add('on');
  btn.classList.add('on');
  document.getElementById('sidebar').style.display = t === 'roadmap' ? '' : 'none';
  if (t === 'board') renderBoard();
}


// ── CONSULTANTS ──────────────────────────────────────────────────

const CONSULTANTS = [
  {"nom":"Fatine STIRIBA","contrat":"CDI","niveau":"Expert","domaine":"Data","titre":"BI"},
  {"nom":"Izem TAOUFIK","contrat":"Freelance","niveau":"Expert","domaine":"Data","titre":"Data engineer"},
  {"nom":"Cheikh MBOW","contrat":"Freelance","niveau":"Expert","domaine":"Data","titre":"Business Analyst"},
  {"nom":"Mohamed BOUJEH","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Cloud Engineer"},
  {"nom":"Chaimae BENJABAR","contrat":"CDI","niveau":"Confirme","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Laila TAFOUGALTI","contrat":"CDI","niveau":"Confirme","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Georges CASTRO","contrat":"Freelance","niveau":"Expert","domaine":"Data","titre":"BI"},
  {"nom":"Anas NAHRI","contrat":"Freelance","niveau":"Expert","domaine":"Data","titre":"Business Analyst"},
  {"nom":"Houcine KHEROUA","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Dieng CHEIKH","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Cloud Architect"},
  {"nom":"Youssef LAFSSAHI","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Cloud Engineer"},
  {"nom":"Anass YAHYAOUI","contrat":"Freelance","niveau":"Confirme","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Inès HABBOU","contrat":"Freelance","niveau":"Confirme","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Abdellazize AMRANI","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Sabrina AGADIR","contrat":"Freelance","niveau":"Expert","domaine":"Sec","titre":"Data Security Engineer"},
  {"nom":"Mohamed Amine BEN SLIMEN","contrat":"CDI","niveau":"Expert","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Thomas EM","contrat":"Freelance","niveau":"","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Hamza CHAOUKI","contrat":"CDI","niveau":"Confirme","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Mourad AMACH","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Bruno BASTARD","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Cloud Technique"},
  {"nom":"Hippolyte TCHAMOKOUEN","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"DBA"},
  {"nom":"Haytham BAAKI","contrat":"CDI","niveau":"Expert","domaine":"Strat","titre":"Business Analyst"},
  {"nom":"Oumaima HAFIENE","contrat":"CDI","niveau":"Expert","domaine":"Exp","titre":"Support Applicatif"},
  {"nom":"Sefako GUENOU","contrat":"CDI","niveau":"Expert","domaine":"Exp","titre":"Support Technico-Fonctionnel"},
  {"nom":"Najoua HAYA","contrat":"CDI","niveau":"Confirme","domaine":"Sec","titre":"IT Risk"},
  {"nom":"Nouha BELKHATIR","contrat":"Freelance","niveau":"Confirme","domaine":"Exp","titre":"BA Cash Management"},
  {"nom":"Amine EL HIJAZI","contrat":"Freelance","niveau":"Confirme","domaine":"Sec","titre":"Ingénieur Réseaux et Sécurité"},
  {"nom":"Caglar SEN","contrat":"Freelance","niveau":"Confirme","domaine":"Strat","titre":"Product Manager"},
  {"nom":"Meriem SELLAMI","contrat":"Freelance","niveau":"","domaine":"Sec","titre":"IT Risk"},
  {"nom":"Wassim JABEUR","contrat":"CDI","niveau":"Expert","domaine":"Infra","titre":"Chef de Projet Infra"},
  {"nom":"Ahmed AMRI","contrat":"Freelance","niveau":"Confirme","domaine":"Exp","titre":"Expert Devops"},
  {"nom":"Alassane M. MAIGA","contrat":"CDI","niveau":"Expert","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Ayoub CHOUHAIBI","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Zeiden ELKOUCHE","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Expert Sharepoint"},
  {"nom":"Ahmed HLABBA","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Expert Sharepoint"},
  {"nom":"Mohamed BELALIA","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Ingénieur Poste de Travail"},
  {"nom":"Khaled BEHI","contrat":"Freelance","niveau":"Expert","domaine":"Sec","titre":"IT Risk"},
  {"nom":"Moez CHERIF","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Mohamed CHEBBI","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Lead Java"},
  {"nom":"Manel LASSOUED","contrat":"CDI","niveau":"Confirme","domaine":"Infra","titre":"Admin Système"},
  {"nom":"Houda EL HILALI","contrat":"CDI","niveau":"Expert","domaine":"Strat","titre":"Chef de Projet"},
  {"nom":"Jamal AMERMOUCH","contrat":"CDI","niveau":"Expert","domaine":"Dev","titre":"Analyste Dev Mainframe"},
  {"nom":"Rachida ADNANE","contrat":"CDI","niveau":"Expert","domaine":"Strat","titre":"Chef de Projet Mainframe"},
  {"nom":"Lamia LAHRACH","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Analyste Mainframe"},
  {"nom":"Rajaa ABOUMAAD","contrat":"CDI","niveau":"Confirme","domaine":"Dev","titre":"Ingénieur Mainframe"},
  {"nom":"Youness BARA","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Ingénieur Mainframe"},
  {"nom":"Armand SAMMET BELL","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"SRE"},
  {"nom":"Christ-Ephrem ZIDAGO","contrat":"CDI","niveau":"Confirme","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Eric ASSIONGBON","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Ivan SIESS","contrat":"Freelance","niveau":"Expert","domaine":"Archi","titre":"Architecte Messagerie Exchange"},
  {"nom":"Serge NANA","contrat":"CDI","niveau":"Confirme","domaine":"Strat","titre":"Chef de Projet SI"},
  {"nom":"Zineb ZOLI","contrat":"CDI","niveau":"Confirme","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Anas FAROUKI","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Ingénierie N3 Windows DevOPS"},
  {"nom":"Faiza CHELQI","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Consultant Extream"},
  {"nom":"Ayoub KHALDI","contrat":"Freelance","niveau":"Expert","domaine":"Sec","titre":"IT Risk"},
  {"nom":"MOUSTAPHA AZZAOUI","contrat":"Freelance","niveau":"Confirme","domaine":"Infra","titre":"Technicien Data Center"},
  {"nom":"NAOUFAL IDRISSI KHAMLICHI","contrat":"Freelance","niveau":"Expert","domaine":"Sec","titre":"IT Risk"},
  {"nom":"Yanis ALIA","contrat":"CDI","niveau":"Confirme","domaine":"Archi","titre":"Architecte Système"},
  {"nom":"Leila BOKRETA","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"PMO Cloud"},
  {"nom":"Ayoub AFARID","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Angular Java"},
  {"nom":"Youssi ADOUHANE","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Chef de Projet MOA"},
  {"nom":"Ramzi MOSRATI","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Angular Java"},
  {"nom":"Ahmed ATALLAH","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Chef de Projet Comptabilité"},
  {"nom":"Ghizlane ELGADI","contrat":"CDI","niveau":"Confirme","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Mamadou LAMARANA SOW","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Yousra CHERGUIF","contrat":"CDI","niveau":"Confirme","domaine":"Exp","titre":"Ingénieur Analyste Exploitation"},
  {"nom":"Abdelwahed EL QASRY","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Angular Java"},
  {"nom":"Amine BECHRAOUI","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Java"},
  {"nom":"Hamza SAMID","contrat":"Freelance","niveau":"Confirme","domaine":"Dev","titre":"Dev Java"},
  {"nom":"Mehdi KARZOUZ","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Directeur Projet Cybersécurité"},
  {"nom":"Zouhair HAJJI","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Java"},
  {"nom":"Mohammed KARTOBI","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Mainframe"},
  {"nom":"Afef BARKA","contrat":"CDI","niveau":"Expert","domaine":"Dev","titre":"Experte Frontend Angular JS"},
  {"nom":"Mounim ELBIYAALI","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"MOE Java Angular"},
  {"nom":"Yassine OUACHHAL","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Java Angular"},
  {"nom":"Ayoub RAOUAFI","contrat":"Freelance","niveau":"Expert","domaine":"Sec","titre":"Système et Sécurité"},
  {"nom":"Nicolas STOPHE","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev WPF"},
  {"nom":"FADEL ADMANE","contrat":"Freelance","niveau":"Expert","domaine":"Sec","titre":"Ingénieur Cybersécurité Industriel"},
  {"nom":"Achraf MAHFOUDH","contrat":"CDI","niveau":"Confirme","domaine":"Dev","titre":"Dev Java Angular"},
  {"nom":"Illiesse CHAMSI","contrat":"Freelance","niveau":"Confirme","domaine":"Strat","titre":"Support Delivery CRM"},
  {"nom":"Nouredine GHAZLI","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Java"},
  {"nom":"Aymane HMIDANI","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Consultant Cobol"},
  {"nom":"Noureddine BENHAMOU","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Mainframe"},
  {"nom":"Asmaa ESSAQRI","contrat":"Freelance","niveau":"Confirme","domaine":"Infra","titre":"Incident Manager"},
  {"nom":"Bassory OUATTARA","contrat":"CDI","niveau":"Expert","domaine":"Exp","titre":"Ingénieur Production DevOps"},
  {"nom":"Glody TIRI MINDI","contrat":"Freelance","niveau":"Confirme","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Hanae EL BADOURI","contrat":"Freelance","niveau":"Confirme","domaine":"Sec","titre":"IT Risk"},
  {"nom":"Karima SHISSAH","contrat":"CDI","niveau":"Confirme","domaine":"Exp","titre":"Ingénieur de Production"},
  {"nom":"Soufiyan AKAABOUB","contrat":"CDI","niveau":"Confirme","domaine":"Exp","titre":"Ingénieur Devops"},
  {"nom":"Clinton Lourdu THOMAS","contrat":"CDI","niveau":"Expert","domaine":"Infra","titre":"Admin Control M"},
  {"nom":"Aboubakr SEBAI","contrat":"CDI","niveau":"Confirme","domaine":"Exp","titre":"Ingénieur Devops"},
  {"nom":"Najeh HATTAB","contrat":"CDI","niveau":"Confirme","domaine":"Infra","titre":"Ingénieur Système et Virtualisation"},
  {"nom":"Adil BRITI ELALAOUI","contrat":"CDI","niveau":"Expert","domaine":"Sec","titre":"Chef de Projet Réseau et Cyber"},
  {"nom":"Soufiane LAMRANI","contrat":"Freelance","niveau":"Confirme","domaine":"Sec","titre":"Ingénieur Cybersécurité"},
  {"nom":"Samia BOULIL","contrat":"CDI","niveau":"Expert","domaine":"Sec","titre":"Ingénieur IAM"},
  {"nom":"Thiziri BERKOUKI","contrat":"Freelance","niveau":"Confirme","domaine":"Exp","titre":"Ingénieur Cloud Devops"},
  {"nom":"Jalil AGOUMI","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Python Vue.js"},
  {"nom":"Najwa SAIDI","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Chef de Projet Infra"},
  {"nom":"Abdelilah NIAGUI","contrat":"CDI","niveau":"Expert","domaine":"Sec","titre":"Ingénieur Cybersécurité"},
  {"nom":"Brice ZIE","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Admin Microsoft"},
  {"nom":"Khaled SEGHOUANI","contrat":"Freelance","niveau":"Confirme","domaine":"Dev","titre":"Dev Cloud JS"},
  {"nom":"Ibrahim DOUCOURE","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Ingénieur Système Citrix"},
  {"nom":"Melek HEDDADJI","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Admin SAP"},
  {"nom":"Mustapha AMZIL","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Incident Manager"},
  {"nom":"Soukaina YAJIB","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Incident Manager"},
  {"nom":"Omar BELAFKIH","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Change Manager"},
  {"nom":"Joseph DIABY","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Chef de Projet Workplace"},
  {"nom":"Sofiane TRABELSI","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Ingénieur VMWare"},
  {"nom":"Patrick SCHARGROD","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Chef de Projet"},
  {"nom":"Jean Paul QUINETTE","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"UI/UX Designer"},
  {"nom":"Xavier WERQUIN","contrat":"Freelance","niveau":"Expert","domaine":"Dev","titre":"Dev Angular"},
  {"nom":"Lucien VA","contrat":"CDI","niveau":"Expert","domaine":"Exp","titre":"Admin Control M"},
  {"nom":"Kamel LALDJI","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Chef de Projet"},
  {"nom":"Michael KLEIN","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"Chef de Projet"},
  {"nom":"Samy THABIT-ALY-ABDALLA","contrat":"CDI","niveau":"Expert","domaine":"Exp","titre":"Change Manager"},
  {"nom":"Cyril DELESALLE","contrat":"CDI","niveau":"Expert","domaine":"Strat","titre":"Chef de Projet"},
  {"nom":"Noel DIRIL","contrat":"Freelance","niveau":"Confirme","domaine":"Dev","titre":"Dev Java IA"},
  {"nom":"Maxime THOMAS","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Expert Linux"},
  {"nom":"KENZA BENLHABIB","contrat":"Freelance","niveau":"Expert","domaine":"Exp","titre":"Consultante Servicenow"},
  {"nom":"Philippe WAJDENFELD","contrat":"CDI","niveau":"Expert","domaine":"Sec","titre":"Référent Active Directory"},
  {"nom":"Khalid JAOUani","contrat":"Freelance","niveau":"Expert","domaine":"Strat","titre":"BA Risque Crédit"},
  {"nom":"Houda GHANNAM","contrat":"Freelance","niveau":"Expert","domaine":"Data","titre":"Dev BI"},
  {"nom":"Issam BERTH","contrat":"Freelance","niveau":"Expert","domaine":"Infra","titre":"Ingénieur Active Directory"}
];

function renderPeople() {
  document.getElementById('kpi-cdi').textContent = CONSULTANTS.filter(c => c.contrat === 'CDI').length;
  document.getElementById('kpi-exp').textContent = CONSULTANTS.filter(c => c.niveau === 'Expert').length;
  filterP();
}

function filterP() {
  const s   = (document.getElementById('ps').value || '').toLowerCase();
  const dom = document.getElementById('pd').value;
  const ct  = document.getElementById('pc').value;
  const nv  = document.getElementById('pn').value;

  document.getElementById('pp-grid').innerHTML = CONSULTANTS.filter(c => {
    if (s   && !(c.nom || '').toLowerCase().includes(s) && !(c.titre || '').toLowerCase().includes(s)) return false;
    if (dom && c.domaine  !== dom) return false;
    if (ct  && c.contrat  !== ct)  return false;
    if (nv  && c.niveau   !== nv)  return false;
    return true;
  }).map(c => {
    const dc = DC[c.domaine] || '#6b7280';
    const av = c.nom.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
    return `<div class="pc">
      <div class="pc-head">
        <div class="pc-av" style="background:${dc}">${av}</div>
        <div>
          <div class="pc-name">${x(c.nom)}</div>
          <div class="pc-titre">${x(c.titre)}</div>
        </div>
      </div>
      <div class="pc-tags">
        <span class="pc-tag" style="${c.contrat === 'CDI' ? 'color:var(--green);border-color:#bbf7d0;background:var(--green-bg)' : ''}">${c.contrat}</span>
        ${c.niveau ? `<span class="pc-tag" style="${c.niveau === 'Expert' ? 'color:var(--blue);border-color:#bfdbfe;background:var(--blue-bg)' : ''}">${c.niveau}</span>` : ''}
        <span class="pc-tag" style="color:${dc};border-color:${dc}30;background:${dc}0e">${c.domaine}</span>
      </div>
    </div>`;
  }).join('');
}


// ── UTILITAIRES ──────────────────────────────────────────────────

/** Échappe les caractères HTML dangereux */
function x(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Génère les initiales (2 lettres max) d'un nom */
function ini(n) {
  if (!n) return '?';
  return n.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
}

/** Génère une couleur HSL déterministe à partir d'une chaîne */
function sc(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = s.charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${Math.abs(h) % 360},48%,42%)`;
}


// ── BOARD ────────────────────────────────────────────────────────

function renderBoard() {
  renderPhases();
  renderDocs();
}

function phaseProgress(phaseId) {
  const linked = Object.values(tasks).filter(t => t.phaseId === phaseId);
  const done   = linked.filter(t => t.status === 'done').length;
  const total  = linked.length;
  return { pct: total ? Math.round(done / total * 100) : 0, done, total };
}

function renderPhases() {
  const grid = document.getElementById('phases-grid');
  if (!grid) return;
  const list = Object.values(phases).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.quarter.localeCompare(b.quarter);
  });
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--g400);font-size:13px;border:2px dashed var(--g200);border-radius:var(--r)">Aucune phase définie. Crée ta première phase.</div>`;
    return;
  }
  grid.innerHTML = list.map(ph => {
    const { pct, done, total } = phaseProgress(ph.id);
    const color   = ph.color || QCOLORS[ph.quarter] || '#6b7280';
    const dateStr = ph.start && ph.end
      ? `<div style="font-size:11px;color:var(--g400);margin-bottom:8px">${ph.start} → ${ph.end}</div>`
      : '';
    return `<div class="phase-card" style="border-left-color:${color}" onclick="openPhase('${ph.id}')">
      <span class="phase-qlabel" style="background:${color}">${ph.quarter} ${ph.year}</span>
      <div class="phase-name">${x(ph.name)}</div>
      <div class="phase-obj">${x(ph.objective || '')}</div>
      ${dateStr}
      <div class="phase-prog-bar"><div class="phase-prog-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="phase-prog-txt"><span>${done}/${total} validées</span><span>${pct}%</span></div>
    </div>`;
  }).join('');
}

function renderDocs() {
  const container = document.getElementById('docs-list');
  if (!container) return;
  const list = Object.values(documents).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) {
    container.innerHTML = `<div class="doc-empty">📄 Aucun document. Ajoute un PDF via le bouton ci-dessus.</div>`;
    return;
  }
  const byMonth = {};
  list.forEach(doc => {
    const k = doc.date.slice(0, 7);
    if (!byMonth[k]) byMonth[k] = [];
    byMonth[k].push(doc);
  });
  container.innerHTML = Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).map(k => {
    const [y, m] = k.split('-');
    const label  = new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `<div>
      <div class="doc-month-label">${label}</div>
      <div class="doc-list">
        ${byMonth[k].map(doc => `
          <div class="doc-row">
            <div class="doc-icon">📄</div>
            <div class="doc-info">
              <div class="doc-name">${x(doc.name)}</div>
              <div class="doc-meta">${doc.date} · ${formatSize(doc.size)}</div>
            </div>
            <button class="doc-btn" onclick="downloadDoc('${doc.id}')">↓ Télécharger</button>
            <button class="doc-btn del" onclick="confirmDelDoc('${doc.id}')">✕</button>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
  return (bytes / 1024 / 1024).toFixed(1) + ' Mo';
}

function downloadDoc(id) {
  const doc = documents[id];
  if (!doc) return;
  const a = document.createElement('a');
  a.href = doc.data;
  a.download = doc.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function confirmDelDoc(id) {
  const doc = documents[id];
  if (!doc || !confirm(`Supprimer "${doc.name}" ?`)) return;
  delDocData(id);
}

function handleDocUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    alert('Le PDF dépasse 3 Mo. Veuillez choisir un fichier plus petit.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    _pendingDoc = { name: file.name, data: e.target.result, size: file.size };
    document.getElementById('docname').value = file.name.replace(/\.pdf$/i, '');
    document.getElementById('docdate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('docUploadOv').classList.add('on');
    input.value = '';
  };
  reader.readAsDataURL(file);
}

function confirmDocUpload() {
  if (!_pendingDoc) return;
  const name = document.getElementById('docname').value.trim();
  if (!name) { document.getElementById('docname').focus(); return; }
  saveDocData({
    id:        'doc_' + Date.now(),
    name,
    date:      document.getElementById('docdate').value,
    data:      _pendingDoc.data,
    size:      _pendingDoc.size,
    createdAt: Date.now()
  });
  _pendingDoc = null;
  closeOv('docUploadOv');
}


// ── PHASE MODAL ──────────────────────────────────────────────────

function openNewPhase() {
  editPhaseId = null;
  document.getElementById('pht').value = '';
  document.getElementById('phq').value = 'Q1';
  document.getElementById('phy').value = '2026';
  document.getElementById('pho').value = '';
  updatePhaseDates();
  document.getElementById('phdel').style.display = 'none';
  document.getElementById('phaseOv').classList.add('on');
  setTimeout(() => document.getElementById('pht').focus(), 150);
}

function openPhase(id) {
  const ph = phases[id];
  if (!ph) return;
  editPhaseId = id;
  document.getElementById('pht').value = ph.name      || '';
  document.getElementById('phq').value = ph.quarter   || 'Q1';
  document.getElementById('phy').value = ph.year      || '2026';
  document.getElementById('phs').value = ph.start     || '';
  document.getElementById('phe').value = ph.end       || '';
  document.getElementById('pho').value = ph.objective || '';
  document.getElementById('phdel').style.display = '';
  document.getElementById('phaseOv').classList.add('on');
}

function updatePhaseDates() {
  const q    = document.getElementById('phq').value;
  const year = document.getElementById('phy').value;
  const dd   = QDATES[q];
  if (dd) {
    document.getElementById('phs').value = year + dd.start;
    document.getElementById('phe').value = year + dd.end;
  }
}

function savePhase() {
  const name = document.getElementById('pht').value.trim();
  if (!name) { document.getElementById('pht').focus(); return; }
  const q    = document.getElementById('phq').value;
  const year = parseInt(document.getElementById('phy').value) || 2026;
  const id   = editPhaseId || 'ph_' + Date.now();
  savePhaseData({
    id, name, quarter: q, year,
    start:     document.getElementById('phs').value,
    end:       document.getElementById('phe').value,
    objective: document.getElementById('pho').value.trim(),
    color:     QCOLORS[q] || '#6b7280',
    createdAt: (phases[id] && phases[id].createdAt) || Date.now(),
    updatedAt: Date.now()
  });
  closeOv('phaseOv');
}

function delPhase() {
  if (!editPhaseId || !confirm('Supprimer cette phase ?')) return;
  delPhaseData(editPhaseId);
  closeOv('phaseOv');
}

function populatePhaseDropdown() {
  const sel = document.getElementById('mph');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Aucune phase —</option>';
  Object.values(phases)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter.localeCompare(b.quarter))
    .forEach(ph => {
      const opt = document.createElement('option');
      opt.value = ph.id;
      opt.textContent = `${ph.quarter} ${ph.year} — ${ph.name}`;
      sel.appendChild(opt);
    });
  if (cur) sel.value = cur;
}

function populatePhaseSidebar() {
  const sel = document.getElementById('fph');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Toutes les phases</option>';
  Object.values(phases)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter.localeCompare(b.quarter))
    .forEach(ph => {
      const opt = document.createElement('option');
      opt.value = ph.id;
      opt.textContent = `${ph.quarter} ${ph.year} — ${ph.name}`;
      sel.appendChild(opt);
    });
  if (cur) sel.value = cur;
}


// ── FIREBASE PHASES & DOCS ───────────────────────────────────────

function savePhaseData(ph) {
  if (_db) {
    setSS('saving');
    const { ref, set } = window._fb;
    set(ref(_db, 'ava2i/phases/' + ph.id), ph)
      .then(() => setSS('connected'))
      .catch(() => setSS('offline'));
  }
  phases[ph.id] = ph;
  lsSavePhases();
  renderPhases();
  populatePhaseSidebar();
  if (curView === 'timeline') renderTimeline();
}

function delPhaseData(id) {
  if (_db) { const { ref, remove } = window._fb; remove(ref(_db, 'ava2i/phases/' + id)); }
  delete phases[id];
  lsSavePhases();
  renderPhases();
  populatePhaseSidebar();
  if (curView === 'timeline') renderTimeline();
}

function saveDocData(doc) {
  if (_db) {
    setSS('saving');
    const { ref, set } = window._fb;
    set(ref(_db, 'ava2i/documents/' + doc.id), doc)
      .then(() => setSS('connected'))
      .catch(() => setSS('offline'));
  }
  documents[doc.id] = doc;
  lsSaveDocs();
  renderDocs();
}

function delDocData(id) {
  if (_db) { const { ref, remove } = window._fb; remove(ref(_db, 'ava2i/documents/' + id)); }
  delete documents[id];
  lsSaveDocs();
  renderDocs();
}
