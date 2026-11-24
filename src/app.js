(function () {
  "use strict";

  const C = window.SINT_CONFIG;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  const PIET_TXT = {
    intro: "Hoi " + C.playerFirst + "! Mag jij een foto maken van de ruimte waar je nu bent?",
    cold: [
      "Brrr, ijskoud! Hier ligt alleen een sok.",
      "Nee hoor, koud als ijs! Hier is de zak vast niet.",
      "Brrr, ik krijg er kippenvel van! Nog steeds koud.",
    ],
    again: [
      "Probeer eens een andere hoek. Maak nog een foto!",
      "Nog één keertje, misschien ergens anders?",
    ],
    fridge: "Hmm… ik weet het zelf ook niet meer zo goed. Kun jij een foto maken van de koelkast?",
    hangt: "Hé, wat hangt daar?!",
    tap: "Tik op de foto om hem groter te zien.",
    code: "Op de zak hangt een briefje met een geheime code. Tik de code in als je de zak hebt gevonden!",
    wrong: "Helaas, dat is niet de juiste code. Kijk nog eens op het briefje!",
    found: "Hoera! Je hebt de zak gevonden!",
    oorkonde: "Gefeliciteerd, " + C.playerFirst + "! Jij bent nu Officiële Hulppiet!",
  };

  const LYRICS = (window.LIED_CUES && window.LIED_CUES.cues) || [
    { t: 0, text: "De zak van Sinterklaas," },
    { t: 2.2, text: "Sinterklaas, Sinterklaas," },
    { t: 4.4, text: "de zak van Sinterklaas," },
    { t: 7.2, text: "o jongens, jongens, 't is zo'n baas!" },
    { t: 10, text: "Daar stopt hij, daar stopt hij," },
    { t: 12.2, text: "daar stopt hij blij van zin." },
    { t: 14.4, text: "De hele, de hele," },
    { t: 16.6, text: "de hele wereld in!" },
    { t: 18.8, text: "De zak van Sinterklaas," },
    { t: 21, text: "Sinterklaas, Sinterklaas," },
    { t: 23.2, text: "de zak van Sinterklaas," },
    { t: 26, text: "o jongens, jongens, 't is zo'n baas!" },
  ];

  const state = {
    stage: "start",
    coldCount: 0,
    pepernoten: 0,
    code: "",
    unlocked: false,
    fridgePhoto: null,
    fridgeComposite: null,
    lastPhoto: null,
    camStream: null,
    titleTaps: 0,
    audioUnlocked: false,
  };

  const audio = {
    ctx: null,
    els: {},
    current: null,
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(C.storageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      state.stage = s.stage || "start";
      state.coldCount = s.coldCount || 0;
      state.pepernoten = s.pepernoten || 0;
      state.unlocked = !!s.unlocked;
      state.fridgeComposite = s.fridgeComposite || null;
      if (state.stage === "start") return;
      // Don't resume in the middle of a live camera session
      if (state.stage === "foto") state.stage = "piet-intro";
      if (state.stage === "koelkast-foto") state.stage = "koelkast-vraag";
    } catch (e) { /* ignore */ }
  }

  function saveState() {
    try {
      localStorage.setItem(
        C.storageKey,
        JSON.stringify({
          stage: state.stage,
          coldCount: state.coldCount,
          pepernoten: state.pepernoten,
          unlocked: state.unlocked,
          fridgeComposite: state.fridgeComposite,
        })
      );
    } catch (e) {
      // Quota: drop the photo, keep progress
      try {
        localStorage.setItem(
          C.storageKey,
          JSON.stringify({
            stage: state.stage,
            coldCount: state.coldCount,
            pepernoten: state.pepernoten,
            unlocked: state.unlocked,
          })
        );
      } catch (e2) { /* ignore */ }
    }
  }

  function resetAll() {
    stopCam();
    stopAudio();
    localStorage.removeItem(C.storageKey);
    state.stage = "start";
    state.coldCount = 0;
    state.pepernoten = 0;
    state.code = "";
    state.unlocked = false;
    state.fridgePhoto = null;
    state.fridgeComposite = null;
    state.lastPhoto = null;
    state.titleTaps = 0;
    show("start");
  }

  var swUpdatePending = false;
  var swReloadOnce = false;

  function midVideoNow() {
    if (state.stage === "sint" || state.stage === "gevonden") return true;
    try {
      const v = document.getElementById("sint-video");
      if (v && !v.paused && !v.ended && v.currentTime > 0) return true;
    } catch (e) {}
    return false;
  }

  function maybeReloadForSw() {
    if (!swUpdatePending || swReloadOnce) return;
    if (midVideoNow()) return;
    if (state.stage && state.stage !== "start") return;
    swReloadOnce = true;
    try { sessionStorage.setItem("sint_sw_reloaded", "1"); } catch (e) {}
    location.reload();
  }

  function hardResetForParent() {
    const msg = "Opnieuw beginnen? Dit wist de voortgang op dit apparaat en laadt de nieuwste versie van de speurtocht.";
    if (!window.confirm(msg)) return;
    stopCam();
    stopAudio();
    try { localStorage.removeItem(C.storageKey); } catch (e) {}
    function go() {
      try {
        const u = new URL(location.href);
        u.searchParams.set("r", String(Date.now()));
        location.replace(u.href);
      } catch (e2) {
        location.reload();
      }
    }
    const jobs = [];
    if ("serviceWorker" in navigator) {
      jobs.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        })
      );
    }
    if (window.caches && caches.keys) {
      jobs.push(
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        })
      );
    }
    Promise.all(jobs).then(go, go);
  }

  function initServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      if (sessionStorage.getItem("sint_sw_reloaded")) {
        sessionStorage.removeItem("sint_sw_reloaded");
      }
    } catch (e) {}
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController) {
        hadController = true;
        return;
      }
      swUpdatePending = true;
      maybeReloadForSw();
    });
    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .then(function (reg) {
        try { reg.update(); } catch (e) {}
        if (reg.waiting && hadController) {
          swUpdatePending = true;
          maybeReloadForSw();
        }
        reg.addEventListener("updatefound", function () {
          const inst = reg.installing;
          if (!inst) return;
          inst.addEventListener("statechange", function () {
            if (inst.state === "activated" && hadController) {
              swUpdatePending = true;
              maybeReloadForSw();
            }
          });
        });
      })
      .catch(function () {});
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible" || state.stage !== "start") return;
      navigator.serviceWorker.getRegistration("sw.js").then(function (reg) {
        if (reg) try { reg.update(); } catch (e) {}
      });
      maybeReloadForSw();
    });
  }

  /* ---------- audio ---------- */
  function premake(src, id) {
    const a = new Audio(src);
    a.preload = "auto";
    a.setAttribute("playsinline", "");
    audio.els[id] = a;
    return a;
  }

  function initAudioBank() {
    premake("assets/audio/stil.mp3", "stil");
    premake("assets/audio/sint-rijm.mp3", "sint");
    premake("assets/audio/strooi.mp3", "strooi");
    premake("assets/audio/flits.mp3", "flits");
    premake("assets/audio/fonkel.mp3", "fonkel");
    premake("assets/audio/fout.mp3", "fout");
    premake("assets/audio/goed.mp3", "goed");
    premake("assets/audio/tik.mp3", "tik");
    premake("assets/audio/hinnik.mp3", "hinnik");
    premake("assets/audio/zak-lied.mp3", "lied");
    [
      "intro", "cold1", "cold2", "cold3", "again1", "again2",
      "fridge", "hangt", "code", "wrong", "found", "oorkonde",
      "pep_veel", "tap",
    ].forEach((k) => premake("assets/audio/piet-" + k + ".mp3", "piet-" + k));
    [
      "0", "1", "paar", "handjevol",
      "12", "15", "20", "25", "30", "40", "50", "60", "70", "80", "90", "100",
      "150", "200", "250", "300", "350", "400", "450", "500",
      "600", "700", "800", "900", "bijna1000",
    ].forEach((k) => premake("assets/audio/piet-pep-" + k + ".mp3", "piet-pep-" + k));
  }

  async function unlockAudio() {
    if (state.audioUnlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audio.ctx = audio.ctx || new AC();
        if (audio.ctx.state === "suspended") await audio.ctx.resume();
        const buf = audio.ctx.createBuffer(1, 1, 22050);
        const src = audio.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(audio.ctx.destination);
        src.start(0);
      }
      const s = audio.els.stil;
      if (s) {
        s.currentTime = 0;
        await s.play().catch(function () {});
      }
      state.audioUnlocked = true;
    } catch (e) {
      state.audioUnlocked = true;
    }
  }

  function stopAudio() {
    if (audio.current) {
      try { audio.current.pause(); audio.current.currentTime = 0; } catch (e) {}
      audio.current = null;
    }
    Object.keys(audio.els).forEach((k) => {
      const a = audio.els[k];
      if (a && !a.paused) {
        try { a.pause(); a.currentTime = 0; } catch (e) {}
      }
    });
  }

  function play(id, { loop = false, onend } = {}) {
    const a = audio.els[id];
    if (!a) return Promise.resolve();
    stopAudio();
    a.loop = !!loop;
    a.currentTime = 0;
    audio.current = a;
    const p = a.play().catch(function () {});
    if (onend) {
      const done = function () {
        a.removeEventListener("ended", done);
        onend();
      };
      a.addEventListener("ended", done);
    }
    return p;
  }

  function playChain(ids, ondone) {
    let i = 0;
    const next = function () {
      if (i >= ids.length) {
        if (ondone) ondone();
        return;
      }
      const id = ids[i++];
      const a = audio.els[id];
      if (!a) return next();
      stopAudio();
      a.currentTime = 0;
      audio.current = a;
      const done = function () {
        a.removeEventListener("ended", done);
        next();
      };
      a.addEventListener("ended", done);
      a.play().catch(next);
    };
    next();
  }

  function pepLineId(n) {
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (n <= 0) return "piet-pep-0";
    if (n === 1) return "piet-pep-1";
    if (n <= 4) return "piet-pep-paar";
    if (n <= 10) return "piet-pep-handjevol";
    const buckets = [
      [13, "12"], [17, "15"], [22, "20"], [27, "25"], [34, "30"],
      [44, "40"], [54, "50"], [64, "60"], [74, "70"], [84, "80"],
      [94, "90"], [124, "100"], [174, "150"], [224, "200"],
      [274, "250"], [324, "300"], [374, "350"], [424, "400"],
      [474, "450"], [549, "500"], [649, "600"], [749, "700"],
      [849, "800"], [924, "900"], [999, "bijna1000"],
    ];
    for (let i = 0; i < buckets.length; i++) {
      if (n <= buckets[i][0]) return "piet-pep-" + buckets[i][1];
    }
    return "piet-pep_veel";
  }

  function showPepCount(n) {
    const el = $("#pep-count");
    if (!el) return;
    const word = n === 1 ? "pepernoot" : "pepernoten";
    el.textContent = "🍪 " + n + " " + word;
    el.hidden = false;
  }

  function speakPepernoten(n, ondone) {
    showPepCount(n);
    play(pepLineId(n), { onend: ondone });
  }

  function buzz(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern || [180, 80, 180]);
    } catch (e) {}
  }

  /* ---------- screens ---------- */
  function show(name) {
    state.stage = name;
    $$(".screen").forEach((s) => s.classList.toggle("on", s.id === "screen-" + name));
    saveState();
    if (name === "start") maybeReloadForSw();
  }

  function render() {
    const stage = state.stage;
    if (stage === "start") show("start");
    else if (stage === "sint") openSint();
    else if (stage === "piet-intro") openPietIntro();
    else if (stage === "foto") openCamera("room");
    else if (stage === "koud") openKoud();
    else if (stage === "koelkast-vraag") openFridgeAsk();
    else if (stage === "koelkast-foto") openCamera("fridge");
    else if (stage === "polaroid") openPolaroid();
    else if (stage === "code") openCode();
    else if (stage === "gevonden") openGevonden();
    else if (stage === "oorkonde") openOorkonde();
    else show("start");
  }

  /* ---------- start ---------- */
  function openStart() {
    show("start");
  }

  /* ---------- sint ---------- */
  function openSint() {
    show("sint");
    const vid = $("#sint-video");
    const img = $("#sint-still");
    const hasVid = vid && vid.getAttribute("data-has") === "1";
    if (hasVid) {
      vid.style.display = "block";
      if (img) img.style.display = "none";
      vid.currentTime = 0;
      const p = vid.play();
      if (p) p.catch(function () {
        // iOS might need muted then unmute — we already unlocked from a tap
        vid.muted = false;
        vid.play().catch(function () {});
      });
    } else {
      if (vid) vid.style.display = "none";
      if (img) { img.style.display = "block"; img.classList.add("talking"); }
    }
    play("sint");
  }

  function replaySint() {
    play("sint");
    const vid = $("#sint-video");
    if (vid && vid.getAttribute("data-has") === "1") {
      vid.currentTime = 0;
      vid.play().catch(function () {});
    }
  }

  /* ---------- piet helpers ---------- */
  function setPiet(pose, text) {
    const img = $("#piet-img");
    if (img) img.src = "assets/images/piet-" + pose + ".png";
    const b = $("#piet-bubble");
    if (b) b.textContent = text;
  }

  function openPietIntro() {
    stopCam();
    const v = $("#sint-video");
    if (v) try { v.pause(); } catch (e) {}
    stopAudio();
    show("piet");
    setPiet("talking", PIET_TXT.intro);
    $("#piet-actions").innerHTML = '<button class="btn big" id="btn-foto-gaan">Ik maak een foto</button>';
    $("#btn-foto-gaan").onclick = function () { openCamera("room"); };
    play("piet-intro");
  }

  function openKoud() {
    show("piet");
    const i = Math.min(state.coldCount - 1, 2);
    setPiet("cold", PIET_TXT.cold[i]);
    const nextLabel = state.coldCount >= C.coldNeeded ? "Verder" : "Nog een foto";
    $("#piet-actions").innerHTML =
      '<div class="thermo-wrap"><div class="thermo" id="thermo"><div class="fill"></div></div><div class="thermo-label">koud!</div></div>' +
      '<button class="btn big" id="btn-volgende-foto">' + nextLabel + '</button>';
    requestAnimationFrame(function () { $("#thermo").classList.add("cold"); });
    buzz([200, 80, 200, 80, 280]);
    play("piet-cold" + (i + 1), {
      onend: function () {
        if (state.coldCount >= C.coldNeeded) {
          // After the third cold, Piet admits he doesn't know
          setTimeout(openFridgeAsk, 400);
        } else {
          const a = PIET_TXT.again[Math.min(i, 1)];
          setPiet("talking", a);
          play("piet-again" + (i + 1));
        }
      },
    });
    $("#btn-volgende-foto").onclick = function () {
      if (state.coldCount >= C.coldNeeded) openFridgeAsk();
      else openCamera("room");
    };
  }

  function openFridgeAsk() {
    show("piet");
    setPiet("thinking", PIET_TXT.fridge);
    $("#piet-actions").innerHTML = '<button class="btn big" id="btn-koelkast">Foto van de koelkast</button>';
    $("#btn-koelkast").onclick = function () { openCamera("fridge"); };
    play("piet-fridge");
    state.stage = "koelkast-vraag";
    saveState();
  }

  /* ---------- camera + strooi ---------- */
  let strooiParticles = [];
  let strooiRaf = 0;
  const strooiCanvas = function () { return $("#strooi-canvas"); };

  function ensureStrooiLoop() {
    if (strooiRaf) return;
    const c = strooiCanvas();
    const ctx = c.getContext("2d");
    const img = new Image();
    img.src = "assets/images/pepernoot.png";
    function resize() {
      c.width = window.innerWidth * (window.devicePixelRatio || 1);
      c.height = window.innerHeight * (window.devicePixelRatio || 1);
      c.style.width = window.innerWidth + "px";
      c.style.height = window.innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);
    function tick() {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, c.width, c.height);
      strooiParticles = strooiParticles.filter((p) => p.y < c.height / dpr + 80 && p.life > 0);
      strooiParticles.forEach((p) => {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;
        p.life -= 1;
        ctx.save();
        ctx.translate(p.x * dpr, p.y * dpr);
        ctx.rotate(p.rot);
        const s = p.s * dpr;
        if (img.complete && img.naturalWidth) {
          ctx.drawImage(img, -s / 2, -s / 2, s, s);
        } else {
          ctx.fillStyle = "#a05a2c";
          ctx.beginPath();
          ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      if (strooiParticles.length) strooiRaf = requestAnimationFrame(tick);
      else strooiRaf = 0;
    }
    strooiRaf = requestAnimationFrame(tick);
    ensureStrooiLoop._tick = tick;
    ensureStrooiLoop._resize = resize;
  }

  function strooi(n) {
    n = n || 16;
    const w = window.innerWidth;
    for (let i = 0; i < n; i++) {
      strooiParticles.push({
        x: Math.random() * w,
        y: -20 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        g: 0.18 + Math.random() * 0.12,
        s: 28 + Math.random() * 28,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.25,
        life: 240,
      });
    }
    state.pepernoten += n;
    updateCounter();
    saveState();
    const s = audio.els.strooi;
    if (s) {
      try {
        s.currentTime = 0;
        s.play().catch(function () {});
      } catch (e) {}
    }
    ensureStrooiLoop();
    if (ensureStrooiLoop._tick && !strooiRaf) {
      strooiRaf = requestAnimationFrame(ensureStrooiLoop._tick);
    }
  }

  function updateCounter() {
    $$(".counter").forEach((el) => {
      el.textContent = "🍪 " + state.pepernoten;
    });
  }

  function stopCam() {
    if (state.camStream) {
      state.camStream.getTracks().forEach((t) => t.stop());
      state.camStream = null;
    }
    const v = $("#cam-video");
    if (v) v.srcObject = null;
  }

  async function openCamera(mode) {
    stopAudio();
    state.stage = mode === "fridge" ? "koelkast-foto" : "foto";
    saveState();
    show("camera");
    $("#cam-hint").textContent = mode === "fridge" ? "Maak een foto van de koelkast" : "Maak een foto van de ruimte";
    updateCounter();
    $("#btn-snap").onclick = function () { snap(mode); };
    $("#btn-strooi").onclick = function () { strooi(14 + Math.floor(Math.random() * 10)); };
    const file = $("#file-input");
    file.value = "";
    file.onchange = function () {
      const f = file.files && file.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = function () {
        const data = drawToData(im, im.naturalWidth, im.naturalHeight);
        URL.revokeObjectURL(url);
        afterPhoto(mode, data);
      };
      im.src = url;
    };
    $("#btn-kies-foto").onclick = function () { file.click(); };

    const video = $("#cam-video");
    video.style.display = "block";
    $("#cam-preview").style.display = "none";
    try {
      if (state.camStream) stopCam();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      state.camStream = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "");
      video.muted = true;
      await video.play().catch(function () {});
    } catch (e) {
      // File input is the fallback (and what Playwright uses)
    }
  }

  function drawToData(src, sw, sh) {
    const max = 1280;
    let w = sw, h = sh;
    if (Math.max(w, h) > max) {
      const s = max / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(src, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.72);
  }

  function snap(mode) {
    play("flits");
    const video = $("#cam-video");
    if (video && video.videoWidth) {
      afterPhoto(mode, drawToData(video, video.videoWidth, video.videoHeight));
      return;
    }
    // No live camera: open the file picker (tests + permission denied)
    $("#file-input").click();
  }

  function afterPhoto(mode, dataUrl) {
    state.lastPhoto = dataUrl;
    const prev = $("#cam-preview");
    prev.src = dataUrl;
    prev.style.display = "block";
    $("#cam-video").style.display = "none";
    stopCam();
    if (mode === "fridge") {
      state.fridgePhoto = dataUrl;
      state.stage = "polaroid";
      saveState();
      setTimeout(openPolaroid, 350);
    } else {
      state.coldCount += 1;
      state.stage = "koud";
      saveState();
      setTimeout(openKoud, 280);
    }
  }

  /* ---------- polaroid ---------- */
  function makeComposite(fridgeUrl, plekUrl) {
    return new Promise(function (resolve) {
      const fridge = new Image();
      const plek = new Image();
      const mag = new Image();
      let left = 3;
      function tick() {
        if (--left) return;
        const w = 1280, h = 960;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        // cover
        const scale = Math.max(w / fridge.naturalWidth, h / fridge.naturalHeight);
        const dw = fridge.naturalWidth * scale, dh = fridge.naturalHeight * scale;
        ctx.drawImage(fridge, (w - dw) / 2, (h - dh) / 2, dw, dh);
        // polaroid (portrait, whole door visible)
        const pad = 12, cap = 36;
        const innerW = Math.round(w * 0.22);
        const innerH = Math.round(innerW * 16 / 9);
        const pw = innerW + pad * 2, ph = innerH + pad + cap;
        const px = Math.round(w * 0.5 - pw / 2), py = Math.round(h * 0.42 - ph / 2);
        ctx.save();
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate((-7 * Math.PI) / 180);
        ctx.shadowColor = "rgba(0,0,0,.45)";
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = "#f7f3ea";
        ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
        ctx.shadowColor = "transparent";
        const ix = -pw / 2 + pad, iy = -ph / 2 + pad;
        const iw = plek.naturalWidth || 1, ih = plek.naturalHeight || 1;
        const fit = Math.min(innerW / iw, innerH / ih);
        const pdw = iw * fit, pdh = ih * fit;
        ctx.drawImage(plek, ix + (innerW - pdw) / 2, iy + (innerH - pdh) / 2, pdw, pdh);
        ctx.fillStyle = "#333";
        ctx.font = "20px Fredoka, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("de plek", 0, ph / 2 - 14);
        if (mag.naturalWidth) {
          const mw = 70;
          ctx.drawImage(mag, -mw / 2, -ph / 2 - 28, mw, mw);
        }
        ctx.restore();
        resolve(c.toDataURL("image/jpeg", 0.82));
      }
      fridge.onload = tick; plek.onload = tick; mag.onload = tick;
      fridge.onerror = tick; plek.onerror = tick; mag.onerror = tick;
      fridge.src = fridgeUrl;
      plek.src = C.dePlekSrc;
      mag.src = "assets/images/magneet.png";
    });
  }

  async function openPolaroid() {
    show("polaroid");
    const flash = $("#flash");
    flash.classList.remove("on");
    void flash.offsetWidth;
    flash.classList.add("on");
    play("fonkel");
    const src = state.fridgePhoto || state.fridgeComposite;
    $("#fridge-bg").src = src || C.dePlekSrc;
    const polo = $("#polaroid");
    polo.querySelector("img").src = C.dePlekSrc;
    polo.style.display = "block";
    try {
      if (state.fridgePhoto) {
        state.fridgeComposite = await makeComposite(state.fridgePhoto, C.dePlekSrc);
        saveState();
      }
    } catch (e) {}
    setPiet && null;
    $("#polaroid-bubble").textContent = PIET_TXT.hangt;
    play("piet-hangt", {
      onend: function () { play("piet-tap"); },
    });
    polo.onclick = function () {
      const lb = $("#lightbox");
      $("#lightbox-img").src = C.dePlekSrc;
      lb.classList.add("on");
    };
    $("#lightbox").onclick = function () { $("#lightbox").classList.remove("on"); };
    $("#btn-naar-code").onclick = function () { openCode(); };
  }

  /* ---------- code ---------- */
  function openCode() {
    show("code");
    state.code = "";
    drawDots();
    $("#code-msg").textContent = "";
    $("#btn-gevonden").disabled = !state.unlocked;
    setCodePiet(PIET_TXT.code);
    play("piet-code");
    // parent escape: long-press Piet 3s
    const img = $("#code-piet");
    let hold = 0, tmr = 0;
    const start = function () {
      hold = Date.now();
      tmr = setTimeout(function () {
        state.unlocked = true;
        $("#btn-gevonden").disabled = false;
        $("#code-msg").textContent = "✓ (stille hulp)";
        play("goed");
      }, 3000);
    };
    const end = function () { clearTimeout(tmr); };
    img.onpointerdown = start;
    img.onpointerup = end;
    img.onpointerleave = end;
    img.onpointercancel = end;
  }

  function setCodePiet(text) {
    $("#code-bubble").textContent = text;
  }

  function drawDots() {
    const el = $("#code-dots");
    const len = C.secretCode.length;
    el.innerHTML = "";
    for (let i = 0; i < len; i++) {
      const s = document.createElement("span");
      s.textContent = state.code[i] || "";
      el.appendChild(s);
    }
  }

  function typeDigit(d) {
    play("tik");
    if (state.code.length >= C.secretCode.length) return;
    state.code += String(d);
    drawDots();
    if (state.code.length === C.secretCode.length) {
      if (state.code === String(C.secretCode)) {
        state.unlocked = true;
        saveState();
        $("#btn-gevonden").disabled = false;
        $("#code-msg").textContent = "Ja! Dat is hem!";
        play("goed");
        buzz([40, 40, 40]);
      } else {
        $("#code-msg").textContent = PIET_TXT.wrong;
        playChain(["fout", "piet-wrong"]);
        setTimeout(function () {
          state.code = "";
          drawDots();
        }, 700);
      }
    }
  }

  /* ---------- gevonden ---------- */
  let zakTimer = 0;
  function openGevonden() {
    show("gevonden");
    play("piet-found", {
      onend: function () { startLied(); },
    });
    const imgs = $$("#zak-stage img");
    let i = 0;
    imgs.forEach((im, n) => im.classList.toggle("on", n === 0));
    clearInterval(zakTimer);
    zakTimer = setInterval(function () {
      i = (i + 1) % imgs.length;
      imgs.forEach((im, n) => im.classList.toggle("on", n === i));
    }, 3500);
    $("#lyrics").textContent = "";
    const pepEl = $("#pep-count");
    if (pepEl) { pepEl.hidden = true; pepEl.textContent = ""; }
    $("#btn-naar-oorkonde").style.display = "none";
  }

  function startLied() {
    const lied = audio.els.lied;
    play("lied", {
      onend: function () {
        play("hinnik", {
          onend: function () {
            $("#btn-naar-oorkonde").style.display = "inline-flex";
            // mention pepernoten
            speakPepernoten(state.pepernoten);
          },
        });
        // show horse scene
        $$("#zak-stage img").forEach((im) => {
          im.classList.toggle("on", im.dataset.place === "paard");
        });
        clearInterval(zakTimer);
      },
    });
    const start = performance.now();
    function tickLyrics() {
      if (audio.current !== lied) return;
      const t = (lied && !lied.paused) ? lied.currentTime : (performance.now() - start) / 1000;
      let text = LYRICS[0] && LYRICS[0].text;
      LYRICS.forEach((c) => { if (t >= c.t) text = c.text; });
      $("#lyrics").textContent = text || "";
      if (lied && !lied.paused) requestAnimationFrame(tickLyrics);
    }
    requestAnimationFrame(tickLyrics);
  }

  /* ---------- oorkonde ---------- */
  let certUrl = null;
  function dutchDate(d) {
    return d.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function openOorkonde() {
    show("oorkonde");
    play("piet-oorkonde");
    const canvas = $("#oorkonde");
    const kader = new Image();
    function loadFaces() {
      if (!document.fonts || !window.FontFace) return Promise.resolve();
      const faces = [
        new FontFace("Cinzel", "url(fonts/cinzel.ttf)", { weight: "700" }),
        new FontFace("Great Vibes", "url(fonts/great-vibes.ttf)", { weight: "400" }),
        new FontFace("Fredoka", "url(fonts/fredoka-latin.woff2)", { weight: "400 700" }),
      ];
      return Promise.all(faces.map(function (f) {
        return f.load().then(function (ok) { document.fonts.add(ok); }).catch(function () {});
      }));
    }
    kader.onload = function () {
      loadFaces().then(function () { drawCert(canvas, kader); });
    };
    kader.src = "assets/images/oorkonde-kader.jpg";
    $("#btn-download").onclick = function () {
      if (!certUrl) return;
      const a = document.createElement("a");
      a.href = certUrl;
      a.download = "hulppiet-manu-maliek-sprangers.png";
      a.click();
    };
    $("#btn-print").onclick = function () {
      const w = window.open("");
      if (!w) return;
      w.document.write('<title>Oorkonde</title><img src="' + certUrl + '" style="width:100%">');
      w.document.close();
      w.focus();
      w.print();
    };
  }

  function drawCert(canvas, kader) {
    const w = 1240, h = 1754;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(kader, 0, 0, w, h);
    const cx = w / 2;
    ctx.fillStyle = "#6e1020";
    ctx.textAlign = "center";
    ctx.font = "700 42px Cinzel, serif";
    ctx.fillText("OFFICIËLE", cx, 340);
    ctx.font = "700 64px Cinzel, serif";
    ctx.fillText("HULPPIET", cx, 420);
    ctx.font = "32px Fredoka, sans-serif";
    ctx.fillStyle = "#3a2010";
    ctx.fillText("Dit is om te bevestigen dat", cx, 520);
    ctx.fillStyle = "#6e1020";
    ctx.font = "700 48px Cinzel, serif";
    wrapText(ctx, C.playerFullName, cx, 610, 860, 58);
    ctx.fillStyle = "#3a2010";
    ctx.font = "32px Fredoka, sans-serif";
    ctx.fillText("op " + dutchDate(new Date()), cx, 740);
    ctx.fillText("zijn best heeft gedaan voor Sinterklaas", cx, 800);
    ctx.font = "700 36px Fredoka, sans-serif";
    ctx.fillStyle = "#6e1020";
    ctx.fillText("en " + state.pepernoten + " pepernoten heeft gestrooid.", cx, 900);
    ctx.font = "28px Fredoka, sans-serif";
    ctx.fillStyle = "#3a2010";
    ctx.fillText("Met een warme groet,", cx, 1080);
    ctx.font = "80px 'Great Vibes', cursive";
    ctx.fillStyle = "#6e1020";
    ctx.fillText("Sinterklaas", cx, 1200);
    certUrl = canvas.toDataURL("image/png");
  }

  function wrapText(ctx, text, x, y, max, lh) {
    // names are short; just draw
    ctx.fillText(text, x, y);
  }

  /* ---------- shell ---------- */
  function build() {
    document.body.innerHTML =
      '<canvas id="strooi-canvas"></canvas>' +
      '<input id="file-input" type="file" accept="image/*" capture="environment" />' +
      '<div id="app">' +

      '<section class="screen on" id="screen-start">' +
        '<h1 id="start-title">De speurtocht van Sint</h1>' +
        '<div class="start-hero"><img src="assets/images/sint-portrait.jpg" alt="Sinterklaas"></div>' +
        '<p class="sub">Tik om te beginnen</p>' +
        '<button class="btn big" id="btn-start">Start!</button>' +
        '<button type="button" class="btn-opnieuw" id="btn-opnieuw">opnieuw beginnen</button>' +
      '</section>' +

      '<section class="screen" id="screen-sint">' +
        '<div class="video-wrap" id="sint-wrap">' +
          '<video id="sint-video" playsinline webkit-playsinline data-has="0"></video>' +
          '<img id="sint-still" src="assets/images/sint-portrait.jpg" alt="Sinterklaas">' +
        '</div>' +
        '<div class="row">' +
          '<button class="btn ghost" id="btn-nog-eens">Nog een keer</button>' +
          '<button class="btn big" id="btn-verder">Verder</button>' +
        '</div>' +
      '</section>' +

      '<section class="screen" id="screen-piet">' +
        '<div class="piet-stage">' +
          '<img class="piet" id="piet-img" alt="Piet" src="assets/images/piet-talking.png">' +
          '<p class="bubble" id="piet-bubble"></p>' +
        '</div>' +
        '<div class="row" id="piet-actions"></div>' +
      '</section>' +

      '<section class="screen" id="screen-camera">' +
        '<div class="cam-stage">' +
          '<video id="cam-video" playsinline muted autoplay></video>' +
          '<img class="preview" id="cam-preview" alt="">' +
        '</div>' +
        '<div class="cam-ui">' +
          '<div class="cam-top"><div class="counter">🍪 0</div><div class="hint" id="cam-hint">Maak een foto</div></div>' +
          '<div class="cam-bot">' +
            '<button class="btn" id="btn-strooi">Strooi!</button>' +
            '<button class="btn big green" id="btn-snap">Foto!</button>' +
            '<button class="file-fallback" id="btn-kies-foto" type="button">Kies een foto</button>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="screen" id="screen-polaroid">' +
        '<div class="piet-stage" style="flex:0 0 auto;flex-direction:row;min-height:0">' +
          '<img class="piet" src="assets/images/piet-excited.png" alt="Piet" style="height:22vh">' +
          '<p class="bubble" id="polaroid-bubble"></p>' +
        '</div>' +
        '<div class="fridge-scene" id="fridge-scene">' +
          '<img class="fridge" id="fridge-bg" alt="koelkast">' +
          '<div class="flash" id="flash"></div>' +
          '<div class="polaroid" id="polaroid">' +
            '<img src="assets/images/de-plek.jpg" alt="de plek">' +
            '<img class="magneet" src="assets/images/magneet.png" alt="">' +
            '<div class="cap">de plek</div>' +
          '</div>' +
        '</div>' +
        '<div class="row"><button class="btn big" id="btn-naar-code">Verder</button></div>' +
        '<div id="lightbox"><img id="lightbox-img" alt="de plek"></div>' +
      '</section>' +

      '<section class="screen" id="screen-code">' +
        '<div class="piet-stage" style="flex:0 1 auto;flex-direction:row">' +
          '<img class="piet" id="code-piet" src="assets/images/piet-talking.png" alt="Piet" style="height:24vh">' +
          '<p class="bubble" id="code-bubble"></p>' +
        '</div>' +
        '<div class="code-dots" id="code-dots"></div>' +
        '<div class="keypad" id="keypad"></div>' +
        '<p class="msg" id="code-msg"></p>' +
        '<button class="btn big green" id="btn-gevonden" disabled>Gevonden!</button>' +
      '</section>' +

      '<section class="screen" id="screen-gevonden">' +
        '<div class="zak-stage" id="zak-stage">' +
          '<img data-place="dak" class="on" src="assets/images/zak-dak.jpg" alt="zak op het dak">' +
          '<img data-place="schoorsteen" src="assets/images/zak-schoorsteen.jpg" alt="zak in de schoorsteen">' +
          '<img data-place="stoomboot" src="assets/images/zak-stoomboot.jpg" alt="zak op de stoomboot">' +
          '<img data-place="paard" src="assets/images/zak-paard.jpg" alt="zak op Amerigo">' +
          '<div class="lyrics" id="lyrics"></div>' +
          '<div class="pep-count" id="pep-count" hidden></div>' +
        '</div>' +
        '<button class="btn big" id="btn-naar-oorkonde" style="display:none">Naar de oorkonde</button>' +
      '</section>' +

      '<section class="screen" id="screen-oorkonde">' +
        '<div class="oorkonde-wrap"><canvas id="oorkonde"></canvas></div>' +
        '<div class="row">' +
          '<button class="btn" id="btn-download">Bewaren</button>' +
          '<button class="btn" id="btn-print">Printen</button>' +
        '</div>' +
        '<a class="btn big green" id="btn-pietenspel" href="spel/">🎮 Pieten spel</a>' +
      '</section>' +

      '</div>';

    // keypad
    const pad = $("#keypad");
    [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "C"].forEach((d) => {
      const b = document.createElement("button");
      b.className = "key";
      b.type = "button";
      b.textContent = d;
      b.onclick = function () {
        if (d === "⌫") {
          state.code = state.code.slice(0, -1);
          drawDots();
        } else if (d === "C") {
          state.code = "";
          drawDots();
        } else typeDigit(d);
      };
      pad.appendChild(b);
    });

    $("#btn-start").onclick = async function () {
      await unlockAudio();
      openSint();
    };
    $("#btn-nog-eens").onclick = function () { replaySint(); };
    $("#btn-verder").onclick = function () {
      const v = $("#sint-video");
      if (v) try { v.pause(); } catch (e) {}
      openPietIntro();
    };
    $("#btn-gevonden").onclick = function () {
      if (!state.unlocked) return;
      openGevonden();
    };
    $("#btn-naar-oorkonde").onclick = function () {
      clearInterval(zakTimer);
      openOorkonde();
    };

    $("#btn-opnieuw").onclick = function () { hardResetForParent(); };

    // hidden reset: 7 taps on the title (zelfde harde reset)
    $("#start-title").addEventListener("click", function () {
      state.titleTaps += 1;
      if (state.titleTaps >= 7) {
        state.titleTaps = 0;
        hardResetForParent();
      }
      setTimeout(function () { state.titleTaps = Math.max(0, state.titleTaps - 1); }, 2500);
    });

    // Probe whether the talking video exists
    const vid = $("#sint-video");
    vid.setAttribute("playsinline", "");
    vid.setAttribute("webkit-playsinline", "");
    vid.preload = "auto";
    vid.src = "assets/video/sint.mp4";
    vid.addEventListener("loadeddata", function () {
      vid.setAttribute("data-has", "1");
      $("#sint-still").style.display = "none";
      vid.style.display = "block";
    });
    vid.addEventListener("error", function () {
      vid.setAttribute("data-has", "0");
    });

    initAudioBank();
    loadState();
    if (state.stage && state.stage !== "start") render();
    else show("start");
    updateCounter();

    initServiceWorker();
  }

  // expose a tiny test hook (no data leaves the device)
  window.__SINT__ = {
    getState: function () { return Object.assign({}, state); },
    reset: resetAll,
    strooi: strooi,
    goto: function (s) { state.stage = s; render(); },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
