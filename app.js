'use strict';

const BIBLE = window.BSB; // [{ n: name, c: [[verse, ...], ...] }]; '' = verse omitted by the BSB
const OT_BOOKS = 39;
const omitted = (b, c, v) => !BIBLE[b].c[c][v];
const countIn = (ch) => ch.reduce((n, t) => n + (t ? 1 : 0), 0);
const versesIn = (book) => book.c.reduce((n, ch) => n + countIn(ch), 0);
const TOTAL = BIBLE.reduce((n, b) => n + versesIn(b), 0);
const OMITTED_NOTE = 'This verse is not in the Berean Standard Bible. It is found only in later manuscripts, so the BSB leaves it out of the main text.';

// Paper geometry, as fractions of the paper's width so pages scale to any screen.
const LINE = 0.085;   // ruled line spacing (default; narrow screens get wider spacing)
const MIN_LINE_PX = 46; // comfortable for finger writing on a phone
const TOP = 0.03;     // space above first line
const MARGIN = 0.07;  // left margin rule
const TRACE_FONT = '"Caveat", "Segoe Script", "Bradley Hand", cursive';

const INKS = [
  ['#1d1b26', 'Iron gall'],
  ['#1f3a6b', 'Navy'],
  ['#5e3a1c', 'Sepia'],
  ['#8e1b2c', 'Crimson'],
  ['#2f5d3a', 'Green'],
];

const $ = (s) => document.querySelector(s);
const key = (b, c, v) => `${b}.${c}.${v}`;
const refOf = (b, c, v) => `${BIBLE[b].n} ${c + 1}:${v + 1} · BSB`;
const fmt = (n) => n.toLocaleString();

// ---------- preferences (per-device conveniences) ----------
const prefs = Object.assign(
  { b: 0, c: 0, v: 0, color: INKS[0][0], size: 2.5, trace: false, penOnly: false },
  readPrefs()
);
function readPrefs() {
  try { return JSON.parse(localStorage.getItem('ll-prefs')) || {}; } catch { return {}; }
}
function savePrefs() {
  try { localStorage.setItem('ll-prefs', JSON.stringify(prefs)); } catch { /* storage unavailable */ }
}

// ---------- IndexedDB: 'ink' holds strokes, 'progress' holds {d: done, u: updated} ----------
let DB;
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('living-letters', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('ink');
      req.result.createObjectStore('progress');
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function idb(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = DB.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r && r.result);
    t.onerror = () => rej(t.error);
  });
}
const idbGet = (store, k) => idb(store, 'readonly', (s) => s.get(k));
const idbPut = (store, k, v) => idb(store, 'readwrite', (s) => s.put(v, k));
const idbDel = (store, k) => idb(store, 'readwrite', (s) => s.delete(k));
function idbAll(store) {
  return new Promise((res, rej) => {
    const out = {};
    const t = DB.transaction(store);
    const cur = t.objectStore(store).openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { out[c.key] = c.value; c.continue(); }
    };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
  });
}

// ---------- state ----------
const state = {
  b: 0, c: 0, v: 0,
  strokes: [], redo: [], lines: 4, lineR: LINE,
  tool: 'pen',
  progress: {},   // key -> {d, u}
  dirty: false,
  loadToken: 0,
};

// ---------- drawing ----------
const paper = $('#paper'), bg = $('#bg'), ink = $('#ink');
const bgCtx = bg.getContext('2d'), inkCtx = ink.getContext('2d');
let W = 0, H = 0;

const paperHeight = (w, lines, r) => Math.round(w * (TOP + (lines + 0.6) * r));
const lineRatioFor = (w) => Math.max(LINE, MIN_LINE_PX / (w || 700));

