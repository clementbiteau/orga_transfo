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
const F = { status: new Set(), priority: new Set(), type: new Set(), centre: new Set() };


// ── CONSTANTES / MAPPINGS ────────────────────────────────────────
const TC = {
  Structure:    '#2563eb',
  Recrutement:  '#7c3aed',
  Formation:    '#b45309',
  Produit:      '#16a34a',
  Gouvernance:  '#0891b2',
  Client:       '#dc2626'
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

// Initialisation au chargement de la page
window.addEventListener('load', () => {
  lsLoad();
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
  document.getElementById('mty').value = 'Structure';
  document.getElementById('mc').value  = 'Transversal';
  document.getElementById('mst').value = new Date().toISOString().slice(0, 10);
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
  document.getElementById('mty').value = t.type     || 'Structure';
  document.getElementById('mc').value  = t.centre   || 'Transversal';
  document.getElementById('mo').value  = t.owner    || '';
  document.getElementById('mst').value = t.start    || '';
  document.getElementById('mdl').value = t.deadline || '';
  document.getElementById('mde').value = t.desc     || '';
  document.getElementById('mbdel').style.display = '';
  document.getElementById('taskOv').classList.add('on');
}

function saveTask() {
  const title = document.getElementById('mt').value.trim();
  if (!title) return;
  const id = editId || 't' + Date.now();
  save({
    id, title,
    status:    document.getElementById('ms').value,
    priority:  document.getElementById('mp').value,
    type:      document.getElementById('mty').value,
    centre:    document.getElementById('mc').value,
    owner:     document.getElementById('mo').value.trim(),
    start:     document.getElementById('mst').value,
    deadline:  document.getElementById('mdl').value,
    desc:      document.getElementById('mde').value.trim(),
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
  if (e.key === 'Escape') { closeOv('taskOv'); closeOv('setupOv'); }
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
  ['status', 'priority', 'type', 'centre'].forEach(g => F[g].clear());
  document.querySelectorAll('.chip.on').forEach(c => c.classList.remove('on'));
  render();
}

function matches(t) {
  const s  = (document.getElementById('fs').value || '').toLowerCase();
  const o  = (document.getElementById('fo').value || '').toLowerCase();
  const dl = document.getElementById('fd').value;

  if (s && !(t.title || '').toLowerCase().includes(s) && !(t.owner || '').toLowerCase().includes(s)) return false;
  if (o && !(t.owner || '').toLowerCase().includes(o)) return false;
  if (F.status.size   && !F.status.has(t.status))     return false;
  if (F.priority.size && !F.priority.has(t.priority)) return false;
  if (F.type.size     && !F.type.has(t.type))         return false;
  if (F.centre.size   && !F.centre.has(t.centre))     return false;

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
            <span>Priorité</span><span>Centre</span><span>Owner</span>
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
    <div style="font-size:12px;color:var(--g400)">${t.centre || '—'}</div>
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
  const root  = document.getElementById('tl-root');
  const empty = document.getElementById('tl-empty');
  const vt    = vis().filter(t => t.start && t.end);

  if (!vt.length) {
    root.innerHTML = '';
    root.style.display  = 'none';
    empty.style.display = '';
    return;
  }
  root.style.display  = '';
  empty.style.display = 'none';

  // Bornes de la timeline
  let mn = new Date(Math.min(...vt.map(t => new Date(t.start))));
  let mx = new Date(Math.max(...vt.map(t => new Date(t.end))));
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

  const centres = ['Transversal', 'C01', 'C02', 'C03'];
  const lanes   = centres
    .map(c => ({ c, tasks: vt.filter(t => t.centre === c) }))
    .filter(l => l.tasks.length);

  const tp = pct(new Date());

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
    ${lanes.map(lane => `
      <div class="tl-row">
        <div class="tl-llabel">${lane.c}</div>
        <div class="tl-area" style="min-height:${Math.max(48, lane.tasks.length * 36 + 20)}px">
          ${lane.tasks.map((t, i) => {
            const tc = TC[t.type] || '#2563eb';
            const l  = pct(t.start);
            const w  = Math.max(Number(pct(t.end)) - Number(l), 0.5);
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
