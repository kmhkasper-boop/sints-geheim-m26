/* Pieten spel – geluid: alles live gesynthetiseerd (WebAudio), eigen melodie. */
(function () {
  let ac = null, master = null, musicGain = null, sfxGain = null;
  let musicOn = true, musicTimer = null, nextNote = 0, step = 0;
  const voice = {};

  function ensure() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return ac; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    musicGain = ac.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    return ac;
  }

  function tone(freq, dur, type, vol, when, slideTo, dest) {
    if (!ac) return;
    const t = (when || ac.currentTime);
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, filt, when) {
    if (!ac) return;
    const t = when || ac.currentTime;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ac.createBufferSource(); s.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = filt || 1200; f.Q.value = 0.8;
    const g = ac.createGain(); g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t);
  }

  const S = {
    jump() { tone(330, 0.16, "square", 0.18, 0, 720); },
    pep() { const t = ac && ac.currentTime; tone(1320, 0.08, "triangle", 0.25, t); tone(1760, 0.14, "triangle", 0.22, t + 0.06); },
    gooi() { noise(0.18, 0.25, 900); tone(500, 0.12, "triangle", 0.12, 0, 900); },
    strooi() { noise(0.08, 0.2, 2400); tone(900, 0.06, "square", 0.08); },
    raak() { const t = ac && ac.currentTime; [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, "triangle", 0.25, t + i * 0.07)); },
    au() { tone(420, 0.35, "sawtooth", 0.16, 0, 140); },
    bonk() { tone(180, 0.12, "square", 0.22, 0, 90); noise(0.1, 0.15, 500); },
    poef() { noise(0.25, 0.25, 600); },
    vlag() { const t = ac && ac.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "square", 0.12, t + i * 0.09)); },
    hart() { const t = ac && ac.currentTime; tone(660, 0.12, "triangle", 0.25, t); tone(880, 0.2, "triangle", 0.25, t + 0.1); },
    val() { tone(600, 0.6, "triangle", 0.2, 0, 120); },
    gelukt() { const t = ac && ac.currentTime; [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.6 : 0.16, "square", 0.13, t + i * 0.12)); },
    tik() { tone(1000, 0.04, "square", 0.1); },
    beep() { tone(480, 0.35, "sine", 0.3); },
  };

  // eigen vrolijke deuntje (6/8-gevoel), C-groot
  const MEL = [72, 0, 76, 79, 0, 76, 74, 0, 77, 81, 0, 77, 76, 0, 79, 84, 0, 79, 77, 76, 74, 72, 0, 0,
               69, 0, 72, 77, 0, 72, 71, 0, 74, 79, 0, 74, 72, 74, 76, 77, 79, 81, 79, 0, 74, 72, 0, 0];
  const BAS = [48, 55, 53, 55, 48, 55, 53, 43];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function sched() {
    if (!ac) return;
    const spb = 0.19;
    while (nextNote < ac.currentTime + 0.3) {
      const m = MEL[step % MEL.length];
      if (m) { tone(mtof(m), 0.22, "triangle", 0.5, nextNote, 0, musicGain); tone(mtof(m + 12), 0.1, "sine", 0.12, nextNote, 0, musicGain); }
      if (step % 6 === 0) tone(mtof(BAS[(step / 6) % BAS.length]), 0.5, "sine", 0.6, nextNote, 0, musicGain);
      if (step % 3 === 0) { /* belletje */ tone(2093, 0.05, "sine", 0.05, nextNote, 0, musicGain); }
      nextNote += spb; step++;
    }
  }
  function startMusic() {
    if (!ensure() || !musicOn || musicTimer) return;
    nextNote = ac.currentTime + 0.1; musicTimer = setInterval(sched, 80);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

  // ringtone voor het telefoontje
  let ringTimer = null;
  function ring() {
    if (!ensure()) return;
    const once = () => { const t = ac.currentTime; for (let i = 0; i < 10; i++) { tone(i % 2 ? 1320 : 1100, 0.05, "square", 0.12, t + i * 0.06); } for (let i = 0; i < 10; i++) { tone(i % 2 ? 1320 : 1100, 0.05, "square", 0.12, t + 0.75 + i * 0.06); }
      if (navigator.vibrate) try { navigator.vibrate([400, 200, 400]); } catch (e) {} };
    once(); ringTimer = setInterval(once, 2600);
  }
  function stopRing() { clearInterval(ringTimer); ringTimer = null; if (navigator.vibrate) try { navigator.vibrate(0); } catch (e) {} }

  // optionele ingesproken Piet-zinnetjes (assets/voice/*.mp3)
  async function loadVoice(names) {
    if (!ensure()) return;
    for (const n of names) {
      if (voice[n]) continue;
      try {
        const r = await fetch("voice/" + n + ".mp3"); if (!r.ok) continue;
        const b = await r.arrayBuffer();
        voice[n] = await new Promise((ok, no) => ac.decodeAudioData(b, ok, no));
      } catch (e) {}
    }
  }
  let lastVoice = null;
  function say(n) {
    if (!ac || !voice[n]) return;
    try { if (lastVoice) lastVoice.stop(); } catch (e) {}
    const s = ac.createBufferSource(); s.buffer = voice[n];
    const g = ac.createGain(); g.gain.value = 1.0; s.connect(g); g.connect(master); s.start(); lastVoice = s;
  }

  window.PietAudio = {
    ensure, sfx: (n) => { if (ensure() && S[n]) S[n](); }, startMusic, stopMusic, ring, stopRing, loadVoice, say,
    setMusic(on) { musicOn = on; if (!on) stopMusic(); },
    get musicOn() { return musicOn; },
    duck(on) { if (musicGain) musicGain.gain.value = on ? 0.04 : 0.16; },
  };
})();
