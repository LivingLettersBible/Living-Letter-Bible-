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

  const progressKey = (id) => 'lc.p.' + id;
  store.del('lc.custom'); // photos from the retired photo import

  // Each picture is line art split into numbered regions; region i is
  // pic.regions[i] = [labelX, labelY, labelRadius, colorIndex].
  // Progress is stored as the order in which regions were painted.
  const PICTURES = window.LINE_ART || [];
  const findPicture = (id) => PICTURES.find((p) => p.id === id);
  const regionColor = (pic, i) => pic.regions[i][3];
  const loadOrder = (pic) => {
    const order = store.get(progressKey(pic.id), []);
    const n = pic.regions.length;
    return Array.isArray(order) ? order.filter((i) => i >= 0 && i < n) : [];
  };

  // ---------- Colour helpers ----------

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  const inkFor = (hex) => (luminance(hex) > 0.6 ? '#2b2622' : '#ffffff');

  function paintedMask(pic, order) {
    const mask = new Uint8Array(pic.regions.length);
    order.forEach((i) => (mask[i] = 1));
    return mask;
  }

  // ---------- Decode region map and ink layer (once per picture) ----------

  const PAPER = [255, 255, 255];
  const TARGET = [217, 211, 204]; // unpainted regions of the selected color

  function b64Bytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function prepareLines(pic) {
    if (!pic._ready) {
      pic._ready = (async () => {
        const stream = new Blob([b64Bytes(pic.labels)]).stream().pipeThrough(new DecompressionStream('deflate'));
        const buf = await new Response(stream).arrayBuffer();
        const labels = new Uint16Array(buf);
        // Group pixel indices by region so a region can be filled without scanning the image.
        const R = pic.regions.length;
        const starts = new Int32Array(R + 2);
        for (let i = 0; i < labels.length; i++) starts[labels[i] + 1]++;
        for (let k = 1; k < starts.length; k++) starts[k] += starts[k - 1];
        const fillPos = starts.slice();
        const pix = new Int32Array(labels.length);
        for (let i = 0; i < labels.length; i++) pix[fillPos[labels[i]]++] = i;
        const ink = new Image();
        ink.src = pic.lines;
        await ink.decode();
        pic._rt = { labels, starts, pix, ink };
      })();
      pic._ready.catch(() => (pic._ready = null));
    }
    return pic._ready;
  }

  // Region k (0-based) is label k + 1 in the map.
  function fillRegion(data, pic, k, rgb) {
    const { starts, pix } = pic._rt;
    for (let p = starts[k + 1], end = starts[k + 2]; p < end; p++) {
      const o = pix[p] * 4;
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
    }
  }

  // Full-size canvas with painted regions filled (no ink).
  function linesFillCanvas(pic, painted, selected) {
    const cv = document.createElement('canvas');
    cv.width = pic.w;
    cv.height = pic.h;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(pic.w, pic.h);
    img.data.fill(255);
    const colors = pic.palette.map(hexToRgb);
    pic.regions.forEach((r, k) => {
      if (!painted || painted[k]) fillRegion(img.data, pic, k, colors[r[3]]);
      else if (r[3] === selected) fillRegion(img.data, pic, k, TARGET);
    });
    cx.putImageData(img, 0, 0);
    return { cv, cx, img };
  }

  // Draw a line-art picture (fills + ink) into a canvas of the given width.
  async function drawLines(canvas, pic, painted, width) {
    await prepareLines(pic);
    const scale = width / pic.w;
    canvas.width = Math.round(pic.w * scale);
    canvas.height = Math.round(pic.h * scale);
    const cx = canvas.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(linesFillCanvas(pic, painted, -1).cv, 0, 0, canvas.width, canvas.height);
    cx.drawImage(pic._rt.ink, 0, 0, canvas.width, canvas.height);
  }

  function drawThumb(canvas, pic, painted) {
    drawLines(canvas, pic, painted, 360).catch(() => {});
  }

  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';

  // ---------- Gallery ----------

  const CATEGORIES = ['All', 'Crowns', 'Gardens', 'Hearts', 'Faith', 'Animals', 'Vintage'];
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
    const day = Math.floor(Date.now() / 86400000);
    const pic = PICTURES[day % PICTURES.length];
    const order = loadOrder(pic);
    const pct = Math.round((order.length / pic.regions.length) * 100);
    const el = $('#daily');
    el.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'daily';
    const cv = document.createElement('canvas');
    drawThumb(cv, pic, null);
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
    const list = PICTURES.filter((p) => activeTab === 'All' || p.category === activeTab);
    list.forEach((pic) => {
      const order = loadOrder(pic);
      const pct = Math.floor((order.length / pic.regions.length) * 100);
      const done = order.length === pic.regions.length;
      const card = document.createElement('div');
      card.className = 'card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${pic.title}, ${done ? 'completed' : pct + '% colored'}`);
      const cv = document.createElement('canvas');
      drawThumb(cv, pic, paintedMask(pic, order));
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

  // Embedded builds (e.g. inside another page's frame) route in memory
  // instead of through the URL hash.
  const EMBED = !!window.LC_EMBED;
  let embedRoute = '';

  function go(id) {
    if (EMBED) {
      embedRoute = id || '';
      route();
    } else {
      location.hash = id ? '#/paint/' + encodeURIComponent(id) : '';
    }
  }

  function route() {
    const m = EMBED ? [null, embedRoute] : location.hash.match(/^#\/paint\/(.+)$/);
    const pic = m && m[1] && findPicture(decodeURIComponent(m[1]));
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

  let openToken = 0;

  function openEditor(pic) {
    closeEditor();
    const token = ++openToken;
    if (!pic._rt) {
      prepareLines(pic)
        .then(() => token === openToken && openEditor(pic))
        .catch(() => ask("This picture couldn't be loaded on this browser. Try updating your browser.").then(() => go('')));
      return;
    }
    const order = loadOrder(pic);
    const painted = paintedMask(pic, order);
    const remaining = pic.palette.map(() => 0);
    for (let i = 0; i < painted.length; i++) {
      if (!painted[i]) remaining[regionColor(pic, i)]++;
    }
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
      finished: order.length === pic.regions.length,
      layer: null,
      colors: pic.palette.map(hexToRgb),
    };
    ed.layer = linesFillCanvas(pic, painted, ed.selected);
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
    ed.stageColor = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim();
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

  function fitScale() {
    const s = Math.min(W / ed.pic.w, H / ed.pic.h) * 0.96;
    ed.minScale = s * 0.8;
    ed.maxScale = Math.max(4, s * 8);
    return s;
  }

  function fit() {
    if (!ed) return;
    const s = fitScale();
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
    const w = pic.w * s;
    const h = pic.h * s;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ed.layer.cv, ox, oy, w, h);
    ctx.drawImage(pic._rt.ink, ox, oy, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k < pic.regions.length; k++) {
      if (painted[k]) continue;
      const [lx, ly, r, c] = pic.regions[k];
      const rs = r * s;
      if (rs < 5.5) continue;
      const x = ox + lx * s;
      const y = oy + ly * s;
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      const size = Math.min(22, Math.max(8, rs * 1.05));
      ctx.font = `${c === selected ? 700 : 500} ${size}px system-ui, sans-serif`;
      ctx.fillStyle = c === selected ? '#1f1b17' : '#8a8178';
      ctx.fillText(String(c + 1), x, y + size * 0.04);
    }

    if (ed.flash) {
      const t = (now || performance.now()) - ed.flash.start;
      if (t > 1400) {
        ed.flash = null;
      } else {
        const [lx, ly, r] = pic.regions[ed.flash.i];
        const pulse = 0.5 + 0.5 * Math.sin(t / 90);
        ctx.strokeStyle = `rgba(255, 122, 89, ${0.4 + 0.6 * pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ox + lx * s, oy + ly * s, Math.max(12, r * s) + 4 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();
        requestDraw();
      }
    }
  }

  // Repaint one region in the fill layer.
  function updateRegion(k) {
    const c = ed.pic.regions[k][3];
    const rgb = ed.painted[k] ? ed.colors[c] : c === ed.selected ? TARGET : PAPER;
    fillRegion(ed.layer.img.data, ed.pic, k, rgb);
  }

  function flushLayer() {
    ed.layer.cx.putImageData(ed.layer.img, 0, 0);
    requestDraw();
  }

  // ---------- Palette & progress ----------

  function renderPalette() {
    const pal = $('#palette');
    pal.innerHTML = '';
    const totals = ed.pic.palette.map(() => 0);
    for (let i = 0; i < ed.painted.length; i++) totals[regionColor(ed.pic, i)]++;
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
    const prev = ed.selected;
    ed.selected = c;
    if (prev !== c) {
      ed.pic.regions.forEach((r, k) => {
        if (!ed.painted[k] && (r[3] === prev || r[3] === c)) updateRegion(k);
      });
      flushLayer();
    }
    updateSelection();
    requestDraw();
  }

  function updateProgress() {
    const pct = Math.floor((ed.order.length / ed.pic.regions.length) * 100);
    $('#edPct').textContent = pct + '%';
    $('#edMeter').style.width = pct + '%';
  }

  // ---------- Painting ----------

  // The region under a screen point, or -1.
  function regionAt(x, y) {
    const cx = Math.floor((x - ed.ox) / ed.scale);
    const cy = Math.floor((y - ed.oy) / ed.scale);
    if (cx < 0 || cy < 0 || cx >= ed.pic.w || cy >= ed.pic.h) return -1;
    return ed.pic._rt.labels[cy * ed.pic.w + cx] - 1;
  }

  function paintRegion(i) {
    if (i < 0 || ed.painted[i]) return;
    const c = regionColor(ed.pic, i);
    if (c !== ed.selected) {
      toast(`That's color ${c + 1}`);
      return;
    }
    ed.painted[i] = 1;
    ed.order.push(i);
    ed.remaining[c]--;
    updateRegion(i);
    flushLayer();
    updateSwatch(c);
    updateProgress();
    scheduleSave();
    requestDraw();
    if (ed.remaining[c] === 0) colorDone(c);
  }

  function colorDone(c) {
    if (ed.order.length === ed.pic.regions.length) {
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
    for (let k = 0; k < ed.painted.length; k++) {
      if (!ed.painted[k] && regionColor(ed.pic, k) === ed.selected) {
        i = k;
        break;
      }
    }
    if (i < 0) i = ed.painted.indexOf(0);
    if (i < 0) return;
    if (regionColor(ed.pic, i) !== ed.selected) select(regionColor(ed.pic, i));
    const [lx, ly, r] = ed.pic.regions[i];
    const target = Math.min(ed.maxScale, Math.max(ed.scale, 16 / Math.max(r, 1)));
    animateView(target, W / 2 - lx * target, H / 2 - ly * target);
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

  // ---------- Pointer input: tap to paint, drag to pan, pinch to zoom ----------

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
    // A tap fills a region; a drag moves the picture.
    gesture = { type: pan ? 'pan' : 'tap', x: p.x, y: p.y, sx: p.x, sy: p.y };
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
    } else if (gesture.type === 'tap') {
      if (Math.hypot(p.x - gesture.sx, p.y - gesture.sy) > 8) {
        gesture.type = 'pan';
        ed.ox += p.x - gesture.x;
        ed.oy += p.y - gesture.y;
        gesture.x = p.x;
        gesture.y = p.y;
        clampView();
        requestDraw();
      }
    } else if (gesture.type === 'pan') {
      ed.ox += p.x - gesture.x;
      ed.oy += p.y - gesture.y;
      gesture.x = p.x;
      gesture.y = p.y;
      clampView();
      requestDraw();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture && gesture.type === 'tap' && e.type === 'pointerup' && !pointers.size) {
      paintRegion(regionAt(gesture.sx, gesture.sy));
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
    if (!ed || $('#editor').hidden || e.target.closest('dialog[open]')) return;
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

  // ---------- In-page confirm / notice ----------

  // Resolves true when confirmed. Without an okLabel it is a plain notice.
  function ask(message, okLabel) {
    const dlg = $('#askDlg');
    $('#askMsg').textContent = message;
    const ok = $('#askOk');
    const cancel = $('#askCancel');
    ok.textContent = okLabel || 'OK';
    ok.classList.toggle('danger', !!okLabel);
    cancel.hidden = !okLabel;
    return new Promise((resolve) => {
      const done = (value) => {
        ok.onclick = cancel.onclick = null;
        dlg.onclose = null;
        if (dlg.open) dlg.close();
        resolve(value);
      };
      ok.onclick = () => done(!!okLabel);
      cancel.onclick = () => done(false);
      dlg.onclose = () => done(false);
      dlg.showModal();
      ok.focus();
    });
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
    if (act === 'restart') {
      const pic = ed.pic;
      ask('Clear all color from this picture and start over?', 'Restart').then((ok) => {
        if (!ok || !ed || ed.pic !== pic) return;
        ed.order = []; // closing the editor saves progress, so clear it first
        store.del(progressKey(pic.id));
        openEditor(pic);
      });
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
    const scale = Math.min(1, 800 / pic.w);
    cv.width = Math.round(pic.w * scale);
    cv.height = Math.round(pic.h * scale);
    const out = cv.getContext('2d');
    const layer = linesFillCanvas(pic, new Uint8Array(pic.regions.length), -1);
    const colors = pic.palette.map(hexToRgb);
    const duration = 3200;
    const start = performance.now();
    let shown = 0;
    const step = (now) => {
      const target = Math.min(order.length, Math.ceil(((now - start) / duration) * order.length));
      for (; shown < target; shown++) fillRegion(layer.img.data, pic, order[shown], colors[pic.regions[order[shown]][3]]);
      layer.cx.putImageData(layer.img, 0, 0);
      out.drawImage(layer.cv, 0, 0, cv.width, cv.height);
      out.drawImage(pic._rt.ink, 0, 0, cv.width, cv.height);
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

  async function downloadPng(pic, order) {
    const big = document.createElement('canvas');
    await drawLines(big, pic, paintedMask(pic, order), pic.w);
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

  // ---------- Boot ----------

  new ResizeObserver(() => {
    if (!ed) return;
    const oldW = W;
    const oldH = H;
    resize();
    ed.ox += (W - oldW) / 2;
    ed.oy += (H - oldH) / 2;
    fitScale();
    ed.scale = Math.min(ed.maxScale, Math.max(ed.minScale, ed.scale));
    clampView();
  }).observe(stage);

  const onThemeChange = () => {
    refreshShades();
    requestDraw();
    if (!ed) route();
  };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onThemeChange);
  new MutationObserver(onThemeChange).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => document.hidden && flushSave());

  if (!EMBED && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  if (EMBED) document.querySelectorAll('[data-act="download"]').forEach((b) => (b.hidden = true));

  route();
})();