function drawRules(ctx, w, h, lines, r) {
  const L = r * w, top = TOP * w;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(80, 120, 175, .30)';
  for (let i = 1; i <= lines; i++) {
    const y = Math.round(top + i * L) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(190, 70, 70, .30)';
  const x = Math.round(MARGIN * w) + 0.5;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
}

function wrapText(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const t = line ? line + ' ' + word : word;
    if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function traceLayout(ctx, text, w, r) {
  ctx.font = `${r * w * 0.72}px ${TRACE_FONT}`;
  return wrapText(ctx, text, w * (1 - MARGIN - 0.05));
}

function autoLines(text, r) {
  return Math.max(3, traceLayout(bgCtx, text, paper.clientWidth || 700, r).length + 1);
}

function drawPaper() {
  const dpr = window.devicePixelRatio || 1;
  bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bgCtx.clearRect(0, 0, W, H);
  const r = state.lineR;
  drawRules(bgCtx, W, H, state.lines, r);
  if (prefs.trace) {
    const rows = traceLayout(bgCtx, verseText(), W, r);
    bgCtx.fillStyle = 'rgba(60, 55, 75, .20)';
    rows.forEach((row, i) => {
      if (i < state.lines) bgCtx.fillText(row, W * (MARGIN + 0.02), TOP * W + (i + 1) * r * W - r * W * 0.2);
    });
  }
}

// Stroke: { t: 'p'|'e', c: colour, w: width / paperWidth, p: [[x/W, y/W, pressure], ...] }
function segWidth(s, a, b, w) {
  const pr = (a[2] + b[2]) / 2;
  return Math.max(0.6, s.w * w * (0.35 + pr * 1.3));
}

function drawSegment(ctx, s, i, w) {
  const p = s.p;
  ctx.globalCompositeOperation = s.t === 'e' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = s.c;
  ctx.lineCap = ctx.lineJoin = 'round';
  if (i === 0) {
    ctx.beginPath();
    ctx.arc(p[0][0] * w, p[0][1] * w, segWidth(s, p[0], p[0], w) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const a = p[i - 1], b = p[i];
  ctx.lineWidth = segWidth(s, a, b, w);
  ctx.beginPath();
  ctx.moveTo(a[0] * w, a[1] * w);
  ctx.lineTo(b[0] * w, b[1] * w);
  ctx.stroke();
}

function drawStrokes(ctx, strokes, w) {
  for (const s of strokes) for (let i = 0; i < s.p.length; i++) drawSegment(ctx, s, i, w);
  ctx.globalCompositeOperation = 'source-over';
}

function redrawInk() {
  const dpr = window.devicePixelRatio || 1;
  inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  inkCtx.clearRect(0, 0, W, H);
  drawStrokes(inkCtx, state.strokes, W);
}

function layoutPaper() {
  W = paper.clientWidth;
  // A blank page adapts to the screen; once written on, its ruling is kept with the ink.
  if (!state.strokes.length && !state.dirty) {
    const r = lineRatioFor(W);
    if (r !== state.lineR) { state.lineR = r; state.lines = autoLines(verseText(), r); }
  }
  H = paperHeight(W, state.lines, state.lineR);
  const dpr = window.devicePixelRatio || 1;
  for (const cv of [bg, ink]) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.height = H + 'px';
  }
  paper.style.height = H + 'px';
  drawPaper();
  redrawInk();
}

new ResizeObserver(() => { if (paper.clientWidth && paper.clientWidth !== W) layoutPaper(); }).observe(paper);

// ---------- pointer input ----------
let cur = null, curId = null;

function pointOf(e) {
  const r = ink.getBoundingClientRect();
  const pr = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
  const q = (n) => Math.round(n * 10000) / 10000;
  return [q((e.clientX - r.left) / W), q((e.clientY - r.top) / W), q(pr)];
}

ink.addEventListener('pointerdown', (e) => {
  if (cur || e.button > 0) return;
  if (prefs.penOnly && e.pointerType === 'touch') return;
  e.preventDefault();
  try { ink.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
  curId = e.pointerId;
  const eraser = state.tool === 'eraser' || e.button === 5; // 5 = pen eraser end
  cur = { t: eraser ? 'e' : 'p', c: prefs.color, w: (eraser ? prefs.size * 6 : prefs.size) / W, p: [pointOf(e)] };
  state.strokes.push(cur);
  state.redo = [];
  drawSegment(inkCtx, cur, 0, W);
  inkCtx.globalCompositeOperation = 'source-over';
});

ink.addEventListener('pointermove', (e) => {
  if (!cur || e.pointerId !== curId) return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (events.length ? events : [e])) {
    cur.p.push(pointOf(ev));
    drawSegment(inkCtx, cur, cur.p.length - 1, W);
  }
  inkCtx.globalCompositeOperation = 'source-over';
});

function endStroke(e) {
  if (!cur || e.pointerId !== curId) return;
  cur = null; curId = null;
  changed();
}
ink.addEventListener('pointerup', endStroke);
ink.addEventListener('pointercancel', endStroke);

// Stop iOS from scrolling / magnifying while writing.
// In stylus-only mode a finger may still scroll the page past the paper.
function blockTouch(e) {
  if (!prefs.penOnly || [...e.touches].some((t) => t.touchType === 'stylus')) e.preventDefault();
}
paper.addEventListener('touchstart', blockTouch, { passive: false });
paper.addEventListener('touchmove', blockTouch, { passive: false });

// ---------- saving ----------
let saveTimer = null;
function changed() {
  state.dirty = true;
  setSaveState('Unsaved…');
  updateButtons();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 700);
}

async function save(markDone) {
  clearTimeout(saveTimer);
  const k = key(state.b, state.c, state.v);
  const prev = state.progress[k];
  const hasInk = state.strokes.some((s) => s.t === 'p');
  if (!state.dirty && !(markDone && hasInk && !(prev && prev.d))) return;
  if (!hasInk) {
    await idbDel('ink', k);
    await idbDel('progress', k);
    delete state.progress[k];
  } else {
    const rec = { d: !!(markDone || (prev && prev.d)), u: Date.now() };
    await idbPut('ink', k, { s: state.strokes, l: state.lines, r: state.lineR });
    await idbPut('progress', k, rec);
    state.progress[k] = rec;
  }
  state.dirty = false;
  setSaveState(hasInk ? 'Saved' : '');
  refreshProgress();
}

function setSaveState(t) { $('#saveState').textContent = t; }

// ---------- navigation ----------
const verseText = () => BIBLE[state.b].c[state.c][state.v];

async function go(b, c, v) {
  if (state.dirty) await save();
  Object.assign(state, { b, c, v });
  Object.assign(prefs, { b, c, v }); savePrefs();
  const token = ++state.loadToken;
  const rec = await idbGet('ink', key(b, c, v));
  if (token !== state.loadToken) return;
  state.strokes = rec ? rec.s : [];
  state.redo = [];
  state.lineR = rec ? (rec.r || LINE) : lineRatioFor(paper.clientWidth);
  state.lines = rec ? rec.l : autoLines(verseText(), state.lineR);
  state.dirty = false;
  setSaveState(rec ? 'Saved' : '');
  renderVerse();
  layoutPaper();
}

function neighbour(pos, d) {
  let { b, c, v } = pos;
  do {
    v += d;
    if (v < 0) {
      if (--c < 0) { if (--b < 0) return null; c = BIBLE[b].c.length - 1; }
      v = BIBLE[b].c[c].length - 1;
    } else if (v >= BIBLE[b].c[c].length) {
      v = 0;
      if (++c >= BIBLE[b].c.length) { c = 0; if (++b >= BIBLE.length) return null; }
    }
  } while (omitted(b, c, v));
  return { b, c, v };
}

function step(d) {
  const n = neighbour(state, d);
  if (n) go(n.b, n.c, n.v);
}

function fillBookSelect(sel) {
  sel.innerHTML = '';
  [['Old Testament', 0, OT_BOOKS], ['New Testament', OT_BOOKS, BIBLE.length]].forEach(([label, from, to]) => {
    const g = document.createElement('optgroup');
    g.label = label;
    for (let i = from; i < to; i++) g.append(new Option(BIBLE[i].n, i));
    sel.append(g);
  });
}
function fillNumSelect(sel, n, prefix, isOmitted) {
  sel.innerHTML = '';
  for (let i = 0; i < n; i++) {
    sel.append(new Option(`${prefix} ${i + 1}${isOmitted && isOmitted(i) ? ' (not in BSB)' : ''}`, i));
  }
}

function renderVerse() {
  const { b, c, v } = state;
  $('#bookSel').value = b;
  fillNumSelect($('#chapSel'), BIBLE[b].c.length, 'Chapter');
  $('#chapSel').value = c;
  fillNumSelect($('#verseSel'), BIBLE[b].c[c].length, 'Verse', (i) => omitted(b, c, i));
  $('#verseSel').value = v;
  $('#refText').textContent = refOf(b, c, v);
  $('#verseText').textContent = verseText() || OMITTED_NOTE;
  $('#verseText').classList.toggle('omitted', omitted(b, c, v));
  const p = state.progress[key(b, c, v)];
  $('#doneBadge').hidden = !(p && p.d);
  $('#prevBtn').disabled = !neighbour(state, -1);
  $('#nextBtn').disabled = !neighbour(state, 1);
  updateButtons();
}

function updateButtons() {
  $('#undoBtn').disabled = !state.strokes.length;
  $('#redoBtn').disabled = !state.redo.length;
  $('#clearBtn').disabled = !state.strokes.length;
  $('#lessLine').disabled = state.lines <= 2;
}

// ---------- toolbar ----------
function setTool(t) {
  state.tool = t;
  document.querySelectorAll('.tool').forEach((el) => el.classList.toggle('active', el.dataset.tool === t));
}
document.querySelectorAll('.tool').forEach((el) => el.addEventListener('click', () => setTool(el.dataset.tool)));

for (const [color, name] of INKS) {
  const btn = document.createElement('button');
  btn.className = 'swatch';
  btn.style.background = color;
  btn.title = name;
  btn.setAttribute('aria-label', name + ' ink');
  btn.addEventListener('click', () => {
    prefs.color = color; savePrefs(); setTool('pen'); renderSwatches();
  });
  $('#colors').append(btn);
}
function renderSwatches() {
  [...$('#colors').children].forEach((el, i) => el.classList.toggle('active', INKS[i][0] === prefs.color));
}

$('#sizeIn').value = prefs.size;
$('#sizeIn').addEventListener('input', (e) => { prefs.size = +e.target.value; savePrefs(); });

$('#traceIn').checked = prefs.trace;
$('#traceIn').addEventListener('change', (e) => { prefs.trace = e.target.checked; savePrefs(); drawPaper(); });

function undo() {
  if (!state.strokes.length) return;
  state.redo.push(state.strokes.pop()); redrawInk(); changed();
}
function redo() {
  if (!state.redo.length) return;
  state.strokes.push(state.redo.pop()); redrawInk(); changed();
}
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
$('#clearBtn').addEventListener('click', () => {
  if (!confirm('Clear everything written for this verse?')) return;
  state.redo = state.strokes.reverse();
  state.strokes = [];
  redrawInk(); changed();
});
$('#moreLine').addEventListener('click', () => { state.lines++; layoutPaper(); changed(); });
$('#lessLine').addEventListener('click', () => { if (state.lines > 2) { state.lines--; layoutPaper(); changed(); } });

$('#prevBtn').addEventListener('click', () => step(-1));
$('#nextBtn').addEventListener('click', () => step(1));
$('#finishBtn').addEventListener('click', async () => {
  if (!state.strokes.some((s) => s.t === 'p')) {
    if (!confirm('Nothing written yet. Skip to the next verse?')) return;
  } else {
    await save(true);
  }
  step(1);
});

$('#bookSel').addEventListener('change', (e) => go(+e.target.value, 0, 0));
$('#chapSel').addEventListener('change', (e) => go(state.b, +e.target.value, 0));
$('#verseSel').addEventListener('change', (e) => go(state.b, state.c, +e.target.value));

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea') || $('#view-write').hidden) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (!mod && e.key === 'p') setTool('pen');
  else if (!mod && e.key === 'e') setTool('eraser');
  else if (!mod && e.key === 'ArrowRight') step(1);
  else if (!mod && e.key === 'ArrowLeft') step(-1);
});

