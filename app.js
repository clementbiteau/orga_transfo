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
let objectives  = {};
let editPhaseId = null;
let editObjId   = null;
let _pendingDoc = null;

// ── ÉTAT CALENDRIER ───────────────────────────────────────────────
let events      = {};
let calYear     = new Date().getFullYear();
let calMonth    = new Date().getMonth();
let editEventId = null;
let _pendingEvAttach = []; // [{name,data,size}]

const QCOLORS = { Q1: '#2563eb', Q2: '#16a34a', Q3: '#b45309', Q4: '#7c3aed' };
const QDATES  = {
  Q1: { start: '-01-01', end: '-03-31' },
  Q2: { start: '-04-01', end: '-06-30' },
  Q3: { start: '-07-01', end: '-09-30' },
  Q4: { start: '-10-01', end: '-12-31' },
};


// ── CONSTANTES / MAPPINGS ────────────────────────────────────────
const TC = {
  'Offre':             '#2563eb',
  'Compétences':       '#7c3aed',
  'Go-to-Market':      '#16a34a',
  'Modèle Economique': '#b45309',
  'Organisation':      '#0891b2',
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
      if (document.getElementById('panel-board').classList.contains('on')) renderBoard();
      if (curView === 'timeline') renderTimeline();
    });
    onValue(ref(_db, 'ava2i/documents'), snap => {
      documents = snap.val() || {};
      lsSaveDocs();
      if (document.getElementById('panel-board').classList.contains('on')) renderDocs();
    });
    onValue(ref(_db, 'ava2i/objectives'), snap => {
      objectives = snap.val() || {};
      lsSaveObjs();
      if (document.getElementById('panel-board').classList.contains('on')) renderBoard();
    });
    onValue(ref(_db, 'ava2i/events'), snap => {
      events = snap.val() || {};
      lsSaveEvents();
      if (document.getElementById('panel-calendar').classList.contains('on')) renderCalendar();
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

function lsSavePhases()  { try { localStorage.setItem('ava2i_ph', JSON.stringify(phases));     } catch(e) {} }
function lsLoadPhases()  { try { const d = localStorage.getItem('ava2i_ph'); if (d) phases = JSON.parse(d);     } catch(e) {} }
function lsSaveDocs()    { try { localStorage.setItem('ava2i_dc', JSON.stringify(documents)); } catch(e) {} }
function lsLoadDocs()    { try { const d = localStorage.getItem('ava2i_dc'); if (d) documents = JSON.parse(d); } catch(e) {} }
function lsSaveObjs()    { try { localStorage.setItem('ava2i_ob', JSON.stringify(objectives));} catch(e) {} }
function lsLoadObjs()    { try { const d = localStorage.getItem('ava2i_ob'); if (d) objectives = JSON.parse(d); } catch(e) {} }
function lsSaveEvents()  { try { localStorage.setItem('ava2i_ev', JSON.stringify(events));    } catch(e) {} }
function lsLoadEvents()  { try { const d = localStorage.getItem('ava2i_ev'); if (d) events = JSON.parse(d);    } catch(e) {} }

// Initialisation au chargement de la page
window.addEventListener('load', () => {
  lsLoad();
  lsLoadPhases();
  lsLoadDocs();
  lsLoadObjs();
  lsLoadEvents();
  setTimeout(() => {
    if (window._fb) initFB();
    else setSS('offline');
  }, 500);
  renderPeople();
  render();
});


// ── MODAL TÂCHE ──────────────────────────────────────────────────

function openNew(prePhaseId, preObjId) {
  editId = null;
  ['mt', 'mo', 'mdl', 'mde'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ms').value  = 'todo';
  document.getElementById('mp').value  = 'moyenne';
  document.getElementById('mty').value = 'Offre';
  document.getElementById('mst').value = new Date().toISOString().slice(0, 10);
  populatePhaseDropdown();
  document.getElementById('mph').value = prePhaseId || '';
  populateObjDropdown(prePhaseId || '', preObjId || '');
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
  populateObjDropdown(t.phaseId || '', t.objectiveId || '');
  document.getElementById('mbdel').style.display = '';
  document.getElementById('taskOv').classList.add('on');
}

function saveTask() {
  const title = document.getElementById('mt').value.trim();
  if (!title) return;
  const id = editId || 't' + Date.now();
  const phaseId = document.getElementById('mph').value || null;
  const objectiveId = document.getElementById('mobj').value || null;
  save({
    id, title,
    status:      document.getElementById('ms').value,
    priority:    document.getElementById('mp').value,
    type:        document.getElementById('mty').value,
    owner:       document.getElementById('mo').value.trim(),
    start:       document.getElementById('mst').value,
    deadline:    document.getElementById('mdl').value,
    desc:        document.getElementById('mde').value.trim(),
    phaseId,
    objectiveId,
    createdAt:   tasks[id]?.createdAt || Date.now(),
    updatedAt:   Date.now()
  });
  closeOv('taskOv');
  render();
  if (document.getElementById('panel-board').classList.contains('on')) renderBoard();
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
  if (e.key === 'Escape') {
    ['taskOv','setupOv','phaseOv','docUploadOv','objOv','eventOv'].forEach(id => closeOv(id));
  }
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
      <div class="tl-llabel-h">Phase</div>
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
  if (t === 'board')    renderBoard();
  if (t === 'calendar') renderCalendar();
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

/** SVG pie/donut chart — pct 0-100, color hex/css, size px */
function pie(pct, color, size) {
  size = size || 54;
  const r = (size - 10) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash  = ((pct / 100) * circ).toFixed(2);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;flex-shrink:0">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity=".09"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--g200)" stroke-width="4.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="4.5"
      stroke-linecap="round"
      stroke-dasharray="${dash} ${circ.toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
      font-size="11" font-weight="700" fill="${color}"
      font-family="-apple-system,BlinkMacSystemFont,'Inter',sans-serif">${pct}%</text>
  </svg>`;
}

function phaseProgress(phaseId) {
  const linked = Object.values(tasks).filter(t => t.phaseId === phaseId);
  const done   = linked.filter(t => t.status === 'done').length;
  const total  = linked.length;
  return { pct: total ? Math.round(done / total * 100) : 0, done, total };
}

function renderBoard() {
  renderPhaseSections();
  renderDocs();
}

function renderPhaseSections() {
  const stack = document.getElementById('phases-stack');
  if (!stack) return;
  const list = Object.values(phases).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.quarter.localeCompare(b.quarter);
  });
  if (!list.length) {
    stack.innerHTML = `<div class="phases-empty">
      <div class="phases-empty-icon">🗂️</div>
      <div style="font-size:14px;font-weight:600;color:var(--g600);margin-bottom:6px">Aucune phase définie</div>
      <div style="font-size:13px;color:var(--g400)">Crée ta première phase avec le bouton ci-dessus.</div>
    </div>`;
    return;
  }
  // Preserve open/closed state
  const openIds = new Set([...stack.querySelectorAll('.ph-section.open')].map(el => el.id.replace('phs-', '')));
  stack.innerHTML = list.map(ph => phaseSection(ph, openIds.has(ph.id))).join('');
}

function phaseSection(ph, isOpen) {
  const { pct, done, total } = phaseProgress(ph.id);
  const color   = ph.color || QCOLORS[ph.quarter] || '#6b7280';
  const dateStr = ph.start && ph.end ? `📅 ${ph.start} → ${ph.end}` : '';
  const objList = Object.values(objectives)
    .filter(o => o.phaseId === ph.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return `<div class="ph-section${isOpen ? ' open' : ''}" id="phs-${ph.id}">
    <div class="phs-hd" onclick="togglePhaseSection('${ph.id}')">
      <div class="phs-accent" style="background:${color}"></div>
      <div class="phs-meta">
        <span class="phase-qlabel" style="background:${color}18;color:${color}">${ph.quarter} ${ph.year}</span>
        <div class="phs-name">${x(ph.name)}</div>
        ${dateStr ? `<div class="phs-dates">${dateStr}</div>` : ''}
      </div>
      <div class="phs-right">
        ${pie(pct, color, 54)}
        <button class="phs-edit-btn" onclick="openPhase('${ph.id}');event.stopPropagation()">✎ Éditer</button>
        <span class="phs-chevron">▾</span>
      </div>
    </div>
    <div class="phs-body" id="phsb-${ph.id}">
      <div class="obj-scroll-wrap">
        ${objList.map(o => objColumn(o)).join('')}
        ${unassignedCol(ph)}
        <div class="obj-col-new" onclick="openNewObj('${ph.id}')">
          <div class="obj-col-new-inner">+ Objectif</div>
        </div>
      </div>
    </div>
  </div>`;
}

function objColumn(obj) {
  const phTasks = Object.values(tasks)
    .filter(t => t.objectiveId === obj.id)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return `<div class="obj-col">
    <div class="obj-col-hd" onclick="openObj('${obj.id}')">
      <div class="obj-col-name" title="${x(obj.title)}">${x(obj.title)}</div>
      <span class="obj-col-count">${phTasks.length}</span>
    </div>
    <div class="obj-tasks-list">
      ${phTasks.map(t => taskMiniCard(t)).join('')}
      <button class="obj-add-task-btn" onclick="openNew('${obj.phaseId}','${obj.id}')">+ Tâche</button>
    </div>
  </div>`;
}

function unassignedCol(ph) {
  const uTasks = Object.values(tasks)
    .filter(t => t.phaseId === ph.id && !t.objectiveId)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (!uTasks.length) return '';
  return `<div class="obj-col">
    <div class="obj-col-hd" style="cursor:default">
      <div class="obj-col-name" style="color:var(--g400);font-style:italic">Non assignées</div>
      <span class="obj-col-count">${uTasks.length}</span>
    </div>
    <div class="obj-tasks-list">
      ${uTasks.map(t => taskMiniCard(t)).join('')}
    </div>
  </div>`;
}

function taskMiniCard(t) {
  const SC = { todo: 'var(--g400)', wip: 'var(--amber)', review: 'var(--purple)', done: 'var(--green)', block: 'var(--red)' };
  return `<div class="obj-task-card" onclick="openTask('${t.id}')">
    <span class="otc-dot" style="background:${SC[t.status] || 'var(--g300)'}"></span>
    <div class="otc-title">${x(t.title)}</div>
  </div>`;
}

function togglePhaseSection(phId) {
  const el = document.getElementById('phs-' + phId);
  if (el) el.classList.toggle('open');
}

function renderDocs() {
  const container = document.getElementById('docs-list');
  if (!container) return;
  const list = Object.values(documents).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) {
    container.innerHTML = `<div class="doc-empty"><div class="doc-empty-icon">📄</div>Aucun document. Ajoute un PDF via le bouton ci-dessus.</div>`;
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
    return `<div class="doc-month-group">
      <div class="doc-month-label">${label}</div>
      <div class="doc-list">
        ${byMonth[k].map(doc => `
          <div class="doc-row">
            <div class="doc-icon">📄</div>
            <div class="doc-info">
              <div class="doc-name">${x(doc.name)}</div>
              <div class="doc-meta">${doc.date} · ${formatSize(doc.size)}</div>
            </div>
            <div class="doc-actions">
              <button class="doc-btn" onclick="downloadDoc('${doc.id}')">↓ Télécharger</button>
              <button class="doc-btn del" onclick="confirmDelDoc('${doc.id}')">✕</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

// ── OBJECTIVES CRUD ──────────────────────────────────────────────

function openNewObj(phaseId) {
  editObjId = null;
  document.getElementById('obj-phase-id').value = phaseId || '';
  document.getElementById('obj-title').value = '';
  document.getElementById('obj-desc').value  = '';
  document.getElementById('obj-del').style.display = 'none';
  document.getElementById('objOv').classList.add('on');
  setTimeout(() => document.getElementById('obj-title').focus(), 120);
}

function openObj(id) {
  const obj = objectives[id];
  if (!obj) return;
  editObjId = id;
  document.getElementById('obj-phase-id').value = obj.phaseId || '';
  document.getElementById('obj-title').value    = obj.title || '';
  document.getElementById('obj-desc').value     = obj.desc  || '';
  document.getElementById('obj-del').style.display = '';
  document.getElementById('objOv').classList.add('on');
}

function saveObj() {
  const title = document.getElementById('obj-title').value.trim();
  if (!title) return;
  const phaseId = document.getElementById('obj-phase-id').value;
  const id = editObjId || 'o' + Date.now();
  const obj = {
    id, phaseId, title,
    desc:      document.getElementById('obj-desc').value.trim(),
    order:     editObjId ? (objectives[id]?.order || 0) : Date.now(),
    createdAt: objectives[id]?.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  saveObjData(obj);
  closeOv('objOv');
}

function delObj() {
  if (!editObjId || !confirm('Supprimer cet objectif ?')) return;
  // Unassign tasks from this objective
  Object.values(tasks).forEach(t => {
    if (t.objectiveId === editObjId) {
      t.objectiveId = null;
      save(t);
    }
  });
  delObjData(editObjId);
  closeOv('objOv');
}

function saveObjData(obj) {
  if (_db) {
    const { ref, set } = window._fb;
    set(ref(_db, 'ava2i/objectives/' + obj.id), obj);
  }
  objectives[obj.id] = obj;
  lsSaveObjs();
  renderBoard();
}

function delObjData(id) {
  if (_db) {
    const { ref, remove } = window._fb;
    remove(ref(_db, 'ava2i/objectives/' + id));
  }
  delete objectives[id];
  lsSaveObjs();
  renderBoard();
}

function populateObjDropdown(phaseId, selectedObjId) {
  const sel = document.getElementById('mobj');
  if (!sel) return;
  const ph  = phaseId || document.getElementById('mph')?.value || '';
  const obs = Object.values(objectives)
    .filter(o => o.phaseId === ph)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  sel.innerHTML = `<option value="">— Aucun objectif —</option>` +
    obs.map(o => `<option value="${o.id}">${x(o.title)}</option>`).join('');
  if (selectedObjId) sel.value = selectedObjId;
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
  renderBoard();
  populatePhaseSidebar();
  if (curView === 'timeline') renderTimeline();
}

function delPhaseData(id) {
  if (_db) { const { ref, remove } = window._fb; remove(ref(_db, 'ava2i/phases/' + id)); }
  delete phases[id];
  lsSavePhases();
  renderBoard();
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


// ── CALENDRIER ───────────────────────────────────────────────────

const CAL_DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function renderCalendar() {
  const titleEl = document.getElementById('cal-title');
  const gridEl  = document.getElementById('cal-grid');
  if (!titleEl || !gridEl) return;

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);
  const today    = new Date();

  // Month title
  titleEl.textContent = firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Events this month
  const prefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const monthEvs = Object.values(events).filter(e => e.date && e.date.startsWith(prefix));
  const byDay = {};
  monthEvs.forEach(e => {
    const d = e.date.slice(8, 10);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(e);
  });

  // Grid — week starts Monday
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = (startDow === 0 ? 6 : startDow - 1); // shift to Mon=0

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null); // empty before
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null); // empty after

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  gridEl.innerHTML = `
    <div class="cal-day-headers">
      ${CAL_DAYS_FR.map(d => `<div class="cal-day-h">${d}</div>`).join('')}
    </div>
    ${weeks.map(week => `
      <div class="cal-week">
        ${week.map(d => {
          if (!d) return `<div class="cal-day other-m"></div>`;
          const ds    = String(d).padStart(2, '0');
          const isToday = today.getDate() === d && today.getMonth() === calMonth && today.getFullYear() === calYear;
          const dayEvs  = byDay[ds] || [];
          const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${ds}`;
          return `<div class="cal-day${isToday ? ' today' : ''}" onclick="openNewEvent('${dateStr}')">
            <div class="cal-day-num">${d}</div>
            ${dayEvs.slice(0, 3).map(e => `
              <span class="cal-ev-pill" onclick="openEvent('${e.id}');event.stopPropagation()" title="${x(e.title)}">
                ${e.time ? e.time.slice(0,5) + ' ' : ''}${x(e.title)}
              </span>`).join('')}
            ${dayEvs.length > 3 ? `<span style="font-size:10px;color:var(--g400)">+${dayEvs.length - 3} autres</span>` : ''}
          </div>`;
        }).join('')}
      </div>`
    ).join('')}`;
}

function calNav(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}

function calToday() {
  calYear  = new Date().getFullYear();
  calMonth = new Date().getMonth();
  renderCalendar();
}

// ── EVENTS CRUD ──────────────────────────────────────────────────

function openNewEvent(dateStr) {
  editEventId = null;
  _pendingEvAttach = [];
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-date').value  = dateStr || new Date().toISOString().slice(0, 10);
  document.getElementById('ev-time').value  = '';
  document.getElementById('ev-cr').value    = '';
  document.getElementById('ev-attach-list').innerHTML = '';
  document.getElementById('ev-del').style.display = 'none';
  document.getElementById('eventOv').classList.add('on');
  setTimeout(() => document.getElementById('ev-title').focus(), 120);
}

function openEvent(id) {
  const ev = events[id];
  if (!ev) return;
  editEventId = id;
  _pendingEvAttach = ev.attachments ? [...ev.attachments] : [];
  document.getElementById('ev-title').value = ev.title || '';
  document.getElementById('ev-date').value  = ev.date  || '';
  document.getElementById('ev-time').value  = ev.time  || '';
  document.getElementById('ev-cr').value    = ev.cr    || '';
  document.getElementById('ev-del').style.display = '';
  renderAttachList();
  document.getElementById('eventOv').classList.add('on');
}

function addEventAttach(input) {
  const files = Array.from(input.files);
  files.forEach(file => {
    if (file.size > 5 * 1024 * 1024) { alert(`"${file.name}" dépasse 5 Mo.`); return; }
    const reader = new FileReader();
    reader.onload = e => {
      _pendingEvAttach.push({ name: file.name, data: e.target.result, size: file.size });
      renderAttachList();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderAttachList() {
  const el = document.getElementById('ev-attach-list');
  if (!el) return;
  el.innerHTML = _pendingEvAttach.map((a, i) => `
    <div class="attach-item">
      <span>📎</span>
      <span class="attach-name" title="${x(a.name)}">${x(a.name)}</span>
      <span style="font-size:11px;color:var(--g400)">${formatSize(a.size)}</span>
      <button class="attach-del" onclick="removeAttach(${i})">✕</button>
    </div>`).join('');
}

function removeAttach(idx) {
  _pendingEvAttach.splice(idx, 1);
  renderAttachList();
}

function saveEvent() {
  const title = document.getElementById('ev-title').value.trim();
  if (!title) { document.getElementById('ev-title').focus(); return; }
  const id = editEventId || 'ev_' + Date.now();
  const ev = {
    id, title,
    date:        document.getElementById('ev-date').value,
    time:        document.getElementById('ev-time').value,
    cr:          document.getElementById('ev-cr').value.trim(),
    attachments: _pendingEvAttach,
    createdAt:   events[id]?.createdAt || Date.now(),
    updatedAt:   Date.now()
  };
  saveEventData(ev);
  closeOv('eventOv');
}

function delEvent() {
  if (!editEventId || !confirm('Supprimer cet événement ?')) return;
  delEventData(editEventId);
  closeOv('eventOv');
}

function saveEventData(ev) {
  if (_db) {
    const { ref, set } = window._fb;
    set(ref(_db, 'ava2i/events/' + ev.id), ev);
  }
  events[ev.id] = ev;
  lsSaveEvents();
  renderCalendar();
}

function delEventData(id) {
  if (_db) { const { ref, remove } = window._fb; remove(ref(_db, 'ava2i/events/' + id)); }
  delete events[id];
  lsSaveEvents();
  renderCalendar();
}


// ── CHAT ─────────────────────────────────────────────────────────

let _chatOpen = false;

function toggleChat() {
  _chatOpen = !_chatOpen;
  document.getElementById('chat-panel').classList.toggle('on', _chatOpen);
  if (_chatOpen) setTimeout(() => document.getElementById('chat-input').focus(), 150);
}

function chatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = '';
  input.style.height = '';
  addChatMsg('user', msg);
  processChatCmd(msg);
}

function processChatCmd(raw) {
  const tokens  = raw.trim().split(/\s+/);
  const cmds    = tokens.filter(t => t.startsWith('/'));
  const textParts = tokens.filter(t => !t.startsWith('/'));
  const title   = textParts.join(' ').trim();

  if (!cmds.includes('/task')) {
    addChatMsg('bot', 'Commence par <strong>/task</strong> pour créer une tâche. Ex :<br><code>/task /today /endofyear Finaliser le rapport</code>');
    return;
  }

  if (!title) {
    addChatMsg('error', 'Précise un titre après les commandes. Ex : <code>/task /today Mon titre</code>');
    return;
  }

  const todayStr   = new Date().toISOString().slice(0, 10);
  const yearEndStr = `${new Date().getFullYear()}-12-31`;

  let startDate    = '';
  let deadlineDate = '';

  cmds.forEach(c => {
    if (c === '/today')    startDate    = todayStr;
    if (c === '/endofyear') deadlineDate = yearEndStr;
    if (/^\/\d{4}-\d{2}-\d{2}$/.test(c)) {
      const ds = c.slice(1);
      // If no start set yet, use as start; else as deadline
      if (!startDate) startDate = ds; else deadlineDate = ds;
    }
  });

  const id = 't' + Date.now();
  save({
    id, title,
    status:    'todo',
    priority:  'moyenne',
    type:      'Organisation',
    start:     startDate,
    deadline:  deadlineDate,
    owner:     '',
    desc:      '',
    phaseId:   null,
    objectiveId: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  render();
  if (document.getElementById('panel-board').classList.contains('on')) renderBoard();

  addChatMsg('success',
    `✓ Tâche créée : <strong>${x(title)}</strong>` +
    (startDate    ? `<br>Début : ${startDate}` : '') +
    (deadlineDate ? `<br>Deadline : ${deadlineDate}` : '')
  );
}

function addChatMsg(type, html) {
  const msgs = document.getElementById('chat-msgs');
  const div  = document.createElement('div');
  div.className = `chat-msg ${type}`;
  div.innerHTML = `<div class="chat-msg-bubble">${html}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}
