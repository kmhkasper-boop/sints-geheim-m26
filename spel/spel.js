/* Pieten spel – platformer over de daken. Eén bestand, geen externe verzoeken. */
(function () {
  "use strict";
  const T = 40, WORLD_H = 14 * T;
  const KEY = "pieten_spel_v1";
  const qs = new URLSearchParams(location.search);
  const DEBUG = qs.has("debug");
  const A = window.PietAudio;
  const $ = (s) => document.querySelector(s);

  /* ---------- opslag ---------- */
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.v === 1) return s; } catch (e) {}
    return { v: 1, unlocked: 1, stars: [0, 0, 0], belDone: false, music: true };
  }
  let save = loadSave();
  function store() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
  A.setMusic(save.music !== false);

  /* ---------- plaatjes ---------- */
  const IMG = {};
  const imgList = ["lucht", "huizen", "dakpannen", "piet-staan", "piet-rennen", "piet-springen", "piet-gooien", "kraai", "kat", "schoorsteen", "pakje-rood", "pakje-blauw", "pakje-groen", "pepernoot", "zak"];
  let loaded = 0;
  const ready = Promise.all(imgList.map((n) => new Promise((ok) => {
    const im = new Image(); im.onload = im.onerror = () => { loaded++; ok(); }; im.src = "assets/" + n + ".webp"; IMG[n] = im;
  })));
  const PAKJES = ["pakje-rood", "pakje-blauw", "pakje-groen"];

  /* ---------- canvas ---------- */
  const cv = $("#game"), ctx = cv.getContext("2d");
  let W = 0, H = 0, DPR = 1, SC = 1, VW = 0, camX = 0, camY = 0, bottomPad = 0, portrait = false;
  // Maat altijd uit de layout-viewport (niet uit een ingezoomde visual viewport), zodat schaal nooit opstapelt.
  function viewSize() {
    const de = document.documentElement;
    let w = de.clientWidth || window.innerWidth, h = de.clientHeight || window.innerHeight;
    const vv = window.visualViewport;
    if (vv && Math.abs(vv.scale - 1) < 0.02) { w = vv.width; h = vv.height; }
    return [Math.max(1, Math.round(w)), Math.max(1, Math.round(h))];
  }
  function resize() {
    const sz = viewSize(); W = sz[0]; H = sz[1];
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(W * DPR), bh = Math.round(H * DPR);
    if (cv.width !== bw) cv.width = bw;
    if (cv.height !== bh) cv.height = bh;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    document.documentElement.style.setProperty("--vh", H + "px");
    portrait = H > W * 1.05;
    bottomPad = portrait ? Math.min(240, H * 0.22) : 0;
    SC = Math.min((H - bottomPad) / WORLD_H, W / 720);
    if (!portrait) SC = Math.min(H / WORLD_H, W / 640);
    VW = W / SC;
    try { checkRotate(); } catch (e) { /* nog niet klaar */ }
  }
  const metaVp = document.querySelector('meta[name="viewport"]');
  const VP = metaVp ? metaVp.content : "";
  function resetZoom() {
    // iOS: viewport-meta opnieuw zetten dwingt schaal 1 af na draaien
    if (metaVp) { metaVp.content = VP + ", minimum-scale=1"; setTimeout(() => { metaVp.content = VP; }, 50); }
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  }
  let rzT = 0;
  function resizeSoon() { resize(); clearTimeout(rzT); rzT = setTimeout(resize, 250); setTimeout(resize, 700); }
  window.addEventListener("resize", resizeSoon);
  window.addEventListener("orientationchange", () => { resetZoom(); resizeSoon(); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", () => { if (Math.abs(window.visualViewport.scale - 1) > 0.02) resetZoom(); resizeSoon(); });
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener("change", resizeSoon);
  document.addEventListener("fullscreenchange", resizeSoon);
  window.addEventListener("scroll", () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); });

  /* ---------- geen zoom / gebaren ---------- */
  const noDef = (e) => { if (e.cancelable) e.preventDefault(); };
  ["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, noDef, { passive: false }));
  document.addEventListener("dblclick", noDef, { passive: false });
  document.addEventListener("touchmove", noDef, { passive: false });
  document.addEventListener("touchstart", (e) => { if (e.touches.length > 1 && !(e.target.closest && e.target.closest("button,a"))) noDef(e); }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 350 && !(e.target.closest && e.target.closest("button,a,video"))) noDef(e);
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener("wheel", (e) => { if (e.ctrlKey) noDef(e); }, { passive: false });
  resize();

  /* ---------- invoer ---------- */
  const inp = { l: false, r: false, jump: false, jumpHeld: false, gooi: false, pep: false };
  const keys = {};
  let usedTouch = false;
  window.addEventListener("keydown", (e) => {
    if (e.repeat) { if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault(); return; }
    keys[e.code] = true;
    if (["Space", "KeyW", "ArrowUp"].includes(e.code)) { inp.jump = true; e.preventDefault(); }
    if (["KeyE", "KeyX"].includes(e.code)) inp.gooi = true;
    if (["KeyQ", "KeyC", "ShiftLeft", "ShiftRight"].includes(e.code)) inp.pep = true;
    if (e.code === "KeyP" || e.code === "Escape") { if (mode === "play") pause(); else if (mode === "pause") resume(); }
    if (e.code === "KeyH" || e.code === "Slash") toggleKeys();
    if (DEBUG && e.code === "KeyN" && mode === "play") winLevel();
    if (DEBUG && e.code === "KeyI") god = !god;
    if (e.code.startsWith("Arrow")) e.preventDefault();
    A.ensure();
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  function readKeys() {
    inp.l = keys.KeyA || keys.ArrowLeft || touchL;
    inp.r = keys.KeyD || keys.ArrowRight || touchR;
    inp.jumpHeld = keys.Space || keys.KeyW || keys.ArrowUp || touchJump;
  }
  let touchL = false, touchR = false, touchJump = false;
  const pad = $("#pad"), padL = $("#pad-l"), padR = $("#pad-r");
  const padPointers = new Map();
  function padUpdate() {
    touchL = false; touchR = false;
    const rl = padL.getBoundingClientRect(), rr = padR.getBoundingClientRect();
    const mid = (rl.right + rr.left) / 2;
    padPointers.forEach((x) => { if (x < mid) touchL = true; else touchR = true; });
    padL.classList.toggle("on", touchL); padR.classList.toggle("on", touchR);
  }
  pad.addEventListener("pointerdown", (e) => { e.preventDefault(); usedTouch = true; A.ensure(); padPointers.set(e.pointerId, e.clientX); try { pad.setPointerCapture(e.pointerId); } catch (er) {} padUpdate(); });
  pad.addEventListener("pointermove", (e) => { if (padPointers.has(e.pointerId)) { padPointers.set(e.pointerId, e.clientX); padUpdate(); } });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => pad.addEventListener(ev, (e) => { padPointers.delete(e.pointerId); padUpdate(); }));
  function actBtn(el, down, up) {
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); usedTouch = true; A.ensure(); el.classList.add("on"); down(); try { el.setPointerCapture(e.pointerId); } catch (er) {} });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => el.addEventListener(ev, () => { el.classList.remove("on"); if (up) up(); }));
  }
  actBtn($("#act-jump"), () => { inp.jump = true; touchJump = true; }, () => { touchJump = false; });
  actBtn($("#act-gooi"), () => { inp.gooi = true; });
  actBtn($("#act-pep"), () => { inp.pep = true; });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0) || matchMedia("(pointer: coarse)").matches;
  window.addEventListener("touchstart", () => { usedTouch = true; }, { passive: true });

  /* ---------- level-state ---------- */
  let LV = null, levelIndex = 0, grid = null, mode = "menu", god = false;
  let P = null, ents = [], plats = [], chims = [], shots = [], parts = [], puffs = [], flags = [], endObj = null;
  let delivered = 0, pepCount = 0, pepGot = 0, hearts = 3, respawn = null, lastSafe = null, time = 0, levelTime = 0, flashT = 0;
  let snow = [];

  function cell(c, r) { if (r < 0) return " "; if (r >= 14) r = 13; if (c < 0 || c >= LV.width) return " "; return grid[r][c]; }
  function solidAt(c, r) { const ch = cell(c, r); return ch === "#" || ch === "=" || ch === "C"; }

  function startLevel(i) {
    levelIndex = i; LV = window.PIETEN_LEVELS[i];
    grid = LV.grid;
    chims = LV.chimneys.map((c) => ({ col: c.col, top: c.topRow * T, x: c.col * T, smoke: c.smoke, offset: c.offset, done: false, glow: 0, puffT: c.offset }));
    plats = LV.plats.map((p) => ({ bx: p.col * T, by: p.row * T, w: p.w * T, h: 16, dx: p.dx * T, dy: p.dy * T, period: p.period, phase: p.phase, x: p.col * T, y: p.row * T, vx: 0, vy: 0 }));
    ents = LV.ents.map((e) => {
      const o = Object.assign({}, e, { x: e.x * T, y: e.row * T, alive: true, stun: 0 });
      if (e.t === "pep") { o.x += T / 2; o.y += T / 2; }
      if (e.t === "heart") { o.x += T / 2; o.y += T / 2; }
      if (e.t === "cat") { o.w = 52; o.h = 30; o.y = (e.row + 1) * T - o.h; o.vx = -e.speed; o.vy = 0; }
      if (e.t === "crow") { o.w = 42; o.h = 30; o.x0 = o.x; o.y0 = o.y; o.ph = Math.random() * 6; o.dir = -1; o.dive = 0; }
      if (e.t === "balls") { o.timer = e.delay; }
      return o;
    });
    flags = LV.flags.map((f) => ({ x: f.x * T + T / 2, y: (f.row + 1) * T, on: false }));
    endObj = { x: LV.end.x * T + T / 2, y: (LV.end.row + 1) * T };
    shots = []; parts = []; puffs = [];
    delivered = 0; pepGot = 0; pepCount = 3; hearts = 3; levelTime = 0;
    const sx = LV.start.x * T + T / 2, sy = (LV.start.row + 1) * T;
    respawn = { x: sx, y: sy }; lastSafe = { x: sx, y: sy };
    P = newPlayer(sx, sy);
    camX = Math.max(0, P.x - VW * 0.35);
    snow = []; for (let k = 0; k < 90; k++) snow.push({ x: Math.random() * 2000, y: Math.random() * 1200, s: 0.4 + Math.random() * 1.2, ph: Math.random() * 6 });
    mode = "play";
    showScreen(null);
    $("#hud").classList.remove("hidden");
    $("#touch").classList.toggle("hidden", !(isTouch || usedTouch));
    if (!isTouch) showKeys(true, 7000);
    banner((i === 2 ? "⚡ " : "") + "Level " + (i + 1), i === 2 ? "Nu wordt het moeilijk!" : null, 1800);
    if (i === 2) A.say("piet-level3"); else A.say("piet-start");
    A.startMusic();
    updHud();
  }
  function newPlayer(x, yb) { return { x: x - 15, y: yb - 64, w: 30, h: 64, vx: 0, vy: 0, on: false, onPlat: null, face: 1, coyote: 0, buf: 0, inv: 0, throwT: 0, anim: 0, ice: false, jumping: false }; }

  /* ---------- botsing ---------- */
  function collideX(o) {
    const top = Math.floor(o.y / T), bot = Math.floor((o.y + o.h - 1) / T);
    if (o.vx > 0) { const c = Math.floor((o.x + o.w) / T); for (let r = top; r <= bot; r++) if (solidAt(c, r)) { o.x = c * T - o.w; o.vx = 0; return true; } }
    else if (o.vx < 0) { const c = Math.floor(o.x / T); for (let r = top; r <= bot; r++) if (solidAt(c, r)) { o.x = (c + 1) * T; o.vx = 0; return true; } }
    return false;
  }
  function collideY(o, prevBottom) {
    const l = Math.floor((o.x + 2) / T), r = Math.floor((o.x + o.w - 3) / T);
    o.on = false; o.ice = false;
    if (o.vy >= 0) {
      const row = Math.floor((o.y + o.h) / T);
      for (let c = l; c <= r; c++) {
        const ch = cell(c, row);
        const solid = ch === "#" || ch === "=" || ch === "C";
        const oneway = ch === "-" && prevBottom <= row * T + 1;
        if (solid || oneway) { o.y = row * T - o.h; o.vy = 0; o.on = true; if (ch === "=") o.ice = true; return true; }
      }
    } else {
      const row = Math.floor(o.y / T);
      for (let c = l; c <= r; c++) if (solidAt(c, row)) { o.y = (row + 1) * T; o.vy = 0; return true; }
    }
    return false;
  }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  /* ---------- update ---------- */
  function update(dt) {
    time += dt; levelTime += dt;
    readKeys();
    // platforms
    for (const p of plats) {
      const k = (Math.sin(((levelTime / p.period) + p.phase) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      const nx = p.bx + p.dx * k, ny = p.by + p.dy * k;
      p.vx = (nx - p.x) / dt; p.vy = (ny - p.y) / dt; p.mx = nx - p.x; p.my = ny - p.y; p.x = nx; p.y = ny;
    }
    updatePlayer(dt);
    updateEnts(dt);
    updateShots(dt);
    updateFx(dt);
    // camera
    const target = P.x + P.w / 2 - VW * (P.face > 0 ? 0.38 : 0.62);
    camX += (target - camX) * Math.min(1, dt * 4);
    camX = Math.max(0, Math.min(LV.width * T - VW, camX));
    camY = WORLD_H - (H - bottomPad) / SC;
    const topNeed = P.y - 60;
    if (topNeed < camY) camY = topNeed;
    inp.jump = false; inp.gooi = false; inp.pep = false;
  }

  function updatePlayer(dt) {
    const p = P;
    if (p.dead) { p.deadT -= dt; p.vy += 2100 * dt; p.y += p.vy * dt; if (p.deadT <= 0) doRespawn(); return; }
    const acc = p.on ? (p.ice ? 420 : 2400) : 1500;
    const fric = p.on ? (p.ice ? 160 : 2600) : 1300;
    const maxV = 300;
    let dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    if (p.knock > 0) { p.knock -= dt; dir = 0; }
    if (dir) {
      p.face = dir;
      if (p.vx * dir < maxV) { p.vx += dir * acc * dt; if (p.vx * dir > maxV) p.vx = dir * maxV; }
      else p.vx = dir * Math.max(maxV, Math.abs(p.vx) - fric * dt);
    }
    else { const s = Math.sign(p.vx); p.vx -= s * fric * dt; if (Math.sign(p.vx) !== s) p.vx = 0; }
    if (p.on) p.coyote = 0.1; else p.coyote -= dt;
    if (inp.jump) p.buf = 0.14; else p.buf -= dt;
    if (p.buf > 0 && p.coyote > 0) { p.vy = -840; p.coyote = 0; p.buf = 0; p.on = false; p.onPlat = null; p.jumping = true; A.sfx("jump"); }
    if (!inp.jumpHeld && p.jumping && p.vy < -300) { p.vy = -300; }
    if (p.vy >= 0) p.jumping = false;
    p.vy += 2100 * dt; if (p.vy > 1100) p.vy = 1100;
    // ride platform
    if (p.onPlat) { p.x += p.onPlat.mx; p.y += p.onPlat.my; }
    p.x += p.vx * dt; collideX(p);
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x + p.w > LV.width * T) { p.x = LV.width * T - p.w; p.vx = 0; }
    const prevBottom = p.y + p.h;
    p.y += p.vy * dt;
    collideY(p, prevBottom);
    // platforms landing
    const wasOn = p.onPlat; p.onPlat = null;
    if (p.vy >= 0) {
      for (const pl of plats) {
        const pb = prevBottom - (wasOn === pl ? 0 : pl.my);
        if (p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2 && p.y + p.h >= pl.y && pb <= pl.y + 6) {
          p.y = pl.y - p.h; p.vy = 0; p.on = true; p.onPlat = pl; break;
        }
      }
    }
    // safe ground
    if (p.on && !p.onPlat) {
      const l = Math.floor((p.x - 10) / T), r = Math.floor((p.x + p.w + 10) / T), row = Math.floor((p.y + p.h + 1) / T);
      if (solidAt(l, row) && solidAt(r, row) && !nearEnemy(p.x, 160)) lastSafe = { x: p.x + p.w / 2, y: p.y + p.h };
    }
    p.inv -= dt; p.throwT -= dt; p.anim += dt * (Math.abs(p.vx) / 40 + 1);
    // throwing
    if (inp.gooi) throwPakje();
    if (inp.pep) throwPep();
    // pit
    if (p.y > WORLD_H + 80) { hurt(true); }
    // flags
    for (const f of flags) if (!f.on && Math.abs(p.x + p.w / 2 - f.x) < 30 && p.y + p.h > f.y - 80 && p.y < f.y) {
      f.on = true; respawn = { x: f.x, y: f.y }; lastSafe = { x: f.x, y: f.y }; hearts = Math.max(hearts, 3); updHud(); A.sfx("vlag"); burst(f.x, f.y - 60, "#ffd76a", 18);
    }
    if (Math.abs(p.x + p.w / 2 - endObj.x) < 50 && p.y + p.h > endObj.y - 100 && p.y < endObj.y) winLevel();
  }
  function nearEnemy(x, d) { return ents.some((e) => (e.t === "cat" || e.t === "crow") && e.alive && !e.stun && Math.abs(e.x - x) < d); }

  function hurt(fell) {
    if (god && !fell) return;
    if (!fell && P.inv > 0) return;
    hearts -= 1; updHud();
    if (fell) {
      A.sfx("val");
      if (god) hearts += 1;
      if (hearts <= 0 || LV.opts.respawn === "flag") { P.dead = true; P.deadT = 0.01; } else { const s = lastSafe; P = newPlayer(s.x, s.y); P.inv = 1.5; }
      if (hearts <= 0) { banner("Oeps!", null, 1200); }
      return;
    }
    A.sfx("au"); A.say("piet-au");
    flashT = 0.25;
    if (hearts <= 0) { P.dead = true; P.deadT = 0.9; P.vy = -600; banner("Oeps!", null, 1200); return; }
    P.inv = 1.6; P.knock = 0.25; P.vx = -P.face * 300; P.vy = -380; P.on = false;
  }
  function doRespawn() {
    const r = respawn; P = newPlayer(r.x, r.y); P.inv = 1.5; hearts = 3; updHud();
    camX = Math.max(0, Math.min(LV.width * T - VW, P.x - VW * 0.35));
  }

  function throwPakje() {
    if (P.dead) return;
    P.throwT = 0.28; A.sfx("gooi");
    const x0 = P.x + P.w / 2 + P.face * 14, y0 = P.y + 18;
    let vx = P.face * 330 + P.vx * 0.4, vy = -560;
    const g = 1500;
    // staat Piet op een schoorsteen? Dan valt hij er zo in.
    const under = chims.find((c) => !c.done && P.on && Math.abs(P.y + P.h - c.top) < 2 && P.x + P.w > c.x && P.x < c.x + T);
    if (under) { vx = (under.x + T / 2 - x0) * 2; vy = -320; }
    else {
      // hulp bij het mikken
      let best = null, bd = 1e9;
      for (const c of chims) {
        if (c.done) continue;
        const dx = c.x + T / 2 - x0;
        if (Math.sign(dx) !== P.face || Math.abs(dx) > LV.opts.assist * T || Math.abs(dx) < 4) continue;
        const dy = c.top - y0;
        const disc = vy * vy + 2 * g * dy; if (disc < 0) continue;
        if (Math.abs(dx) < bd) { bd = Math.abs(dx); best = { c, dx, dy, t: (-vy + Math.sqrt(disc)) / g }; }
      }
      if (best) { const need = best.dx / best.t; if (Math.abs(need) < 520) vx = need; }
    }
    shots.push({ t: "pakje", x: x0, y: y0, vx: vx, vy: vy, g: g, img: PAKJES[Math.floor(Math.random() * 3)], rot: 0, life: 3 });
  }
  function throwPep() {
    if (P.dead) return;
    if (pepCount <= 0) { A.sfx("tik"); banner("", "0 × 🍪", 600); return; }
    pepCount--; updHud(); P.throwT = 0.2; A.sfx("strooi");
    shots.push({ t: "pep", x: P.x + P.w / 2 + P.face * 16, y: P.y + 24, vx: P.face * 560 + P.vx * 0.3, vy: -140, g: 500, rot: 0, life: 1.4 });
  }

  function updateShots(dt) {
    for (const s of shots) {
      s.life -= dt; s.vy += s.g * dt;
      const py = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 8 * Math.sign(s.vx || 1);
      if (s.t === "pakje") {
        // magneet
        if (s.vy > 0) for (const c of chims) {
          if (c.done) continue; const cx = c.x + T / 2;
          if (Math.abs(s.x - cx) < 60 * LV.opts.magnet && s.y < c.top && s.y > c.top - 120) s.vx += (cx - s.x) * 10 * dt;
        }
        for (const c of chims) {
          if (py + 10 <= c.top + 2 && s.y + 10 >= c.top && s.x > c.x - 4 && s.x < c.x + T + 4 && s.vy > 0) {
            s.life = 0;
            if (!c.done) { c.done = true; c.glow = 1.5; delivered++; updHud(); A.sfx("raak"); if (delivered === chims.length) A.say("piet-allemaal"); else A.say("piet-raak"); burst(c.x + T / 2, c.top, "#ffd76a", 26); hearts3(c.x + T / 2, c.top); }
            else { burst(c.x + T / 2, c.top, "#fff", 8); }
          }
        }
        if (s.life > 0 && solidAt(Math.floor(s.x / T), Math.floor((s.y + 10) / T))) { s.life = 0; A.sfx("poef"); burst(s.x, s.y, "#fff", 10); }
      } else {
        if (solidAt(Math.floor(s.x / T), Math.floor(s.y / T))) { s.life = 0; burst(s.x, s.y, "#c98a4a", 6); }
        for (const e of ents) {
          if (!e.alive || e.stun > 0 || !(e.t === "cat" || e.t === "crow" || e.t === "ball")) continue;
          if (s.x > e.x - 6 && s.x < e.x + e.w + 6 && s.y > e.y - 6 && s.y < e.y + e.h + 6) { s.life = 0; stunEnt(e); }
        }
      }
      if (s.y > WORLD_H + 200) s.life = 0;
    }
    shots = shots.filter((s) => s.life > 0);
  }
  function stunEnt(e) {
    A.sfx("bonk");
    if (e.t === "ball") { e.alive = false; burst(e.x + e.w / 2, e.y + e.h / 2, "#fff", 16); return; }
    e.stun = 5; burst(e.x + e.w / 2, e.y, "#ffe27a", 10);
  }

  function updateEnts(dt) {
    const p = P;
    const pbox = { x: p.x + 3, y: p.y + 4, w: p.w - 6, h: p.h - 6 };
    for (const e of ents) {
      if (!e.alive) continue;
      if (e.t === "pep" || e.t === "heart") {
        if (Math.abs(p.x + p.w / 2 - e.x) < 30 && Math.abs(p.y + p.h / 2 - e.y) < 44) {
          e.alive = false;
          if (e.t === "pep") { pepCount++; pepGot++; A.sfx("pep"); burst(e.x, e.y, "#e0a060", 6); }
          else { hearts = Math.min(5, hearts + 1); A.sfx("hart"); burst(e.x, e.y, "#ff5a7a", 12); }
          updHud();
        }
        continue;
      }
      if (e.t === "balls") {
        e.timer -= dt;
        if (e.timer <= 0 && Math.abs(e.x - (camX + VW / 2)) < VW * 1.2) {
          e.timer = e.period;
          ents.push({ t: "ball", x: e.x, y: e.y, w: 30, h: 30, vx: -150, vy: 0, alive: true, stun: 0, rot: 0 });
        }
        continue;
      }
      if (e.stun > 0) { e.stun -= dt; if (e.t === "crow") { e.y += (e.y0 - e.y) * dt; } if (e.t === "cat") { e.vy += 2100 * dt; e.y += e.vy * dt; collideY(e, e.y + e.h - e.vy * dt); } continue; }
      if (e.t === "cat") {
        e.vy += 2100 * dt; e.x += e.vx * dt;
        if (collideX(e)) e.vx = (e.vx === 0 ? 1 : -Math.sign(e.vx || 1)) * e.speed;
        const pb = e.y + e.h; e.y += e.vy * dt; collideY(e, pb);
        if (e.on) { const ahead = Math.floor((e.vx < 0 ? e.x - 2 : e.x + e.w + 2) / T), row = Math.floor((e.y + e.h + 2) / T); if (!solidAt(ahead, row)) e.vx = -e.vx; }
        if (e.vx === 0) e.vx = e.speed;
        if (e.y > WORLD_H + 100) e.alive = false;
      } else if (e.t === "crow") {
        e.ph += dt;
        if (e.swoop && e.dive <= 0 && Math.abs((p.x + p.w / 2) - (e.x + e.w / 2)) < 170 && p.y > e.y && !p.dead) { e.dive = 1.4; e.diveX = p.x + p.w / 2; e.diveY = p.y + 10; }
        if (e.dive > 0) {
          e.dive -= dt; const k = e.dive > 0.7 ? (1.4 - e.dive) / 0.7 : e.dive / 0.7; // heen en terug
          const tx = e.x0 + (e.diveX - e.x0) * 0.4, ty = e.y0 + (e.diveY - e.y0) * k;
          e.x += (tx - e.x) * dt * 3; e.y = ty;
        } else {
          const nx = e.x0 + Math.sin(e.ph * 0.9) * e.range * T;
          e.dir = nx < e.x ? -1 : 1; e.x = nx; e.y = e.y0 + Math.sin(e.ph * 3) * 10;
        }
      } else if (e.t === "ball") {
        e.vy += 2100 * dt; e.x += e.vx * dt; e.rot += e.vx * dt / 15;
        if (collideX(e)) { e.alive = false; burst(e.x, e.y + 15, "#fff", 12); }
        const pb = e.y + e.h; e.y += e.vy * dt; collideY(e, pb);
        if (e.y > WORLD_H + 60 || e.x < camX - 200) e.alive = false;
      }
      // contact met Piet
      if (!p.dead && e.alive && e.stun <= 0 && overlap(pbox, e)) {
        const stomp = p.vy > 50 && p.y + p.h - e.y < 22;
        if (stomp) { stunEnt(e); p.vy = -560; p.jumping = false; }
        else hurt(false);
      }
    }
    ents = ents.filter((e) => e.alive);
    // roetwolken
    for (const c of chims) {
      c.glow -= dt;
      if (!c.smoke) continue;
      c.puffT -= dt;
      if (c.puffT <= 0) { c.puffT = 2.6; for (let k = 0; k < 3; k++) puffs.push({ x: c.x + T / 2, y: c.top - 6 - k * 10, r: 14 + k * 3, vy: -120 - k * 6, life: 1.7 }); }
    }
    for (const f of puffs) {
      f.life -= dt; f.y += f.vy * dt; f.r += dt * 10; f.x += Math.sin(time * 3 + f.y) * 0.3;
      if (!p.dead && f.life > 0.35) { const cx = p.x + p.w / 2, cy = p.y + p.h / 2; if (Math.hypot(cx - f.x, cy - f.y) < f.r + 16) hurt(false); }
    }
    puffs = puffs.filter((f) => f.life > 0);
  }

  function burst(x, y, col, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 220; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.5, col, r: 2 + Math.random() * 3 }); } }
  function hearts3(x, y) { for (let i = 0; i < 4; i++) parts.push({ x: x + (i - 1.5) * 14, y, vx: (i - 1.5) * 20, vy: -140 - i * 20, life: 1.2, heart: true, r: 10 }); }
  function updateFx(dt) {
    for (const q of parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (!q.heart) q.vy += 400 * dt; else q.vx *= 0.98; }
    parts = parts.filter((q) => q.life > 0);
    flashT -= dt;
  }

  /* ---------- tekenen ---------- */
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const lucht = IMG.lucht;
    // lucht (cover)
    if (lucht.width) {
      const s = Math.max(W / lucht.width, H / lucht.height) * 1.08;
      const iw = lucht.width * s, ih = lucht.height * s;
      const ox = -((camX * SC * 0.05) % (iw - W + 1));
      ctx.drawImage(lucht, ox, H - ih, iw, ih);
    } else { ctx.fillStyle = "#14204a"; ctx.fillRect(0, 0, W, H); }
    // sneeuw achter
    drawSnow(0.5);
    // huizen-laag
    const hz = IMG.huizen;
    if (hz.width) {
      const groundScreen = (10 * T - camY) * SC;
      const hh = Math.max(groundScreen * 0.75, 180), hw = hz.width * hh / hz.height;
      const off = (camX * SC * 0.3) % (hw * 2);
      ctx.save(); ctx.globalAlpha = 0.95;
      for (let k = -1; k < W / hw + 2; k++) {
        const x = k * hw - off + Math.floor(off / (hw * 2)) * 0;
        const idx = k + Math.floor((camX * SC * 0.3) / hw);
        ctx.save();
        if (idx % 2 !== 0) { ctx.translate(x + hw, 0); ctx.scale(-1, 1); ctx.drawImage(hz, 0, groundScreen + 60 - hh, hw, hh); }
        else ctx.drawImage(hz, x, groundScreen + 60 - hh, hw, hh);
        ctx.restore();
      }
      ctx.restore();
      ctx.fillStyle = "rgba(14,22,60,0.45)"; ctx.fillRect(0, 0, W, H);
    }
    // wereld
    ctx.setTransform(DPR * SC, 0, 0, DPR * SC, -camX * SC * DPR, -camY * SC * DPR);
    drawTiles();
    drawFlags(); drawEnd();
    drawChims();
    for (const pl of plats) drawPlat(pl);
    for (const e of ents) drawEnt(e);
    for (const f of puffs) { ctx.globalAlpha = Math.min(0.85, f.life); ctx.fillStyle = "#3a3a46"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); ctx.fillStyle = "#5c5c6c"; ctx.beginPath(); ctx.arc(f.x - f.r * 0.3, f.y - f.r * 0.3, f.r * 0.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    drawPlayer();
    for (const s of shots) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      if (s.t === "pakje") ctx.drawImage(IMG[s.img], -15, -16, 30, 32);
      else ctx.drawImage(IMG.pepernoot, -10, -8, 20, 16);
      ctx.restore();
    }
    for (const q of parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2));
      if (q.heart) { ctx.font = "20px sans-serif"; ctx.fillText("❤️", q.x - 10, q.y); }
      else { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    const gy = 11.5 * T, gr = ctx.createLinearGradient(0, gy, 0, gy + 5 * T);
    gr.addColorStop(0, "rgba(8,12,34,0)"); gr.addColorStop(1, "rgba(8,12,34,0.75)");
    ctx.fillStyle = gr; ctx.fillRect(camX - 10, gy, VW + 20, Math.max(5 * T, camY + H / SC - gy + 10));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawSnow(1);
    if (flashT > 0) { ctx.fillStyle = "rgba(255,60,60," + flashT + ")"; ctx.fillRect(0, 0, W, H); }
  }
  function drawSnow(layer) {
    ctx.fillStyle = "rgba(255,255,255," + (layer < 1 ? 0.5 : 0.85) + ")";
    for (let i = layer < 1 ? 0 : 45; i < (layer < 1 ? 45 : 90); i++) {
      const f = snow[i]; if (!f) continue;
      const sp = f.s * layer;
      const x = ((f.x - camX * SC * 0.4 * sp + Math.sin(time + f.ph) * 20) % (W + 40) + W + 40) % (W + 40) - 20;
      const y = ((f.y + time * 40 * f.s) % (H + 20)) - 10;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + f.s * 1.6 * layer, 0, 7); ctx.fill();
    }
  }
  function drawTiles() {
    const c0 = Math.max(0, Math.floor(camX / T) - 1), c1 = Math.min(LV.width - 1, Math.ceil((camX + VW) / T) + 1);
    const bottomRow = Math.ceil((camY + H / SC) / T);
    const tex = IMG.dakpannen;
    for (let c = c0; c <= c1; c++) {
      for (let r = 0; r < 14; r++) {
        const ch = grid[r][c];
        if (ch === "#" || ch === "=") {
          const topExposed = !(grid[r - 1] && (grid[r - 1][c] === "#" || grid[r - 1][c] === "="));
          const x = c * T, y = r * T;
          if (topExposed || r === 10 && false) {
            if (tex.width) ctx.drawImage(tex, (c % 3) * 80, 0, 80, 80, x, y, T + 0.5, T + 0.5); else { ctx.fillStyle = "#b8452c"; ctx.fillRect(x, y, T, T); }
            // tweede rij pannen
            if (tex.width) ctx.drawImage(tex, (c % 3) * 80, 80, 80, 80, x, y + T, T + 0.5, T + 0.5);
            ctx.fillStyle = "rgba(20,30,80,0.18)"; ctx.fillRect(x, y, T + 0.5, T * 2);
            // sneeuwrand / ijs
            if (ch === "=") {
              ctx.fillStyle = "#bfe9ff"; ctx.fillRect(x, y - 6, T + 0.5, 14);
              ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 4 + (c % 2) * 14, y - 4, 10, 3);
              ctx.fillStyle = "#8fd3ff"; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + 6 + k * 13, y + 8); ctx.lineTo(x + 10 + k * 13, y + 8); ctx.lineTo(x + 8 + k * 13, y + 16 + (c + k) % 3 * 3); ctx.fill(); }
            } else {
              ctx.fillStyle = "#f4f8ff";
              ctx.beginPath(); ctx.moveTo(x, y + 6);
              for (let k = 0; k <= 4; k++) ctx.quadraticCurveTo(x + k * 10 - 5, y - 8 - ((c * 7 + k) % 3) * 2, x + k * 10, y + 2);
              ctx.lineTo(x + T + 0.5, y + 8); ctx.lineTo(x, y + 8); ctx.fill();
            }
            // goot / rand
            const lEdge = !(cell(c - 1, r) === "#" || cell(c - 1, r) === "="), rEdge = !(cell(c + 1, r) === "#" || cell(c + 1, r) === "=");
            ctx.fillStyle = "#3a1e18";
            if (lEdge) ctx.fillRect(x, y, 4, T * 2); if (rEdge) ctx.fillRect(x + T - 4, y, 4, T * 2);
          } else if (!(grid[r - 2] && (grid[r - 1][c] === "#" || grid[r - 1][c] === "=") && !(grid[r - 2][c] === "#" || grid[r - 2][c] === "="))) {
            drawFacade(c, r);
          }
        } else if (ch === "-") {
          const x = c * T, y = r * T;
          ctx.fillStyle = "#7a4a26"; ctx.fillRect(x, y, T + 0.5, 12);
          ctx.fillStyle = "#a8703e"; ctx.fillRect(x, y, T + 0.5, 4);
          ctx.fillStyle = "#f4f8ff"; ctx.fillRect(x, y - 4, T + 0.5, 5);
          ctx.fillStyle = "#3a2010"; ctx.fillRect(x + 6, y + 6, 3, 3); ctx.fillRect(x + T - 9, y + 6, 3, 3);
        }
      }
      // gevel tot onder in beeld
      if (grid[13][c] === "#" || grid[13][c] === "=") for (let r = 14; r <= bottomRow; r++) drawFacade(c, r);
    }
  }
  function drawFacade(c, r) {
    const x = c * T, y = r * T;
    const hue = ["#5b2a24", "#4a2a2e", "#2f3a34", "#55301e"][Math.floor(c / 5) % 4];
    ctx.fillStyle = hue; ctx.fillRect(x, y, T + 0.5, T + 0.5);
    ctx.fillStyle = "rgba(0,0,0,0.18)"; for (let k = 0; k < 4; k++) ctx.fillRect(x, y + k * 10 + 9, T, 1);
    if ((c + r) % 2 === 0) {
      const lit = ((c * 13 + r * 7) % 5) < 2;
      ctx.fillStyle = "#e8e4d8"; ctx.fillRect(x + 9, y + 6, 22, 28);
      ctx.fillStyle = lit ? "#ffcf6a" : "#1e2a4a"; ctx.fillRect(x + 11, y + 8, 18, 24);
      ctx.fillStyle = "#e8e4d8"; ctx.fillRect(x + 19, y + 8, 2, 24); ctx.fillRect(x + 11, y + 19, 18, 2);
    }
  }
  function drawChims() {
    const im = IMG.schoorsteen;
    for (const c of chims) {
      if (c.x < camX - 80 || c.x > camX + VW + 80) continue;
      const w = 58, h = 2 * T + 10, x = c.x + T / 2 - w / 2, y = c.top - 10;
      if (c.done || c.glow > 0) { ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 4); ctx.fillStyle = "#ffd76a"; ctx.beginPath(); ctx.arc(c.x + T / 2, c.top, 34, 0, 7); ctx.fill(); ctx.restore(); }
      if (im.width) ctx.drawImage(im, x, y, w, h); else { ctx.fillStyle = "#a33"; ctx.fillRect(c.x, c.top, T, 2 * T); }
      if (!c.done) {
        // pijltje: hier moet een pakje in
        const bob = Math.sin(time * 4 + c.col) * 5;
        ctx.fillStyle = "#ffd76a"; ctx.beginPath(); ctx.moveTo(c.x + T / 2 - 10, c.top - 46 + bob); ctx.lineTo(c.x + T / 2 + 10, c.top - 46 + bob); ctx.lineTo(c.x + T / 2, c.top - 30 + bob); ctx.fill();
      } else {
        ctx.font = "22px sans-serif"; ctx.fillText("✔️", c.x + 8, c.top - 18);
      }
    }
  }
  function drawPlat(pl) {
    const x = pl.x, y = pl.y;
    ctx.fillStyle = "#6a3e1e"; ctx.fillRect(x, y, pl.w, pl.h);
    ctx.fillStyle = "#9c6534"; ctx.fillRect(x, y, pl.w, 5);
    ctx.fillStyle = "#f4f8ff"; ctx.fillRect(x + 2, y - 4, pl.w - 4, 5);
    ctx.strokeStyle = "#caa060"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 8, y - 600); ctx.moveTo(x + pl.w - 8, y); ctx.lineTo(x + pl.w - 8, y - 600); ctx.stroke();
  }
  function drawFlags() {
    for (const f of flags) {
      ctx.fillStyle = "#d8c08a"; ctx.fillRect(f.x - 2, f.y - 90, 4, 90);
      const wave = Math.sin(time * 5) * 4;
      ctx.fillStyle = f.on ? "#ffd76a" : "#9a2234";
      ctx.beginPath(); ctx.moveTo(f.x + 2, f.y - 90); ctx.lineTo(f.x + 44, f.y - 78 + wave); ctx.lineTo(f.x + 2, f.y - 62); ctx.fill();
      ctx.fillStyle = f.on ? "#9a2234" : "#ffd76a"; ctx.fillRect(f.x + 14, f.y - 82, 3, 14); ctx.fillRect(f.x + 9, f.y - 77, 13, 3);
    }
  }
  function drawEnd() {
    const im = IMG.zak; const w = 96, h = 92;
    ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 3); ctx.fillStyle = "#ffe9a0"; ctx.beginPath(); ctx.arc(endObj.x, endObj.y - 46, 70, 0, 7); ctx.fill(); ctx.restore();
    if (im.width) ctx.drawImage(im, endObj.x - w / 2, endObj.y - h + 2 + Math.sin(time * 2) * 2, w, h);
  }
  function drawEnt(e) {
    if (!e.alive) return;
    if (e.x < camX - 100 || e.x > camX + VW + 100) return;
    if (e.t === "pep") { const b = Math.sin(time * 4 + e.x) * 3; ctx.drawImage(IMG.pepernoot, e.x - 13, e.y - 10 + b, 26, 21); return; }
    if (e.t === "heart") { ctx.font = "30px sans-serif"; ctx.fillText("❤️", e.x - 16, e.y + 10 + Math.sin(time * 3) * 3); return; }
    if (e.t === "balls") { return; }
    ctx.save();
    if (e.t === "cat") {
      const im = IMG.kat; const w = 66, h = 40;
      ctx.translate(e.x + e.w / 2, e.y + e.h);
      if (e.vx > 0) ctx.scale(-1, 1);
      if (e.stun > 0) ctx.rotate(Math.sin(time * 10) * 0.05);
      ctx.drawImage(im, -w / 2, -h + 2 + (e.stun > 0 ? 0 : Math.abs(Math.sin(time * 8)) * -2), w, h);
    } else if (e.t === "crow") {
      const im = IMG.kraai; const w = 56, h = 48;
      ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
      if (e.dir > 0) ctx.scale(-1, 1);
      const flap = e.stun > 0 ? 1 : 0.8 + Math.abs(Math.sin(time * 9)) * 0.3;
      ctx.scale(1, flap);
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
    } else if (e.t === "ball") {
      ctx.translate(e.x + 15, e.y + 15); ctx.rotate(e.rot);
      ctx.fillStyle = "#f6fbff"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
      ctx.fillStyle = "#cfe3f5"; ctx.beginPath(); ctx.arc(4, 5, 7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(-6, -3, 3, 0, 7); ctx.fill();
    }
    ctx.restore();
    if (e.stun > 0) { ctx.font = "16px sans-serif"; for (let k = 0; k < 3; k++) { const a = time * 4 + k * 2.1; ctx.fillText("⭐", e.x + e.w / 2 + Math.cos(a) * 18 - 8, e.y - 8 + Math.sin(a) * 6); } }
  }
  function drawPlayer() {
    const p = P; if (!p) return;
    if (p.inv > 0 && !p.dead && Math.floor(time * 12) % 2 === 0) return;
    let im = IMG["piet-staan"];
    if (p.throwT > 0) im = IMG["piet-gooien"];
    else if (!p.on) im = IMG["piet-springen"];
    else if (Math.abs(p.vx) > 30) im = Math.floor(p.anim * 1.6) % 2 ? IMG["piet-rennen"] : IMG["piet-staan"];
    if (!im.width) { ctx.fillStyle = "#c33"; ctx.fillRect(p.x, p.y, p.w, p.h); return; }
    const h = 92, w = im.width * h / im.height;
    ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h + 2);
    if (p.face < 0) ctx.scale(-1, 1);
    if (p.dead) ctx.rotate(0.4);
    const sq = p.on && Math.abs(p.vx) > 30 ? 1 + Math.sin(p.anim * 10) * 0.02 : 1;
    ctx.scale(1, sq);
    ctx.drawImage(im, -w / 2, -h, w, h);
    ctx.restore();
  }

  /* ---------- HUD & schermen ---------- */
  function updHud() {
    $("#hud-hearts").textContent = "❤️".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, 3 - hearts));
    $("#hud-pakjes").textContent = delivered + "/" + (chims ? chims.length : 0);
    $("#hud-pep").textContent = pepCount;
  }
  let bannerT = null;
  function banner(big, small, ms) {
    const b = $("#banner"); b.innerHTML = (big || "") + (small ? "<small>" + small + "</small>" : "");
    b.classList.remove("hidden"); b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.add("hidden"), ms || 1500);
  }
  let keysT = null;
  function showKeys(on, ms) { $("#keyguide").classList.toggle("hidden", !on); clearTimeout(keysT); if (on && ms) keysT = setTimeout(() => $("#keyguide").classList.add("hidden"), ms); }
  function toggleKeys() { showKeys($("#keyguide").classList.contains("hidden")); }
  $("#btn-keys").onclick = () => toggleKeys();
  if (isTouch) $("#btn-keys").classList.add("hidden");

  function showScreen(id) {
    setTimeout(checkRotate, 0);
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("on", s.id === id));
    if (id) { $("#hud").classList.add("hidden"); $("#touch").classList.add("hidden"); showKeys(false); }
  }
  /* ---------- volledig scherm, liggend ---------- */
  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = !!navigator.standalone || matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
  function lockLandscape() { try { const o = screen.orientation; if (o && o.lock) o.lock("landscape").catch(() => {}); } catch (e) {} }
  function goFull() {
    if (!isTouch) return;
    const de = document.documentElement;
    const req = de.requestFullscreen || de.webkitRequestFullscreen;
    const inFull = document.fullscreenElement || document.webkitFullscreenElement;
    if (!inFull && req && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      try { const pr = req.call(de, { navigationUI: "hide" }); if (pr && pr.then) pr.then(lockLandscape, () => {}); else lockLandscape(); } catch (e) {}
    } else lockLandscape();
  }
  if (isIOS && !standalone) $("#ios-tip").classList.remove("hidden");
  /* ---------- draai-je-telefoon ---------- */
  const CALLMODES = ["ring", "call", "ended"];
  let rotPaused = false;
  function checkRotate() {
    const need = isTouch && portrait && !CALLMODES.includes(mode);
    $("#rotate").classList.toggle("hidden", !need);
    if (need && mode === "play") { pause(); rotPaused = true; }
    if (!need && rotPaused && mode === "pause") { rotPaused = false; resume(); }
    if (!need) rotPaused = false;
  }
  checkRotate();

  function menu() {
    mode = "menu"; A.stopMusic();
    const box = $("#levels"); box.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const b = document.createElement("button");
      const locked = i + 1 > save.unlocked;
      b.className = "lvl" + (locked ? " locked" : "") + (i === 2 ? " hard" : "");
      b.dataset.level = i + 1;
      const st = save.stars[i] || 0;
      b.innerHTML = (locked ? "🔒" : String(i + 1)) + '<span class="st">' + (locked ? "" : "★".repeat(st) + "☆".repeat(3 - st)) + "</span>";
      b.onclick = () => { if (locked) { A.sfx("tik"); return; } goFull(); A.ensure(); A.loadVoice(VOICES); startLevel(i); };
      box.appendChild(b);
    }
    $("#btn-geluid").textContent = save.music !== false ? "🔊" : "🔇";
    showScreen("scr-menu");
  }
  const VOICES = ["piet-start", "piet-raak", "piet-allemaal", "piet-au", "piet-level3", "piet-gelukt"];
  $("#btn-geluid").onclick = () => { save.music = !(save.music !== false); store(); A.setMusic(save.music); $("#btn-geluid").textContent = save.music ? "🔊" : "🔇"; };
  // verborgen ouder-reset: 7 keer op de titel tikken
  let titleTaps = 0;
  $("#menu-title").addEventListener("click", () => {
    titleTaps++;
    if (titleTaps >= 7) { titleTaps = 0; if (window.confirm("Opnieuw beginnen? (ook het telefoontje)")) { localStorage.removeItem(KEY); save = loadSave(); menu(); } }
    setTimeout(() => { titleTaps = Math.max(0, titleTaps - 1); }, 2500);
  });

  function pause() { if (mode !== "play") return; mode = "pause"; A.stopMusic(); showScreen("scr-pause"); }
  function resume() { mode = "play"; showScreen(null); $("#hud").classList.remove("hidden"); $("#touch").classList.toggle("hidden", !(isTouch || usedTouch)); A.startMusic(); last = performance.now(); }
  $("#btn-pause").onclick = pause;
  $("#btn-verder").onclick = resume;
  $("#btn-opnieuw").onclick = () => startLevel(levelIndex);
  $("#btn-menu").onclick = menu;

  function winLevel() {
    if (mode !== "play") return;
    mode = "result"; A.stopMusic(); A.sfx("gelukt"); A.say("piet-gelukt");
    const n = chims.length;
    const stars = 1 + (delivered >= Math.ceil(n / 2) ? 1 : 0) + (delivered === n ? 1 : 0);
    save.stars[levelIndex] = Math.max(save.stars[levelIndex] || 0, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(3, levelIndex + 2));
    if (levelIndex === 2) save.done3 = true;
    store();
    $("#res-stars").innerHTML = [0, 1, 2].map((k) => '<span class="' + (k < stars ? "" : "off") + '">⭐</span>').join("");
    $("#res-pakjes").textContent = delivered + "/" + n;
    $("#res-pep").textContent = pepGot;
    if (levelIndex === 2) {
      $("#fin-stars").innerHTML = $("#res-stars").innerHTML;
      setTimeout(() => { if (mode === "result") showScreen("scr-final"); }, 300);
    } else setTimeout(() => { if (mode === "result") showScreen("scr-result"); }, 300);
  }
  $("#res-opnieuw").onclick = () => startLevel(levelIndex);
  $("#res-menu").onclick = menu;
  $("#fin-menu").onclick = menu;
  $("#res-verder").onclick = () => {
    if (levelIndex === 0 && !save.belDone) openSint();
    else startLevel(Math.min(2, levelIndex + 1));
  };

  /* ---------- tussenstuk: Sinterklaas belt mama ---------- */
  const vVraag = $("#vid-vraag"), vBelt = $("#vid-belt");
  function openSint() {
    mode = "sint"; showScreen("scr-sint");
    try { vVraag.currentTime = 0; const pr = vVraag.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
  }
  $("#btn-slaover").onclick = () => { try { vVraag.pause(); } catch (e) {} startLevel(1); };
  $("#btn-bel").onclick = () => {
    try { vVraag.pause(); } catch (e) {}
    mode = "ring"; showScreen("scr-ring"); A.ring();
    // video alvast laden
    try { vBelt.load(); } catch (e) {}
  };
  let callStart = 0, callTimer = null, callOver = false;
  function fmt(s) { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  $("#btn-opnemen").onclick = () => {
    A.stopRing(); mode = "call"; callOver = false; showScreen("scr-incall");
    callStart = performance.now();
    $("#call-time").textContent = "00:00";
    callTimer = setInterval(() => { $("#call-time").textContent = fmt((performance.now() - callStart) / 1000); }, 250);
    try { vBelt.currentTime = 0; vBelt.muted = false; const pr = vBelt.play(); if (pr && pr.catch) pr.catch(() => { vBelt.controls = true; }); } catch (e) {}
  };
  function endCall() {
    if (callOver) return; callOver = true;
    clearInterval(callTimer);
    try { vBelt.pause(); } catch (e) {}
    save.belDone = true; store();
    $("#call-time-end").textContent = fmt((performance.now() - callStart) / 1000);
    mode = "ended"; showScreen("scr-ended");
    A.ensure(); [0, 450, 900].forEach((d) => setTimeout(() => A.sfx("beep"), d));
    setTimeout(() => $("#btn-na-bel").classList.remove("hidden"), 1800);
  }
  vBelt.addEventListener("ended", endCall);
  $("#btn-ophangen").onclick = endCall;
  $("#btn-na-bel").onclick = () => { $("#btn-na-bel").classList.add("hidden"); startLevel(1); };

  /* ---------- lus ---------- */
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === "play") { const steps = Math.ceil(dt / 0.0167); for (let k = 0; k < steps; k++) update(dt / steps); }
    if (LV && (mode === "play" || mode === "pause" || mode === "result")) draw();
    else drawMenuBg(now / 1000);
    requestAnimationFrame(frame);
  }
  function drawMenuBg(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = "#0c1433"; ctx.fillRect(0, 0, W, H);
  }

  /* ---------- start ---------- */
  ready.then(() => {
    menu();
    if (qs.has("level")) { const n = Math.max(1, Math.min(3, parseInt(qs.get("level"), 10) || 1)); if (DEBUG) startLevel(n - 1); }
  });
  requestAnimationFrame(frame);
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("../sw.js", { scope: "../", updateViaCache: "none" }).catch(() => {});

  if (DEBUG) window.PS = {
    start: (n) => startLevel(n - 1), win: winLevel, god: (v) => { god = v; },
    state: () => ({ mode, level: levelIndex + 1, x: P && P.x, y: P && P.y, on: P && P.on, delivered, chims: chims.length, hearts, pep: pepCount, save: Object.assign({}, save), camX, W, H, SC, DPR, portrait, cvW: cv.width, cvH: cv.height, dead: P && !!P.dead }),
    input: inp, keys, teleport: (col, row) => { P.x = col * T + 5; P.y = (row + 1) * T - P.h; P.vx = 0; P.vy = 0; },
    level: () => LV, chimneys: () => chims, menu, openSint,
    world: () => ({ P, plats, ents, chims, LV, puffs, shots, T, mode }), solidAt: (c, r) => solidAt(c, r), cell: (c, r) => cell(c, r),
  };
})();