// ---------- views ----------
function show(view) {
  document.querySelectorAll('.tab[data-view]').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  for (const v of ['write', 'progress', 'pages']) $('#view-' + v).hidden = v !== view;
  if (view === 'progress') renderProgress();
  if (view === 'pages') { $('#pBookSel').value = state.b; fillPagesChapters(state.c); renderPages(); }
  if (view === 'write') layoutPaper();
}
document.querySelectorAll('.tab[data-view]').forEach((t) => t.addEventListener('click', async () => {
  if (state.dirty) await save();
  show(t.dataset.view);
}));

// ---------- progress ----------
function counts() {
  const books = BIBLE.map((b) => ({ done: 0, chapters: b.c.map(() => 0) }));
  let total = 0, today = 0;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (const [k, p] of Object.entries(state.progress)) {
    if (!p.d) continue;
    const [b, c] = k.split('.').map(Number);
    books[b].done++; books[b].chapters[c]++; total++;
    if (p.u >= start.getTime()) today++;
  }
  return { books, total, today };
}

function refreshProgress() {
  const { total } = counts();
  $('#overallFill').style.width = (total / TOTAL * 100) + '%';
  $('#overallText').textContent = `${fmt(total)} of ${fmt(TOTAL)} verses written`;
  const p = state.progress[key(state.b, state.c, state.v)];
  $('#doneBadge').hidden = !(p && p.d);
  if (!$('#view-progress').hidden) renderProgress();
}

