/* Pieten spel – levels. Tegel = 40 px, 14 rijen hoog (rij 10 = gewone daklijn). */
(function () {
  const ROWS = 14;
  function L(width, opts) {
    const g = [];
    for (let r = 0; r < ROWS; r++) g.push(new Array(width).fill(" "));
    const lv = { width: width, rows: ROWS, grid: g, chimneys: [], ents: [], plats: [], start: null, flags: [], end: null, opts: opts || {} };
    const api = {
      roof(x1, x2, top, kind) { top = top == null ? 10 : top; for (let x = x1; x <= x2; x++) for (let r = top; r < ROWS; r++) g[r][x] = kind || "#"; return api; },
      ice(x1, x2, top) { return api.roof(x1, x2, top, "="); },
      plank(x1, x2, row) { for (let x = x1; x <= x2; x++) g[row][x] = "-"; return api; },
      chim(x, top, smoke, offset) { top = top == null ? 10 : top; g[top - 1][x] = "C"; g[top - 2][x] = "C"; lv.chimneys.push({ col: x, topRow: top - 2, smoke: !!smoke, offset: offset || 0 }); return api; },
      pep(x, row) { lv.ents.push({ t: "pep", x: x, row: row }); return api; },
      peps(x1, x2, row) { for (let x = x1; x <= x2; x++) api.pep(x, row); return api; },
      heart(x, row) { lv.ents.push({ t: "heart", x: x, row: row }); return api; },
      cat(x, row, speed) { lv.ents.push({ t: "cat", x: x, row: row == null ? 9 : row, speed: speed || 60 }); return api; },
      crow(x, row, range, swoop) { lv.ents.push({ t: "crow", x: x, row: row, range: range || 3, swoop: !!swoop }); return api; },
      balls(x, row, period, delay) { lv.ents.push({ t: "balls", x: x, row: row, period: period || 3, delay: delay || 0 }); return api; },
      plat(x, row, w, dx, dy, period, phase) { lv.plats.push({ col: x, row: row, w: w || 3, dx: dx || 0, dy: dy || 0, period: period || 4, phase: phase || 0 }); return api; },
      start(x, row) { lv.start = { x: x, row: row == null ? 9 : row }; return api; },
      flag(x, row) { lv.flags.push({ x: x, row: row == null ? 9 : row }); return api; },
      end(x, row) { lv.end = { x: x, row: row == null ? 9 : row }; return api; },
      done() { return lv; },
    };
    return api;
  }

  /* Level 1: kort en makkelijk. Kleine gaten (2), een kat, 4 schoorstenen. */
  const l1 = L(64, { name: "1", assist: 7, magnet: 1, respawn: "safe" })
    .roof(0, 14).start(2).chim(7).peps(10, 12, 8)
    .roof(17, 30).chim(23).cat(27).peps(18, 20, 7)
    .roof(31, 40, 9).chim(37, 9)
    .roof(43, 63).plank(46, 49, 7).peps(46, 49, 6).chim(53).end(60)
    .done();

  /* Level 2: makkelijk. Bewegend plankje, roetwolk, kraaien, ijs, sneeuwballen. */
  const l2 = L(110, { name: "2", assist: 7, magnet: 1, respawn: "safe" })
    .roof(0, 12).start(2).chim(8).peps(4, 6, 8)
    .roof(16, 26, 9).chim(20, 9).crow(23, 5, 3).peps(17, 19, 7)
    .plat(28, 9, 3, 3, 0, 4.5)
    .roof(35, 46).flag(37).cat(41).chim(44, 10, true).peps(38, 40, 8)
    .ice(47, 56).peps(49, 54, 8)
    .roof(57, 64).chim(61).heart(59, 8)
    .roof(68, 80, 9).plank(71, 74, 6).peps(71, 74, 5).chim(77, 9).balls(80, 7, 3.6, 1)
    .roof(83, 109).crow(90, 6, 3).chim(87).chim(95).peps(97, 100, 8).end(105)
    .done();

  /* Level 3: ineens heel moeilijk (maar eerlijk): grote gaten, ijs voor een gat,
     liften, duikende kraaien, roetwolken, sneeuwballen. Drie vlaggen. */
  const l3 = L(178, { name: "3", assist: 4, magnet: 0.5, respawn: "flag" })
    // A
    .roof(0, 8).start(1).chim(4)
    .roof(12, 18, 8).chim(14, 8)
    .ice(23, 30).cat(28, 9, 80)
    .roof(35, 44, 9).crow(38, 4, 3, true).chim(40, 9, true).flag(43, 8).peps(36, 38, 7)
    // B: liften
    .plat(46, 9, 3, 0, -3, 3.4)
    .plat(51, 6, 3, 3, 0, 2.8, 0.5)
    .roof(57, 62, 6).chim(60, 6).peps(57, 58, 4)
    .roof(64, 76).flag(65).plank(68, 71, 7).peps(68, 71, 6).cat(72, 9, 90).balls(76, 8, 2.6)
    .crow(79, 6, 2)
    .ice(81, 87, 9).chim(83, 9, true, 1.2)
    // C
    .roof(92, 97).flag(94).heart(96, 8)
    .roof(101, 102, 9)
    .roof(106, 107, 8)
    .roof(111, 112, 7).crow(109, 3, 3, true)
    .plat(114, 7, 2, 4, 0, 2.4)
    .roof(122, 127, 8).chim(124, 8, true).chim(126, 8, true, 1.3)
    .roof(129, 144).flag(130).plank(133, 136, 7).peps(133, 136, 6).cat(138, 9, 90).cat(142, 9, 70).balls(144, 8, 2.2, 1)
    .ice(145, 152)
    .roof(157, 162, 9).chim(159, 9).crow(160, 5, 2, true)
    .roof(166, 177).chim(169).end(174)
    .done();

  window.PIETEN_LEVELS = [l1, l2, l3];
})();
