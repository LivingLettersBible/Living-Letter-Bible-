(function () {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);

  // ---------- Storage (fails soft in private mode / blocked storage) ----------

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    del(key) {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };

  const CUSTOM_KEY = 'lc.custom';
  const progressKey = (id) => 'lc.p.' + id;

  let customs = store.get(CUSTOM_KEY, []);
  const allPictures = () => [...customs, ...window.PICTURES];
  const findPicture = (id) => allPictures().find((p) => p.id === id);
  const loadOrder = (pic) => {
    const order = store.get(progressKey(pic.id), []);
    return Array.isArray(order) ? order.filter((i) => i >= 0 && i < pic.cells.length) : [];
  };

  // ---------- Colour helpers ----------

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = (r, g, b) => '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  const luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  const inkFor = (hex) => (luminance(hex) > 0.6 ? '#2b2622' : '#ffffff');
  const isDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Unpainted cells show as a gray whose lightness hints at the final colour.
  const emptyShade = (hex) => {
    const l = luminance(hex);
    const g = isDark() ? Math.round(48 + l * 50) : Math.round(178 + l * 70);
    return rgbToHex(g, g, g);
  };

  // ---------- Rendering a picture into a small canvas ----------

  function drawPixels(canvas, pic, painted) {
    canvas.width = pic.w;
    canvas.height = pic.h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(pic.w, pic.h);
    const full = pic.palette.map(hexToRgb);
    const empty = pic.palette.map((c) => hexToRgb(emptyShade(c)));
    for (let i = 0; i < pic.cells.length; i++) {
      const rgb = !painted || painted[i] ? full[pic.cells[i]] : empty[pic.cells[i]];
      img.data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintedMask(pic, order) {
    const mask = new Uint8Array(pic.cells.length);
    order.forEach((i) => (mask[i] = 1));
    return mask;
  }

  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // ---------- Gallery ----------

  const CATEGORIES = ['All', 'Faith', 'Nature', 'Animals', 'Love', 'My Photos'];
  let activeTab = store.get('lc.tab', 'All');
  if (!CATEGORIES.includes(activeTab)) activeTab = 'All';

  function renderTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    tabs.setAttribute('role', 'tablist');
    CATEGORIES.forEach((name) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.textContent = name;
      b.setAttribute('aria-selected', String(name === activeTab));
      b.onclick = () => {
        activeTab = name;
        store.set('lc.tab', name);
        renderTabs();
        renderGrid();
      };
      tabs.appendChild(b);
    });
  }

  function renderDaily() {
    const pics = window.PICTURES;
    const day = Math.floor(Date.now() / 86400000);
    const pic = pics[day % pics.length];
    const order = loadOrder(pic);
    const pct = Math.round((order.length / pic.cells.length) * 100);
    const el = $('#daily');
    el.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'daily';
    const cv = document.createElement('canvas');
    drawPixels(cv, pic, null);
    const text = document.createElement('div');
    text.innerHTML = '<small>Picture of the day</small><h2></h2><span class="btn"></span>';
    text.querySelector('h2').textContent = pic.title;
    text.querySelector('.btn').textContent = pct === 100 ? 'Completed ✓' : pct > 0 ? `Continue · ${pct}%` : 'Start coloring';
    btn.append(cv, text);
    btn.onclick = () => go(pic.id);
    el.appendChild(btn);
  }

  function renderGrid() {
    const grid = $('#grid');
    grid.innerHTML = '';
    const list = allPictures().filter((p) =>
      activeTab === 'All' ? true : activeTab === 'My Photos' ? p.custom : p.category === activeTab
    );
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = activeTab === 'My Photos'
        ? 'No photos yet. Tap <strong>+ Photo</strong> to turn one of your pictures into a coloring page.'
        : 'Nothing here yet.';
      grid.appendChild(empty);
      return;
    }
    list.forEach((pic) => {
      const order = loadOrder(pic);
      const pct = Math.floor((order.length / pic.cells.length) * 100);
      const done = order.length === pic.cells.length;
      const card = document.createElement('div');
      card.className = 'card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${pic.title}, ${done ? 'completed' : pct + '% colored'}`);
      const cv = document.createElement('canvas');
      drawPixels(cv, pic, paintedMask(pic, order));
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = '<strong></strong><span></span>';
      meta.firstChild.textContent = pic.title;
      meta.lastChild.textContent = done ? 'Done' : pct ? pct + '%' : `${pic.palette.length} colors`;
      card.append(cv, meta);
      if (done) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.innerHTML = ICON_CHECK;
        card.appendChild(badge);
      }
      if (pic.custom) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'del';
        del.setAttribute('aria-label', `Delete ${pic.title}`);
        del.innerHTML = ICON_X;
        del.onclick = (e) => {
          e.stopPropagation();
          if (!confirm(`Delete "${pic.title}"?`)) return;
          customs = customs.filter((c) => c.id !== pic.id);
          store.set(CUSTOM_KEY, customs);
          store.del(progressKey(pic.id));
          renderGrid();
        };
        card.appendChild(del);
      }
      card.onclick = () => go(pic.id);
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go(pic.id);
        }
      };
      grid.appendChild(card);
    });
  }

  function showGallery() {
    closeEditor();
    $('#editor').hidden = true;
    $('#gallery').hidden = false;
    renderDaily();
    renderTabs();
    renderGrid();
  }

  // ---------- Routing ----------

  function go(id) {
    location.hash = id ? '#/paint/' + encodeURIComponent(id) : '';
  }

  function route() {
    const m = location.hash.match(/^#\/paint\/(.+)$/);
    const pic = m && findPicture(decodeURIComponent(m[1]));
    if (pic) openEditor(pic);
    else showGallery();
  }

  // ---------- Editor ----------

  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');
  const stage = $('#stage');
  let ed = null;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let rafId = 0;
  let saveTimer = 0;

  function openEditor(pic) {
    closeEditor();
    const order = loadOrder(pic);
    const painted = paintedMask(pic, order);
    const remaining = pic.palette.map(() => 0);
    pic.cells.forEach((c, i) => {
      if (!painted[i]) remaining[c]++;
    });
    ed = {
      pic,
      order,
      painted,
      remaining,
      selected: Math.max(0, remaining.findIndex((n) => n > 0)),
      scale: 1,
      ox: 0,
      oy: 0,
      minScale: 1,
      maxScale: 64,
      panMode: false,
      flash: null,
      finished: order.length === pic.cells.length,
    };
    refreshShades();
    $('#gallery').hidden = true;
    $('#editor').hidden = false;
    $('#edTitle').textContent = pic.title;
    setPanMode(false);
    renderPalette();
    updateProgress();
    resize();
    fit();
  }

  function closeEditor() {
    if (!ed) return;
    flushSave();
    closeMenu();
    ed = null;
  }

  function refreshShades() {
    if (!ed) return;
    const pal = ed.pic.palette;
    ed.shade = pal.map(emptyShade);
    ed.highlight = isDark() ? '#8c8378' : '#a39a8f';
    const css = getComputedStyle(document.documentElement);
    ed.stageColor = css.getPropertyValue('--stage').trim();
    ed.lineColor = css.getPropertyValue('--grid-line').trim();
    ed.numColor = isDark() ? '#b3aaa0' : '#5f574f';
    ed.numStrong = isDark() ? '#1a1816' : '#ffffff';
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    requestDraw();
  }

  function fit() {
    if (!ed) return;
    const s = Math.min(W / ed.pic.w, H / ed.pic.h) * 0.92;
    ed.minScale = s * 0.8;
    ed.maxScale = Math.max(56, s * 2);
    ed.scale = s;
    ed.ox = (W - ed.pic.w * s) / 2;
    ed.oy = (H - ed.pic.h * s) / 2;
    requestDraw();
  }

  function clampView() {
    const gw = ed.pic.w * ed.scale;
    const gh = ed.pic.h * ed.scale;
    ed.ox = Math.min(W * 0.5, Math.max(W * 0.5 - gw, ed.ox));
    ed.oy = Math.min(H * 0.5, Math.max(H * 0.5 - gh, ed.oy));
  }

  function zoomAt(x, y, factor) {
    const ns = Math.min(ed.maxScale, Math.max(ed.minScale, ed.scale * factor));
    const k = ns / ed.scale;
    ed.ox = x - (x - ed.ox) * k;
    ed.oy = y - (y - ed.oy) * k;
    ed.scale = ns;
    clampView();
    requestDraw();
  }

  function requestDraw() {
    if (!rafId) rafId = requestAnimationFrame(draw);
  }

  function draw(now) {
    rafId = 0;
    if (!ed) return;
    const { pic, painted, scale: s, ox, oy, selected } = ed;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = ed.stageColor;
    ctx.fillRect(0, 0, W, H);

    const x0 = Math.max(0, Math.floor(-ox / s));
    const y0 = Math.max(0, Math.floor(-oy / s));
    const x1 = Math.min(pic.w, Math.ceil((W - ox) / s));
    const y1 = Math.min(pic.h, Math.ceil((H - oy) / s));
    const gridded = s >= 9;
    const gap = gridded ? 1 : 0;

    if (gridded) {
      ctx.fillStyle = ed.lineColor;
      ctx.fillRect(Math.floor(ox + x0 * s), Math.floor(oy + y0 * s), Math.ceil((x1 - x0) * s), Math.ceil((y1 - y0) * s));
    }

    for (let y = y0; y < y1; y++) {
      const ry = Math.floor(oy + y * s);
      const rh = Math.floor(oy + (y + 1) * s) - ry;
      for (let x = x0; x < x1; x++) {
        const i = y * pic.w + x;
        const c = pic.cells[i];
        const rx = Math.floor(ox + x * s);
        const rw = Math.floor(ox + (x + 1) * s) - rx;
        if (painted[i]) {
          ctx.fillStyle = pic.palette[c];
          ctx.fillRect(rx, ry, rw, rh);
        } else {
          ctx.fillStyle = c === selected ? ed.highlight : ed.shade[c];
          ctx.fillRect(rx, ry, rw - gap, rh - gap);
        }
      }
    }

    if (s >= 13) {
      ctx.font = `600 ${Math.floor(s * (s > 24 ? 0.4 : 0.46))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * pic.w + x;
          if (painted[i]) continue;
          const c = pic.cells[i];
          ctx.fillStyle = c === selected ? ed.numStrong : ed.numColor;
          ctx.fillText(String(c + 1), ox + (x + 0.5) * s, oy + (y + 0.54) * s);
        }
      }
    }

    if (ed.flash) {
      const t = (now || performance.now()) - ed.flash.start;
      if (t > 1400) {
        ed.flash = null;
      } else {
        const fx = ed.flash.i % pic.w;
        const fy = Math.floor(ed.flash.i / pic.w);
        const pulse = 0.5 + 0.5 * Math.sin(t / 90);
        ctx.strokeStyle = `rgba(255, 122, 89, ${0.4 + 0.6 * pulse})`;
        ctx.lineWidth = 3;
        const pad = 3 + pulse * 4;
        ctx.strokeRect(ox + fx * s - pad, oy + fy * s - pad, s + pad * 2, s + pad * 2);
        requestDraw();
      }
    }
  }

  // ---------- Palette & progress ----------

  function renderPalette() {
    const pal = $('#palette');
    pal.innerHTML = '';
    const totals = ed.pic.palette.map(() => 0);
    ed.pic.cells.forEach((c) => totals[c]++);
    ed.totals = totals;
    ed.pic.palette.forEach((color, c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('role', 'option');
      b.style.setProperty('--c', color);
      b.style.setProperty('--ink', inkFor(color));
      b.innerHTML = `<span>${c + 1}</span>`;
      b.onclick = () => select(c);
      pal.appendChild(b);
      updateSwatch(c);
    });
    updateSelection();
  }

  function updateSwatch(c) {
    const b = $('#palette').children[c];
    if (!b) return;
    const done = ed.remaining[c] === 0;
    b.style.setProperty('--p', ((1 - ed.remaining[c] / ed.totals[c]) * 100).toFixed(1));
    b.classList.toggle('done', done);
    b.setAttribute('aria-label', `Color ${c + 1}${done ? ', complete' : `, ${ed.remaining[c]} left`}`);
  }

  function updateSelection() {
    [...$('#palette').children].forEach((b, c) => b.setAttribute('aria-selected', String(c === ed.selected)));
    const b = $('#palette').children[ed.selected];
    if (b) b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  function select(c) {
    ed.selected = c;
    updateSelection();
    requestDraw();
  }

  function updateProgress() {
    const pct = Math.floor((ed.order.length / ed.pic.cells.length) * 100);
    $('#edPct').textContent = pct + '%';
    $('#edMeter').style.width = pct + '%';
  }

  // ---------- Painting ----------

  function cellAt(x, y) {
    const cx = Math.floor((x - ed.ox) / ed.scale);
    const cy = Math.floor((y - ed.oy) / ed.scale);
    if (cx < 0 || cy < 0 || cx >= ed.pic.w || cy >= ed.pic.h) return -1;
    return cy * ed.pic.w + cx;
  }

  function paintCell(i, fromTap) {
    if (i < 0 || ed.painted[i]) return;
    const c = ed.pic.cells[i];
    if (c !== ed.selected) {
      if (fromTap) toast(ed.remaining[c] ? `That's color ${c + 1}` : '');
      return;
    }
    ed.painted[i] = 1;
    ed.order.push(i);
    ed.remaining[c]--;
    updateSwatch(c);
    updateProgress();
    scheduleSave();
    requestDraw();
    if (ed.remaining[c] === 0) colorDone(c);
  }

  function paintSegment(ax, ay, bx, by) {
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(dist / (ed.scale * 0.4)));
    for (let k = 1; k <= steps; k++) {
      paintCell(cellAt(ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps));
    }
  }

  function colorDone(c) {
    if (ed.order.length === ed.pic.cells.length) {
      ed.finished = true;
      flushSave();
      setTimeout(() => ed && finish(), 350);
      return;
    }
    const n = ed.pic.palette.length;
    for (let k = 1; k < n; k++) {
      const next = (c + k) % n;
      if (ed.remaining[next] > 0) {
        setTimeout(() => ed && ed.selected === c && select(next), 250);
        break;
      }
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
  }

  function flushSave() {
    clearTimeout(saveTimer);
    if (ed) store.set(progressKey(ed.pic.id), ed.order);
  }

  // ---------- Hint ----------

  function hint() {
    let i = -1;
    for (let k = 0; k < ed.pic.cells.length; k++) {
      if (!ed.painted[k] && ed.pic.cells[k] === ed.selected) {
        i = k;
        break;
      }
    }
    if (i < 0) i = ed.painted.indexOf(0);
    if (i < 0) return;
    if (ed.pic.cells[i] !== ed.selected) select(ed.pic.cells[i]);
    const target = Math.min(ed.maxScale, Math.max(ed.scale, 30));
    const cx = (i % ed.pic.w) + 0.5;
    const cy = Math.floor(i / ed.pic.w) + 0.5;
    animateView(target, W / 2 - cx * target, H / 2 - cy * target);
    ed.flash = { i, start: performance.now() + 300 };
  }

  function animateView(scale, ox, oy) {
    const from = { scale: ed.scale, ox: ed.ox, oy: ed.oy };
    const start = performance.now();
    const cur = ed;
    const step = (now) => {
      if (ed !== cur) return;
      const t = Math.min(1, (now - start) / 320);
      const e = 1 - (1 - t) ** 3;
      ed.scale = from.scale + (scale - from.scale) * e;
      ed.ox = from.ox + (ox - from.ox) * e;
      ed.oy = from.oy + (oy - from.oy) * e;
      requestDraw();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- Pointer input: paint, pan, pinch-zoom ----------

  const pointers = new Map();
  let gesture = null;
  let spaceDown = false;

  const localPoint = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function pinchState() {
    const [a, b] = [...pointers.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!ed) return;
    canvas.setPointerCapture(e.pointerId);
    const p = localPoint(e);
    pointers.set(e.pointerId, p);
    closeMenu();

    if (pointers.size === 2) {
      gesture = { type: 'pinch', ...pinchState() };
      return;
    }
    if (pointers.size > 2) return;

    const pan = ed.panMode || spaceDown || e.button === 1 || e.button === 2;
    if (pan) {
      gesture = { type: 'pan', x: p.x, y: p.y };
    } else {
      // Touch waits a beat so the first finger of a pinch doesn't paint.
      gesture = { type: 'paint', x: p.x, y: p.y, pending: e.pointerType === 'touch' };
      if (!gesture.pending) paintCell(cellAt(p.x, p.y), true);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!ed || !pointers.has(e.pointerId)) return;
    const p = localPoint(e);
    pointers.set(e.pointerId, p);
    if (!gesture) return;

    if (gesture.type === 'pinch' && pointers.size === 2) {
      const now = pinchState();
      ed.ox += now.cx - gesture.cx;
      ed.oy += now.cy - gesture.cy;
      zoomAt(now.cx, now.cy, now.dist / gesture.dist);
      Object.assign(gesture, now);
    } else if (gesture.type === 'pan') {
      ed.ox += p.x - gesture.x;
      ed.oy += p.y - gesture.y;
      gesture.x = p.x;
      gesture.y = p.y;
      clampView();
      requestDraw();
    } else if (gesture.type === 'paint') {
      if (gesture.pending) {
        if (Math.hypot(p.x - gesture.x, p.y - gesture.y) < 4) return;
        gesture.pending = false;
        paintCell(cellAt(gesture.x, gesture.y), true);
      }
      paintSegment(gesture.x, gesture.y, p.x, p.y);
      gesture.x = p.x;
      gesture.y = p.y;
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture && gesture.type === 'paint' && gesture.pending && e.type === 'pointerup') {
      paintCell(cellAt(gesture.x, gesture.y), true);
    }
    // After a pinch, the remaining finger does nothing until lifted.
    gesture = pointers.size && gesture && gesture.type === 'pinch' ? { type: 'idle' } : pointers.size ? gesture : null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!ed) return;
      e.preventDefault();
      const p = localPoint(e);
      if (e.ctrlKey || !e.shiftKey) {
        const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
        zoomAt(p.x, p.y, Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018)));
      } else {
        ed.ox -= e.deltaY;
        clampView();
        requestDraw();
      }
    },
    { passive: false }
  );

  window.addEventListener('keydown', (e) => {
    if (!ed || $('#editor').hidden || e.target.closest('input, dialog[open]')) return;
    if (e.code === 'Space') {
      spaceDown = true;
      stage.classList.add('panning');
      e.preventDefault();
    } else if (e.key === '+' || e.key === '=') zoomAt(W / 2, H / 2, 1.25);
    else if (e.key === '-') zoomAt(W / 2, H / 2, 0.8);
    else if (e.key === '0') fit();
    else if (e.key === 'h' || e.key === 'H') hint();
    else if (e.key === 'ArrowRight') select((ed.selected + 1) % ed.pic.palette.length);
    else if (e.key === 'ArrowLeft') select((ed.selected - 1 + ed.pic.palette.length) % ed.pic.palette.length);
    else if (e.key === 'Escape') go('');
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceDown = false;
      if (ed && !ed.panMode) stage.classList.remove('panning');
    }
  });

  function setPanMode(on) {
    if (ed) ed.panMode = on;
    $('#panBtn').setAttribute('aria-pressed', String(on));
    stage.classList.toggle('panning', on);
  }

  // ---------- Toast ----------

  let toastTimer = 0;
  function toast(msg) {
    if (!msg) return;
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
  }

  // ---------- Menu ----------

  function closeMenu() {
    $('#menu').hidden = true;
    $('#moreBtn').setAttribute('aria-expanded', 'false');
  }

  $('#moreBtn').onclick = (e) => {
    e.stopPropagation();
    const menu = $('#menu');
    menu.hidden = !menu.hidden;
    $('#moreBtn').setAttribute('aria-expanded', String(!menu.hidden));
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.more')) closeMenu();
  });

  $('#menu').onclick = (e) => {
    const act = e.target.dataset.act;
    if (!act || !ed) return;
    closeMenu();
    if (act === 'replay') openDone(false);
    if (act === 'download') downloadPng(ed.pic, ed.order);
    if (act === 'restart' && confirm('Clear all color from this picture and start over?')) {
      store.del(progressKey(ed.pic.id));
      openEditor(ed.pic);
    }
  };

  $('#backBtn').onclick = () => go('');
  $('#hintBtn').onclick = () => ed && hint();
  $('#fitBtn').onclick = () => ed && fit();
  $('#panBtn').onclick = () => ed && setPanMode(!ed.panMode);

  // ---------- Finished: replay, download, confetti ----------

  let replayTimer = 0;

  function finish() {
    confetti();
    openDone(true);
  }

  function openDone(celebrate) {
    const dlg = $('#doneDlg');
    $('#doneTitle').textContent = celebrate ? 'Beautiful!' : ed.pic.title;
    dlg.querySelector('.muted').textContent = celebrate
      ? `You finished “${ed.pic.title}”.`
      : 'Watch your picture come to life.';
    if (!dlg.open) dlg.showModal();
    replay();
  }

  function replay() {
    const pic = ed.pic;
    const order = ed.order.slice();
    const cv = $('#replayCanvas');
    cancelAnimationFrame(replayTimer);
    const mask = new Uint8Array(pic.cells.length);
    const cx = cv.getContext('2d');
    drawPixels(cv, pic, mask);
    const img = cx.getImageData(0, 0, pic.w, pic.h);
    const colors = pic.palette.map(hexToRgb);
    const duration = 2600;
    const start = performance.now();
    let shown = 0;
    const step = (now) => {
      const target = Math.min(order.length, Math.ceil(((now - start) / duration) * order.length));
      for (; shown < target; shown++) {
        const i = order[shown];
        img.data.set(colors[pic.cells[i]], i * 4);
      }
      cx.putImageData(img, 0, 0);
      if (shown < order.length) replayTimer = requestAnimationFrame(step);
    };
    replayTimer = requestAnimationFrame(step);
  }

  $('#doneDlg').addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (act === 'replay') replay();
    if (act === 'download' && ed) downloadPng(ed.pic, ed.order);
    if (act === 'gallery') {
      $('#doneDlg').close();
      go('');
    }
  });
  $('#doneDlg').addEventListener('close', () => cancelAnimationFrame(replayTimer));

  function downloadPng(pic, order) {
    const cell = Math.max(8, Math.floor(1024 / Math.max(pic.w, pic.h)));
    const small = document.createElement('canvas');
    drawPixels(small, pic, paintedMask(pic, order));
    const big = document.createElement('canvas');
    big.width = pic.w * cell;
    big.height = pic.h * cell;
    const bx = big.getContext('2d');
    bx.imageSmoothingEnabled = false;
    bx.drawImage(small, 0, 0, big.width, big.height);
    big.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = pic.title.replace(/[^\w-]+/g, '-').toLowerCase() + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = $('#confetti');
    const colors = ed ? ed.pic.palette : ['#ff7a59'];
    for (let k = 0; k < 90; k++) {
      const i = document.createElement('i');
      i.style.left = Math.random() * 100 + 'vw';
      i.style.background = colors[k % colors.length];
      i.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px');
      i.style.setProperty('--rot', Math.random() * 900 + 'deg');
      i.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
      i.style.animationDelay = Math.random() * 0.4 + 's';
      box.appendChild(i);
    }
    setTimeout(() => (box.innerHTML = ''), 4200);
  }

  // ---------- Import a photo ----------

  let importImage = null;
  let importResult = null;

  function quantize(img, size, k) {
    const aspect = img.naturalWidth / img.naturalHeight;
    const w = Math.max(8, aspect >= 1 ? size : Math.round(size * aspect));
    const h = Math.max(8, aspect >= 1 ? Math.round(size / aspect) : size);

    // Downscale in two steps for smoother averaging.
    const mid = document.createElement('canvas');
    mid.width = w * 4;
    mid.height = h * 4;
    const mx = mid.getContext('2d');
    mx.fillStyle = '#ffffff';
    mx.fillRect(0, 0, mid.width, mid.height);
    mx.imageSmoothingQuality = 'high';
    mx.drawImage(img, 0, 0, mid.width, mid.height);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ox = out.getContext('2d');
    ox.imageSmoothingQuality = 'high';
    ox.drawImage(mid, 0, 0, w, h);
    const data = ox.getImageData(0, 0, w, h).data;

    const n = w * h;
    const px = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      px[i * 3] = data[i * 4];
      px[i * 3 + 1] = data[i * 4 + 1];
      px[i * 3 + 2] = data[i * 4 + 2];
    }

    // k-means, seeded from luminance quantiles so results are deterministic.
    const lum = (i) => 0.299 * px[i * 3] + 0.587 * px[i * 3 + 1] + 0.114 * px[i * 3 + 2];
    const sorted = [...Array(n).keys()].sort((a, b) => lum(a) - lum(b));
    let centers = [];
    for (let c = 0; c < k; c++) {
      const i = sorted[Math.floor(((c + 0.5) / k) * n)];
      centers.push([px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]);
    }
    const assign = new Uint8Array(n);
    for (let iter = 0; iter < 14; iter++) {
      const sums = centers.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < n; i++) {
        let best = 0;
        let bestD = Infinity;
        for (let c = 0; c < centers.length; c++) {
          const dr = px[i * 3] - centers[c][0];
          const dg = px[i * 3 + 1] - centers[c][1];
          const db = px[i * 3 + 2] - centers[c][2];
          const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        assign[i] = best;
        const s = sums[best];
        s[0] += px[i * 3];
        s[1] += px[i * 3 + 1];
        s[2] += px[i * 3 + 2];
        s[3]++;
      }
      centers = centers.map((c, j) => (sums[j][3] ? [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3]] : c));
    }

    // Drop empty clusters, merge identical colours, order light → dark.
    const hexes = centers.map((c) => rgbToHex(...c.map((v) => Math.round(Math.min(255, Math.max(0, v))))));
    const used = [...new Set(assign)];
    const uniq = [...new Set(used.map((c) => hexes[c]))].sort((a, b) => luminance(b) - luminance(a));
    const index = new Map(uniq.map((hx, i) => [hx, i]));
    const cells = Array.from(assign, (c) => index.get(hexes[c]));
    return { w, h, palette: uniq, cells };
  }

  function updateImportPreview() {
    const size = +$('#detail').value;
    const k = +$('#colors').value;
    $('#detailOut').textContent = size;
    $('#colorsOut').textContent = k;
    if (!importImage) return;
    importResult = quantize(importImage, size, k);
    const cv = $('#importPreview');
    drawPixels(cv, importResult, null);
    cv.hidden = false;
    $('#importCreate').disabled = false;
  }

  let importDebounce = 0;
  const debouncedPreview = () => {
    $('#detailOut').textContent = $('#detail').value;
    $('#colorsOut').textContent = $('#colors').value;
    clearTimeout(importDebounce);
    importDebounce = setTimeout(updateImportPreview, 120);
  };

  $('#importBtn').onclick = () => {
    importImage = null;
    importResult = null;
    $('#importForm').reset();
    $('#importPreview').hidden = true;
    $('#importCreate').disabled = true;
    $('#importDlg').querySelector('.file span').textContent = 'Choose photo…';
    debouncedPreview();
    $('#importDlg').showModal();
  };

  $('#fileInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $('#importDlg').querySelector('.file span').textContent = file.name;
    if (!$('#importTitle').value) $('#importTitle').value = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      importImage = img;
      updateImportPreview();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert("Sorry, that image couldn't be opened.");
    };
    img.src = url;
  };
  $('#detail').oninput = debouncedPreview;
  $('#colors').oninput = debouncedPreview;

  $('#importCreate').onclick = () => {
    if (!importResult) return;
    const pic = {
      id: 'u' + Date.now().toString(36),
      title: $('#importTitle').value.trim() || 'My picture',
      category: 'My Photos',
      custom: true,
      ...importResult,
    };
    const next = [pic, ...customs];
    if (!store.set(CUSTOM_KEY, next)) {
      alert('Not enough storage space on this device to save the picture. Try deleting an old photo.');
      return;
    }
    customs = next;
    $('#importDlg').close();
    go(pic.id);
  };

  // ---------- Boot ----------

  new ResizeObserver(() => {
    if (!ed) return;
    const oldW = W;
    const oldH = H;
    resize();
    ed.ox += (W - oldW) / 2;
    ed.oy += (H - oldH) / 2;
    const s = Math.min(W / ed.pic.w, H / ed.pic.h) * 0.92;
    ed.minScale = s * 0.8;
    ed.maxScale = Math.max(56, s * 2);
    clampView();
  }).observe(stage);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    refreshShades();
    requestDraw();
    if (!ed) route();
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => document.hidden && flushSave());

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  route();
})();