let openBook = null;
function renderProgress() {
  const { books, total, today } = counts();
  const booksDone = books.filter((x, i) => x.done === versesIn(BIBLE[i])).length;
  $('#stats').innerHTML = '';
  for (const [n, label] of [[fmt(total), 'verses written'], [fmt(today), 'today'],
    [(total / TOTAL * 100).toFixed(2) + '%', 'of the Bible'], [booksDone, 'books complete']]) {
    const d = document.createElement('div');
    d.className = 'stat';
    d.innerHTML = `<b>${n}</b><span>${label}</span>`;
    $('#stats').append(d);
  }
  for (const [el, from, to] of [[$('#otBooks'), 0, OT_BOOKS], [$('#ntBooks'), OT_BOOKS, BIBLE.length]]) {
    el.innerHTML = '';
    for (let i = from; i < to; i++) el.append(bookCard(i, books[i]));
  }
}

function bookCard(i, info) {
  const book = BIBLE[i];
  const verses = versesIn(book);
  const card = document.createElement('div');
  card.className = 'book' + (openBook === i ? ' open' : '');
  const head = document.createElement('button');
  head.className = 'book-head';
  head.innerHTML = `<div class="name"><span>${book.n}</span><small>${fmt(info.done)} / ${fmt(verses)}</small></div>
    <div class="bar"><span style="width:${info.done / verses * 100}%"></span></div>`;
  head.addEventListener('click', () => { openBook = openBook === i ? null : i; renderProgress(); });
  card.append(head);
  if (openBook === i) {
    const grid = document.createElement('div');
    grid.className = 'chapters';
    book.c.forEach((ch, c) => {
      const f = info.chapters[c] / countIn(ch);
      const btn = document.createElement('button');
      btn.className = 'chap' + (f === 1 ? ' full' : '');
      btn.style.setProperty('--f', f);
      btn.textContent = c + 1;
      btn.title = `Chapter ${c + 1}: ${info.chapters[c]} of ${countIn(ch)} verses`;
      btn.addEventListener('click', () => {
        let v = ch.findIndex((t, vi) => t && !(state.progress[key(i, c, vi)] || {}).d);
        if (v < 0) v = 0;
        show('write');
        go(i, c, v);
      });
      grid.append(btn);
    });
    card.append(grid);
  }
  return card;
}

