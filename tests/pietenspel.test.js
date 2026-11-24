// Pieten spel – Playwright. Gebruik: node tests/pietenspel.test.js [basis-url]
const { chromium } = require("playwright-core");
const path = require("path");
const fs = require("fs");
const BASE = process.argv[2] || "http://127.0.0.1:8777/";
const SHOTS = path.join(__dirname, "..", "screenshots", "spel");
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); console.log("  ✗", m); } };
const LAYOUTS = [[1024, 768], [768, 1024], [800, 1280]];
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  for (const vp of LAYOUTS) {
    const tag = vp.join("x");
    const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: true, isMobile: vp[0] < vp[1], locale: "nl-NL" });
    const p = await ctx.newPage();
    const errs = [], ext = [];
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    p.on("pageerror", (e) => errs.push(String(e)));
    p.on("request", (r) => { if (!r.url().startsWith(BASE)) ext.push(r.url()); });
    await p.goto(BASE + "spel/?debug=1"); await p.waitForTimeout(900);
    ok(await p.isVisible("#scr-menu"), tag + " menu zichtbaar");
    ok((await p.$$(".lvl.locked")).length === 2, tag + " level 2 en 3 op slot");
    await p.screenshot({ path: `${SHOTS}/menu_${tag}.png` });
    if (vp[0] < vp[1]) {
      // staande tablet: spel is liggend → draai-overlay, daarna liggend verder testen
      ok(await p.isVisible("#rotate"), tag + " draai-overlay in staand");
      await p.screenshot({ path: `${SHOTS}/draai_${tag}.png` });
      await p.setViewportSize({ width: vp[1], height: vp[0] }); await p.waitForTimeout(800);
      ok(!(await p.isVisible("#rotate")), tag + " overlay weg na draaien");
    }
    for (const n of [1, 2, 3]) {
      await p.evaluate((n) => PS.start(n), n); await p.waitForTimeout(2200);
      const s = await p.evaluate(() => PS.state());
      ok(s.mode === "play" && s.level === n, tag + " level " + n + " speelt");
      ok(await p.isVisible("#act-jump"), tag + " touchknoppen zichtbaar");
      await p.screenshot({ path: `${SHOTS}/level${n}_${tag}.png` });
    }
    // touch: rechts lopen en springen
    await p.evaluate(() => PS.start(1)); await p.waitForTimeout(300);
    const x0 = (await p.evaluate(() => PS.state())).x;
    const r = await p.locator("#pad-r").boundingBox();
    await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    await p.dispatchEvent("#pad", "pointerdown", { pointerId: 7, clientX: r.x + r.width / 2, clientY: r.y + 10, isPrimary: true });
    await p.waitForTimeout(500);
    await p.dispatchEvent("#pad", "pointerup", { pointerId: 7 });
    const x1 = (await p.evaluate(() => PS.state())).x;
    ok(x1 > x0 + 40, tag + " ▶ laat Piet lopen (" + Math.round(x0) + "→" + Math.round(x1) + ")");
    // level 1 winnen → tussenstuk
    await p.evaluate(() => PS.win()); await p.waitForTimeout(600);
    ok(await p.isVisible("#scr-result"), tag + " resultaatscherm");
    await p.screenshot({ path: `${SHOTS}/resultaat_${tag}.png` });
    await p.click("#res-verder"); await p.waitForTimeout(1500);
    ok(await p.isVisible("#scr-sint"), tag + " Sint vraagt na level 1");
    ok(await p.isVisible("#btn-bel") && await p.isVisible("#btn-slaover"), tag + " Bel mama + sla over");
    await p.screenshot({ path: `${SHOTS}/sint-vraagt_${tag}.png` });
    await p.click("#btn-bel", { force: true }); await p.waitForTimeout(800);
    ok(await p.isVisible("#scr-ring"), tag + " belscherm");
    await p.screenshot({ path: `${SHOTS}/belt_${tag}.png` });
    await p.click("#btn-opnemen", { force: true }); await p.waitForTimeout(3500);
    ok(await p.isVisible("#scr-incall"), tag + " in gesprek");
    const vt = await p.evaluate(() => document.querySelector("#vid-belt").currentTime);
    ok(vt > 1, tag + " Sint-video speelt (" + vt.toFixed(1) + "s)");
    await p.screenshot({ path: `${SHOTS}/gesprek_${tag}.png` });
    await p.evaluate(() => { const v = document.querySelector("#vid-belt"); v.dispatchEvent(new Event("ended")); });
    await p.waitForTimeout(2200);
    ok(await p.isVisible("#scr-ended"), tag + " verbinding verbroken");
    await p.screenshot({ path: `${SHOTS}/verbroken_${tag}.png` });
    ok((await p.evaluate(() => PS.state().save.belDone)) === true, tag + " telefoontje uitgeschakeld");
    await p.click("#btn-na-bel"); await p.waitForTimeout(400);
    ok((await p.evaluate(() => PS.state())).level === 2, tag + " daarna level 2");
    // opnieuw laden: level 1 → direct level 2
    await p.reload(); await p.waitForTimeout(800);
    ok((await p.$$(".lvl.locked")).length === 1, tag + " voortgang bewaard (level 2 open)");
    await p.evaluate(() => PS.start(1)); await p.waitForTimeout(200); await p.evaluate(() => PS.win()); await p.waitForTimeout(500);
    await p.click("#res-verder"); await p.waitForTimeout(400);
    ok(!(await p.isVisible("#scr-sint")) && (await p.evaluate(() => PS.state())).level === 2, tag + " tweede keer geen telefoontje");
    // level 2 en 3 winnen
    await p.evaluate(() => PS.win()); await p.waitForTimeout(500); await p.click("#res-verder"); await p.waitForTimeout(300);
    ok((await p.evaluate(() => PS.state())).level === 3, tag + " level 3 na level 2");
    await p.evaluate(() => PS.win()); await p.waitForTimeout(700);
    ok(await p.isVisible("#scr-final"), tag + " eindscherm na level 3");
    await p.screenshot({ path: `${SHOTS}/einde_${tag}.png` });
    // ouder-reset
    await p.click("#fin-menu"); await p.waitForTimeout(200);
    p.once("dialog", (d) => d.accept());
    for (let i = 0; i < 7; i++) await p.click("#menu-title");
    await p.waitForTimeout(300);
    const sv = await p.evaluate(() => PS.state().save);
    ok(sv.belDone === false && sv.unlocked === 1, tag + " verborgen reset zet telefoontje terug");
    ok(errs.length === 0, tag + " geen console-fouten: " + errs.join(" | "));
    ok(ext.length === 0, tag + " geen externe verzoeken: " + ext.join(" "));
    await ctx.close();
  }
  // speurtocht: knop op oorkonde
  const ctx = await b.newContext({ viewport: { width: 768, height: 1024 } });
  const p = await ctx.newPage();
  await p.goto(BASE); await p.waitForTimeout(800);
  ok((await p.$$("#btn-pietenspel")).length === 1, "speurtocht heeft Pieten spel-knop");
  ok((await p.getAttribute("#btn-pietenspel", "href")) === "spel/", "knop wijst naar spel/");
  const sw = await (await p.request.get(BASE + "sw.js")).text();
  ok(sw.includes("./spel/spel.js") && sw.includes("./spel/video/sint-belt.mp4"), "service worker cachet /spel/");
  await b.close();
  console.log(`\n${pass} ok, ${fail} fout`);
  if (fail) { console.log(fails.join("\n")); process.exit(1); }
})();
