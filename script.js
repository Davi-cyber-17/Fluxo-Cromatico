(() => {
  'use strict';

  // Paletas: [topo-esq, topo-dir, base-esq, base-dir]
  const PALETTES = [
    ['#ffc94a', '#ff6b6b', '#3fb8e8', '#2e2a4f'],
    ['#ffe0e0', '#d6385a', '#00aadd', '#380050'],
    ['#ffe83a', '#ffe83a', '#e8403f', '#e8403f'],
    ['#b8f2c9', '#38a3a5', '#ffd6a5', '#5a189a'],
    ['#fff1a8', '#ff7b54', '#6ee7b7', '#1e3a8a'],
    ['#f9d5ff', '#7c3aed', '#fde68a', '#0f766e'],
    ['#fff0f3', '#ff4d6d', '#80ed99', '#3a0ca3'],
    ['#fdf4ff', '#22d3ee', '#fde047', '#be123c'],
  ];

  // Padrões de peças fixas (cantos sempre fixos)
  const PATTERNS = {
    ring:    (r, c, R, C) => r === 0 || c === 0 || r === R - 1 || c === C - 1,
    ringrow: (r, c, R, C) => r === 0 || c === 0 || r === R - 1 || c === C - 1 || r === Math.floor(R / 2),
    bands:   (r, c, R, C) => r === 0 || r === R - 1 || r === Math.floor(R / 2),
    cols:    (r, c, R, C) => c === 0 || c === C - 1,
    stripes: (r, c, R, C) => r === 0 || r === R - 1 || c === 0 || c === C - 1 || c === Math.floor(C / 2),
    corners: (r, c, R, C) => (r === 0 || r === R - 1) && (c === 0 || c === C - 1),
    edgesTB: (r, c, R, C) => r === 0 || r === R - 1,
    // padrões para formas (usam ctx: inside / edge / tip)
    outline:    (r, c, R, C, x) => x.edge(r, c),
    outlinealt: (r, c, R, C, x) => x.edge(r, c) && (r + c) % 2 === 0,
    tips:       (r, c, R, C, x) => x.tip(r, c),
    axis:       (r, c, R, C, x) => r === Math.floor(R / 2) || c === Math.floor(C / 2),
    sparse:     (r, c, R, C, x) => (r + 2 * c) % 5 === 0,
  };

  // ---------- formas do tabuleiro ----------
  // Cada forma recebe (x, y) do centro da peça, normalizados entre -1 e 1
  const inPoly = (pts, x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const STAR = (() => {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? 0.5 : 1;
      pts.push([((Math.cos(a) * rad) / 0.951) * 1.1, (((Math.sin(a) * rad + 1) / 1.809) * 2 - 1) * 1.1 - 0.02]);
    }
    return pts;
  })();
  const ARROW = [[0, -1], [1, -0.1], [0.42, -0.1], [0.42, 1], [-0.42, 1], [-0.42, -0.1], [-1, -0.1]];
  const CROWN = [[-1, 1], [-1, -0.65], [-0.5, 0.1], [0, -0.9], [0.5, 0.1], [1, -0.65], [1, 1]];
  const abs = Math.abs;

  const SHAPES = {
    rect:      () => true,
    circle:    (x, y) => x * x + y * y <= 1.02,
    diamond:   (x, y) => abs(x) + abs(y) <= 1,
    heart:     (x, y) => { const X = x * 1.25, Y = -y * 1.2 + 0.1; return Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y <= 0; },
    triangle:  (x, y) => abs(x) <= (y + 1) / 2,
    cross:     (x, y) => abs(x) <= 0.3 || abs(y) <= 0.3,
    hexagon:   (x, y) => abs(x) + abs(y) * 0.5 <= 1,
    donut:     (x, y) => { const d = x * x + y * y; return d <= 1.02 && d >= 0.16; },
    hourglass: (x, y) => abs(x) <= 0.18 + 0.82 * abs(y),
    star:      (x, y) => inPoly(STAR, x, y),
    arrow:     (x, y) => inPoly(ARROW, x, y),
    xshape:    (x, y) => abs(abs(x) - abs(y)) <= 0.28,
    stairs:    (x, y) => x <= y,
    house:     (x, y) => (y < -0.1 ? abs(x) <= (y + 1) * 1.1 : abs(x) <= 0.72),
    moon:      (x, y) => x * x + y * y <= 1.02 && (x - 0.55) * (x - 0.55) + (y + 0.05) * (y + 0.05) > 0.72,
    band:      (x, y) => abs(x - y) <= 0.5,
    letterT:   (x, y) => y <= -0.45 || abs(x) <= 0.2,
    window:    (x, y) => !(abs(x) < 0.12 || abs(y) < 0.12),
    crown:     (x, y) => inPoly(CROWN, x, y),
  };
  const SHAPE_NAMES = {
    rect: 'Retângulo', circle: 'Círculo', diamond: 'Losango', heart: 'Coração', triangle: 'Triângulo',
    cross: 'Cruz', hexagon: 'Hexágono', donut: 'Anel', hourglass: 'Ampulheta', star: 'Estrela',
    arrow: 'Seta', xshape: 'X', stairs: 'Escada', house: 'Casa', moon: 'Lua', band: 'Diagonal',
    letterT: 'Letra T', window: 'Janela', crown: 'Coroa',
  };

  const LEVELS = [
    { c: 5,  r: 6,  p: 'ring',    pal: 0 },
    { c: 6,  r: 7,  p: 'ring',    pal: 1 },
    { c: 3,  r: 11, p: 'bands',   pal: 2 },
    { c: 7,  r: 8,  p: 'ringrow', pal: 3 },
    { c: 8,  r: 9,  p: 'ring',    pal: 4 },
    { c: 9,  r: 9,  p: 'stripes', pal: 5 },
    { c: 8,  r: 10, p: 'ringrow', pal: 0 },
    { c: 10, r: 12, p: 'ring',    pal: 1 },
    { c: 6,  r: 8,  p: 'edgesTB', pal: 3 },
    { c: 9,  r: 11, p: 'cols',    pal: 4 },
    { c: 7,  r: 9,  p: 'corners', pal: 5 },
    { c: 10, r: 12, p: 'stripes', pal: 2 },
    // ---- níveis com formas ----
    { c: 9,  r: 9,  s: 'circle',    p: 'outline',    pal: 0 },
    { c: 11, r: 11, s: 'diamond',   p: 'outline',    pal: 1 },
    { c: 11, r: 10, s: 'heart',     p: 'outline',    pal: 6 },
    { c: 11, r: 10, s: 'triangle',  p: 'outline',    pal: 3 },
    { c: 11, r: 11, s: 'cross',     p: 'tips',       pal: 4 },
    { c: 13, r: 11, s: 'hexagon',   p: 'outline',    pal: 5 },
    { c: 11, r: 11, s: 'donut',     p: 'outline',    pal: 7 },
    { c: 11, r: 11, s: 'hourglass', p: 'outlinealt', pal: 2 },
    { c: 13, r: 13, s: 'star',      p: 'tips',       pal: 7 },
    { c: 11, r: 13, s: 'arrow',     p: 'outline',    pal: 0 },
    { c: 11, r: 11, s: 'xshape',    p: 'tips',       pal: 1 },
    { c: 10, r: 10, s: 'stairs',    p: 'outlinealt', pal: 3 },
    { c: 11, r: 11, s: 'house',     p: 'outline',    pal: 6 },
    { c: 11, r: 11, s: 'moon',      p: 'outlinealt', pal: 7 },
    { c: 12, r: 12, s: 'band',      p: 'sparse',     pal: 4 },
    { c: 11, r: 11, s: 'letterT',   p: 'outlinealt', pal: 5 },
    { c: 11, r: 11, s: 'window',    p: 'outlinealt', pal: 2 },
    { c: 13, r: 11, s: 'crown',     p: 'sparse',     pal: 6 },
  ];

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const SAVE_KEY = 'degrade_v1';

  let save = { unlocked: 1, stars: {} };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) {}
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

  let levelIdx = 0, cfg, order = [], fixed = [], active = [], tiles = [];
  let moves = 0, par = 1, timerId = null, startTime = 0, elapsed = 0, won = false;
  let selected = -1, tileSize = 40, previewing = false;

  // ---------- cores ----------
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lerp = (a, b, t) => a + (b - a) * t;
  function colorFor(cf, id) {
    const { c: C, r: R, pal } = cf;
    const [tl, tr, bl, br] = PALETTES[pal].map(hex);
    const r = Math.floor(id / C), c = id % C;
    const u = C > 1 ? c / (C - 1) : 0, v = R > 1 ? r / (R - 1) : 0;
    const out = [0, 1, 2].map((k) => {
      const top = lerp(tl[k], tr[k], u), bot = lerp(bl[k], br[k], u);
      return Math.round(lerp(top, bot, v));
    });
    return `rgb(${out[0]},${out[1]},${out[2]})`;
  }
  const colorAt = (id) => colorFor(cfg, id);

  // peças que existem na forma do nível
  function shapeMask(cf) {
    const fn = SHAPES[cf.s || 'rect'], m = [];
    for (let id = 0; id < cf.c * cf.r; id++) {
      const r = Math.floor(id / cf.c), c = id % cf.c;
      m[id] = !!fn(((c + 0.5) / cf.c) * 2 - 1, ((r + 0.5) / cf.r) * 2 - 1);
    }
    return m;
  }

  function makeCtx(C, R) {
    const inside = (r, c) => r >= 0 && c >= 0 && r < R && c < C && active[r * C + c];
    const edge = (r, c) => inside(r, c) && !(inside(r - 1, c) && inside(r + 1, c) && inside(r, c - 1) && inside(r, c + 1));
    let minR = R, maxR = -1, minC = C, maxC = -1;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (inside(r, c)) {
      minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    }
    const tip = (r, c) => {
      if (!inside(r, c)) return false;
      if (r === minR || r === maxR) {
        let a = C, b = -1;
        for (let k = 0; k < C; k++) if (inside(r, k)) { a = Math.min(a, k); b = Math.max(b, k); }
        if (c === a || c === b) return true;
      }
      if (c === minC || c === maxC) {
        let a = R, b = -1;
        for (let k = 0; k < R; k++) if (inside(k, c)) { a = Math.min(a, k); b = Math.max(b, k); }
        if (r === a || r === b) return true;
      }
      return false;
    };
    return { inside, edge, tip };
  }

  // ---------- nível ----------
  function loadLevel(i) {
    levelIdx = Math.max(0, Math.min(LEVELS.length - 1, i));
    cfg = LEVELS[levelIdx];
    $('lvl').textContent = levelIdx + 1;
    const { c: C, r: R, p } = cfg;
    active = shapeMask(cfg);
    const ctx = makeCtx(C, R);
    fixed = [];
    for (let id = 0; id < C * R; id++) {
      // posições fora da forma ficam travadas e invisíveis
      fixed[id] = !active[id] || !!PATTERNS[p](Math.floor(id / C), id % C, R, C, ctx);
    }
    buildBoard();
    shuffleBoard();
    layout();
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    tiles = [];
    const n = cfg.c * cfg.r;
    for (let pos = 0; pos < n; pos++) {
      const t = document.createElement('div');
      t.className = 'tile' + (!active[pos] ? ' empty' : fixed[pos] ? ' fixed' : '');
      t.dataset.pos = pos;
      boardEl.appendChild(t);
      tiles.push(t);
    }
  }

  function shuffleBoard() {
    const n = cfg.c * cfg.r;
    const movable = [];
    for (let i = 0; i < n; i++) if (!fixed[i]) movable.push(i);
    let ids, tries = 0, wrong;
    do {
      ids = movable.slice();
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      wrong = ids.filter((id, k) => id !== movable[k]).length;
      tries++;
    } while (wrong < movable.length * 0.85 && tries < 200);

    order = [];
    for (let i = 0; i < n; i++) order[i] = i;
    movable.forEach((pos, k) => (order[pos] = ids[k]));
    par = wrong;
    moves = 0; elapsed = 0; won = false; selected = -1;
    stopTimer();
    $('moves').textContent = 0;
    $('time').textContent = '0:00';
    paint();
  }

  function paint() {
    tiles.forEach((t, pos) => {
      if (!active[pos]) return;
      t.style.background = colorAt(previewing ? pos : order[pos]);
      t.classList.toggle('selected', pos === selected);
    });
  }

  function layout() {
    const stage = $('stage'), frame = $('frame');
    const fs = getComputedStyle(frame);
    const pad = parseFloat(fs.paddingLeft) * 2 + 4;
    const gap = parseFloat(getComputedStyle(boardEl).columnGap) || 3;
    const availW = stage.clientWidth - pad - gap * (cfg.c - 1);
    const availH = stage.clientHeight - pad - gap * (cfg.r - 1);
    tileSize = Math.max(12, Math.min(110, Math.floor(Math.min(availW / cfg.c, availH / cfg.r))));
    boardEl.style.gridTemplateColumns = `repeat(${cfg.c}, ${tileSize}px)`;
    boardEl.style.gridAutoRows = `${tileSize}px`;
  }

  // ---------- jogo ----------
  function swap(a, b) {
    if (a === b || fixed[a] || fixed[b] || won) return;
    [order[a], order[b]] = [order[b], order[a]];
    moves++;
    $('moves').textContent = moves;
    if (!timerId) startTimer();
    selected = -1;
    paint();
    [a, b].forEach((p) => {
      tiles[p].classList.remove('swap');
      void tiles[p].offsetWidth;
      tiles[p].classList.add('swap');
    });
    if (order.every((id, pos) => id === pos)) win();
  }

  function startTimer() {
    startTime = Date.now() - elapsed * 1000;
    timerId = setInterval(() => {
      elapsed = Math.floor((Date.now() - startTime) / 1000);
      $('time').textContent = fmt(elapsed);
    }, 250);
  }
  function stopTimer() { clearInterval(timerId); timerId = null; }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function win() {
    won = true;
    stopTimer();
    elapsed = Math.floor((Date.now() - startTime) / 1000);
    tiles.forEach((t, i) => {
      if (!active[i]) return;
      t.style.animationDelay = `${((i % cfg.c) + Math.floor(i / cfg.c)) * 35}ms`;
      t.classList.add('win');
    });
    const s = moves <= par ? 3 : moves <= par * 1.6 ? 2 : 1;
    save.stars[levelIdx] = Math.max(save.stars[levelIdx] || 0, s);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIdx + 2));
    persist();
    $('stars').innerHTML = [1, 2, 3].map((n) => `<span class="${n <= s ? '' : 'off'}">★</span>`).join('');
    $('winInfo').textContent = `${moves} jogadas em ${fmt(elapsed)}`;
    $('btnNext').textContent = levelIdx === LEVELS.length - 1 ? 'Recomeçar' : 'Próximo nível';
    setTimeout(() => ($('winModal').hidden = false), 900);
  }

  function hint() {
    if (won) return;
    const wrong = [];
    order.forEach((id, pos) => { if (!fixed[pos] && id !== pos) wrong.push(pos); });
    if (!wrong.length) return;
    const p = wrong[Math.floor(Math.random() * wrong.length)];
    [p, order[p]].forEach((x) => {
      tiles[x].classList.remove('hint');
      void tiles[x].offsetWidth;
      tiles[x].classList.add('hint');
    });
  }

  // ---------- entrada (toque / arrastar) ----------
  let drag = null;
  boardEl.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.tile');
    if (!t || won) return;
    const pos = +t.dataset.pos;
    if (fixed[pos]) return;
    drag = { pos, el: t, x: e.clientX, y: e.clientY, moved: false };
    boardEl.setPointerCapture(e.pointerId);
  });
  boardEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) {
      drag.moved = true;
      drag.el.classList.add('dragging');
    }
    if (drag.moved) drag.el.style.transform = `translate(${dx}px,${dy}px) scale(1.08)`;
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    d.el.classList.remove('dragging');
    d.el.style.transform = '';
    let target = -1;
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    const hit = els.find((el) => el.classList && el.classList.contains('tile') && el !== d.el);
    if (hit) target = +hit.dataset.pos;
    if (d.moved) {
      if (target >= 0) swap(d.pos, target); else paint();
    } else if (selected === -1) {
      selected = d.pos; paint();
    } else if (selected === d.pos) {
      selected = -1; paint();
    } else {
      swap(selected, d.pos);
    }
  };
  boardEl.addEventListener('pointerup', endDrag);
  boardEl.addEventListener('pointercancel', () => {
    if (!drag) return;
    drag.el.classList.remove('dragging'); drag.el.style.transform = ''; drag = null; paint();
  });

  // ---------- UI ----------
  function miniPreview(i) {
    const L = LEVELS[i], m = shapeMask(L);
    const s = Math.max(2, Math.floor(34 / Math.max(L.c, L.r)));
    const cv = document.createElement('canvas');
    cv.width = L.c * s; cv.height = L.r * s; cv.className = 'mini';
    const g = cv.getContext('2d');
    m.forEach((on, id) => {
      if (!on) return;
      g.fillStyle = colorFor(L, id);
      g.fillRect((id % L.c) * s, Math.floor(id / L.c) * s, s, s);
    });
    return cv;
  }

  function openLevels() {
    const g = $('levelGrid');
    g.innerHTML = '';
    LEVELS.forEach((_, i) => {
      const b = document.createElement('button');
      const s = save.stars[i] || 0;
      b.className = 'lv' + (i + 1 > save.unlocked ? ' locked' : '') + (i === levelIdx ? ' current' : '');
      b.title = SHAPE_NAMES[LEVELS[i].s || 'rect'];
      b.appendChild(miniPreview(i));
      b.insertAdjacentHTML('beforeend', `${i + 1}<small>${s ? '★'.repeat(s) : ''}</small>`);
      b.onclick = () => { $('levelModal').hidden = true; loadLevel(i); };
      g.appendChild(b);
    });
    $('levelModal').hidden = false;
  }

  $('btnLevels').onclick = openLevels;
  $('btnCloseLevels').onclick = () => ($('levelModal').hidden = true);
  $('btnHint').onclick = hint;
  $('btnShuffle').onclick = () => { shuffleBoard(); };
  $('btnPreview').onclick = () => {
    if (previewing) return;
    previewing = true; paint();
    setTimeout(() => { previewing = false; paint(); }, 1500);
  };
  $('btnReplay').onclick = () => { $('winModal').hidden = true; loadLevel(levelIdx); };
  $('btnNext').onclick = () => {
    $('winModal').hidden = true;
    loadLevel(levelIdx === LEVELS.length - 1 ? 0 : levelIdx + 1);
  };
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 150));
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe($('stage'));

  loadLevel(Math.min(save.unlocked, LEVELS.length) - 1);
})();