// ---------- my pages ----------
function fillPagesChapters(c) {
  fillNumSelect($('#pChapSel'), BIBLE[+$('#pBookSel').value].c.length, 'Chapter');
  $('#pChapSel').value = c;
}
$('#pBookSel').addEventListener('change', () => { fillPagesChapters(0); renderPages(); });
$('#pChapSel').addEventListener('change', renderPages);
$('#showMissing').addEventListener('change', renderPages);
$('#printBtn').addEventListener('click', () => window.print());

let pagesToken = 0;
async function renderPages() {
  const b = +$('#pBookSel').value, c = +$('#pChapSel').value;
  const token = ++pagesToken;
  const out = $('#pageOut');
  const recs = await Promise.all(BIBLE[b].c[c].map((_, v) => idbGet('ink', key(b, c, v))));
  if (token !== pagesToken) return;
  out.innerHTML = '';
  const h = document.createElement('h2');
  h.textContent = `${BIBLE[b].n} ${c + 1}`;
  out.append(h);
  const w = Math.max(320, Math.min(out.clientWidth - 80, 820));
  const dpr = Math.max(2, window.devicePixelRatio || 1); // crisp when printed
  let written = 0;
  recs.forEach((rec, v) => {
    if (omitted(b, c, v) || (!rec && !$('#showMissing').checked)) return;
    const row = document.createElement('div');
    row.className = 'pverse';
    row.innerHTML = `<span class="num">${v + 1}</span><div></div>`;
    if (rec) {
      written++;
      const r = rec.r || LINE;
      const ph = paperHeight(w, rec.l, r);
      const cv = document.createElement('canvas');
      cv.width = w * dpr; cv.height = ph * dpr;
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      // Ink first on a transparent layer so eraser strokes don't punch through the paper.
      drawStrokes(ctx, rec.s, w);
      ctx.globalCompositeOperation = 'destination-over';
      drawRules(ctx, w, ph, rec.l, r);
      ctx.globalCompositeOperation = 'source-over';
      row.lastChild.append(cv);
    } else {
      const p = document.createElement('p');
      p.className = 'missing';
      p.textContent = BIBLE[b].c[c][v];
      row.lastChild.append(p);
    }
    out.append(row);
  });
  if (!written && !$('#showMissing').checked) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Nothing written in this chapter yet.';
    out.append(p);
  }
}

