// Mobiele test voor het Pieten spel: iPhone 12 / SE / Pixel 5 / 740x360, liggend + staand, meerdere keren draaien.
// Gebruik: node tests/pietenspel-mobiel.test.js http://127.0.0.1:8777/
const { chromium, devices } = require("playwright-core");
const path = require("path");
const BASE = (process.argv[2] || "http://127.0.0.1:8777/").replace(/\/?$/, "/");
const SHOTS = path.join(__dirname, "..", "screenshots", "spel-mobiel");
let okN = 0, bad = 0;
function ok(c, m) { if (c) okN++; else { bad++; console.log("  ✗ " + m); } }
const DEV = [
  ["iphone12", devices["iPhone 12"]],
  ["iphoneSE", devices["iPhone SE"]],
  ["pixel5", devices["Pixel 5"]],
  ["s9-740x360", Object.assign({}, devices["Pixel 5"], { viewport: { width: 360, height: 740 }, deviceScaleFactor: 4 })],
];
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  for (const [tag, d] of DEV) {
    console.log("▶ " + tag);
    const pw = d.viewport.width, ph = d.viewport.height; // staand
    const L = { width: Math.max(pw, ph), height: Math.min(pw, ph) }, P = { width: Math.min(pw, ph), height: Math.max(pw, ph) };
    const ctx = await b.newContext(Object.assign({}, d, { viewport: L, locale: "nl-NL" }));
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await p.goto(BASE + "spel/?debug=1");
    await p.evaluate(() => localStorage.clear());
    await p.reload(); await p.waitForTimeout(1200);
    const check = async (lbl, vp, wantPortrait) => {
      const s = await p.evaluate(() => {
        const st = PS.state(), vv = visualViewport, cvr = document.querySelector("#game").getBoundingClientRect();
        const rects = {};
        ["#pad-l", "#pad-r", "#act-pep", "#act-gooi", "#act-jump", "#btn-pause", "#hud-hearts"].forEach((q) => { const r = document.querySelector(q).getBoundingClientRect(); rects[q] = [r.left, r.top, r.right, r.bottom, r.width]; });
        return { st, scale: vv.scale, vw: vv.width, vh: vv.height, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cw: cvr.width, ch: cvr.height, dpr: devicePixelRatio, rot: !document.querySelector("#rotate").classList.contains("hidden"), rects };
      });
      ok(Math.abs(s.scale - 1) < 0.01, `${tag} ${lbl}: zoom ${s.scale}`);
      ok(s.cw === vp.width && s.ch === vp.height, `${tag} ${lbl}: canvas ${s.cw}x${s.ch} past niet in ${vp.width}x${vp.height}`);
      ok(s.st.cvW === Math.round(s.st.W * s.st.DPR) && s.st.W === vp.width && s.st.H === vp.height, `${tag} ${lbl}: canvasbuffer ${s.st.cvW} W ${s.st.W} DPR ${s.st.DPR}`);
      ok(s.sw <= vp.width && s.sh <= vp.height, `${tag} ${lbl}: pagina groter dan scherm ${s.sw}x${s.sh}`);
      ok(s.rot === wantPortrait, `${tag} ${lbl}: draai-overlay ${s.rot}`);
      return s;
    };
    // menu liggend
    await check("menu liggend", L, false);
    await p.screenshot({ path: `${SHOTS}/menu_${tag}.png` });
    await p.click('.lvl[data-level="1"]'); await p.waitForTimeout(2200);
    let s = await check("level 1 liggend", L, false);
    ok(s.st.mode === "play", `${tag} speelt`);
    // knoppen: binnen beeld, niet over elkaar, groot genoeg
    const R = s.rects, ks = ["#pad-l", "#pad-r", "#act-pep", "#act-gooi", "#act-jump"];
    for (const k of ks) { const r = R[k]; ok(r[0] >= 0 && r[1] >= 0 && r[2] <= L.width && r[3] <= L.height, `${tag} ${k} buiten beeld`); ok(r[4] >= 56, `${tag} ${k} te klein ${r[4]}`); ok(r[1] > L.height * 0.55, `${tag} ${k} te hoog (${Math.round(r[1])})`); }
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = R[ks[i]], c = R[ks[j]]; ok(a[2] <= c[0] || c[2] <= a[0] || a[3] <= c[1] || c[3] <= a[1], `${tag} ${ks[i]} overlapt ${ks[j]}`); }
    ok(R["#btn-pause"][3] < L.height * 0.2, `${tag} HUD te groot`);
    // lopen met touch
    const x0 = (await p.evaluate(() => PS.state())).x;
    const pr = await p.$("#pad-r"); const bb = await pr.boundingBox();
    // echte touch vasthouden op ▶ én tegelijk springen (multi-touch) via CDP
    const cdp = await ctx.newCDPSession(p);
    const jb = await (await p.$("#act-jump")).boundingBox();
    const tp = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, id: 1 }, tj = { x: jb.x + jb.width / 2, y: jb.y + jb.height / 2, id: 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [tp] });
    await p.waitForTimeout(250);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [tp, tj] });
    await p.waitForTimeout(120);
    const yJump = (await p.evaluate(() => PS.state())).on;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [tp] });
    await p.waitForTimeout(300);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    ok(yJump === false, `${tag} springt tijdens lopen (multi-touch)`);
    ok((await p.evaluate(() => PS.state())).x > x0 + 30, `${tag} Piet loopt`);
    // dubbeltik op het spel mag niet zoomen
    await p.touchscreen.tap(L.width / 2, L.height / 3); await p.touchscreen.tap(L.width / 2, L.height / 3);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${SHOTS}/level1-liggend_${tag}.png` });
    // draaien: 3x heen en weer
    for (let k = 0; k < 3; k++) {
      await p.setViewportSize(P); await p.waitForTimeout(900);
      s = await check(`staand #${k + 1}`, P, true);
      ok(s.st.mode === "pause", `${tag} gepauzeerd bij staand (${s.st.mode})`);
      if (k === 0) await p.screenshot({ path: `${SHOTS}/draai-je-telefoon_${tag}.png` });
      await p.setViewportSize(L); await p.waitForTimeout(900);
      s = await check(`liggend #${k + 1}`, L, false);
      ok(s.st.mode === "play", `${tag} speelt weer na terugdraaien (${s.st.mode})`);
    }
    await p.screenshot({ path: `${SHOTS}/level1-na-draaien_${tag}.png` });
    // L2 en L3 op dit scherm
    for (const n of [2, 3]) { await p.evaluate((n) => PS.start(n), n); await p.waitForTimeout(1900); await check(`level ${n}`, L, false); await p.screenshot({ path: `${SHOTS}/level${n}_${tag}.png` }); }
    // tussenstuk op de telefoon
    await p.evaluate(() => { PS.start(1); }); await p.waitForTimeout(300); await p.evaluate(() => PS.win()); await p.waitForTimeout(600);
    await p.screenshot({ path: `${SHOTS}/resultaat_${tag}.png` });
    await p.click("#res-verder"); await p.waitForTimeout(1200);
    ok(await p.isVisible("#btn-bel"), `${tag} Bel mama zichtbaar`);
    const bel = await (await p.$("#btn-bel")).boundingBox(); ok(bel.y + bel.height <= L.height, `${tag} Bel mama past in beeld`);
    await p.screenshot({ path: `${SHOTS}/sint-vraagt_${tag}.png` });
    await p.click("#btn-bel", { force: true }); await p.waitForTimeout(700);
    const op = await (await p.$(".call-label")).boundingBox(); ok(op.y + op.height <= L.height, `${tag} Opnemen past in beeld`);
    await p.screenshot({ path: `${SHOTS}/belt_${tag}.png` });
    // mama mag de telefoon rechtop houden tijdens het bellen: geen overlay
    await p.setViewportSize(P); await p.waitForTimeout(700);
    ok(!(await p.isVisible("#rotate")), `${tag} geen draai-overlay tijdens bellen`);
    await p.screenshot({ path: `${SHOTS}/belt-staand_${tag}.png` });
    await p.click("#btn-opnemen", { force: true }); await p.waitForTimeout(2500);
    await p.screenshot({ path: `${SHOTS}/gesprek-staand_${tag}.png` });
    await p.setViewportSize(L); await p.waitForTimeout(700);
    await p.screenshot({ path: `${SHOTS}/gesprek_${tag}.png` });
    await p.evaluate(() => document.querySelector("#vid-belt").dispatchEvent(new Event("ended"))); await p.waitForTimeout(2200);
    await p.screenshot({ path: `${SHOTS}/verbroken_${tag}.png` });
    await p.click("#btn-na-bel"); await p.waitForTimeout(800);
    s = await check("na bellen", L, false);
    ok(s.st.level === 2 && s.st.mode === "play", `${tag} door naar level 2`);
    // menu: iOS-tip alleen op iPhone
    await p.evaluate(() => PS.menu()); await p.waitForTimeout(300);
    const tip = await p.isVisible("#ios-tip");
    ok(tag.startsWith("iphone") ? tip : !tip, `${tag} iOS-tip ${tip}`);
    await p.screenshot({ path: `${SHOTS}/menu-na_${tag}.png` });
    await p.setViewportSize(P); await p.waitForTimeout(700);
    await check("menu staand", P, true);
    ok(errs.length === 0, `${tag} fouten: ${errs.join(" | ")}`);
    await ctx.close();
  }
  await b.close();
  console.log(`\n${okN} ok, ${bad} fout`);
  process.exit(bad ? 1 : 0);
})();