// ---------- settings & backup ----------
$('#settingsBtn').addEventListener('click', () => { $('#backupMsg').textContent = ''; $('#settings').showModal(); });
$('#penOnlyIn').checked = prefs.penOnly;
$('#penOnlyIn').addEventListener('change', (e) => { prefs.penOnly = e.target.checked; savePrefs(); });

$('#exportBtn').addEventListener('click', async () => {
  if (state.dirty) await save();
  const data = { app: 'living-letters-bible', version: 1, exported: new Date().toISOString(),
    ink: await idbAll('ink'), progress: await idbAll('progress') };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = `living-letters-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('#backupMsg').textContent = `Backed up ${fmt(Object.keys(data.ink).length)} verses.`;
});

$('#importIn').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'living-letters-bible') throw new Error('Not a Living Letters backup');
    const keys = Object.keys(data.ink || {});
    if (!confirm(`Restore ${fmt(keys.length)} verses? Verses in the backup replace the same verses on this device.`)) return;
    await idb('ink', 'readwrite', (s) => { for (const k of keys) s.put(data.ink[k], k); });
    await idb('progress', 'readwrite', (s) => { for (const [k, v] of Object.entries(data.progress || {})) s.put(v, k); });
    state.progress = await idbAll('progress');
    refreshProgress();
    state.dirty = false;
    await go(state.b, state.c, state.v);
    $('#backupMsg').textContent = `Restored ${fmt(keys.length)} verses.`;
  } catch (err) {
    $('#backupMsg').textContent = 'Could not restore: ' + err.message;
  }
});

// ---------- start ----------
window.addEventListener('pagehide', () => { if (state.dirty) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.dirty) save(); });

(async function init() {
  fillBookSelect($('#bookSel'));
  fillBookSelect($('#pBookSel'));
  renderSwatches();
  try {
    DB = await openDB();
  } catch (err) {
    alert('This browser blocked local storage, so handwriting cannot be saved: ' + err.message);
    return;
  }
  state.progress = await idbAll('progress');
  refreshProgress();
  try { await document.fonts.load(`20px ${TRACE_FONT}`); } catch { /* fallback font */ }
  const b = Math.min(prefs.b, BIBLE.length - 1);
  const c = Math.min(prefs.c, BIBLE[b].c.length - 1);
  const v = Math.min(prefs.v, BIBLE[b].c[c].length - 1);
  await go(b, c, v);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
