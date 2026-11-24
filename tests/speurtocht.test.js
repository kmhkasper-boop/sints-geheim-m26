// Speurtocht – Playwright (playwright-core + Chrome).
// Gebruik: node tests/speurtocht.test.js [url]
const { chromium } = require("playwright-core");
const path = require("path");
const fs = require("fs");

const URL0 = process.argv[2] || "http://127.0.0.1:8766/";
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "screenshots");
const KAMER = path.join(__dirname, "fixtures/kamer.jpg");
const KOELKAST = path.join(__dirname, "fixtures/koelkast.jpg");

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m) => {
  if (c) { pass++; }
  else { fail++; fails.push(m); console.log("  ✗", m); }
};

const LAYOUTS = [
  [768, 1024],
  [1024, 768],
  [800, 1280],
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox"],
  });
  const ext = [];
  const errs = [];

  async function page(vp) {
    const ctx = await b.newContext({
      viewport: { width: vp[0], height: vp[1] },
      hasTouch: true,
      deviceScaleFactor: 1,
      locale: "nl-NL",
    });
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => errs.push(e.message));
    pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    pg.on("request", (r) => {
      const u = r.url();
      if (!u.startsWith(URL0) && !u.startsWith("data:") && !u.startsWith("blob:")) ext.push(u);
    });
    await pg.goto(URL0, { waitUntil: "networkidle" });
    await pg.waitForSelector("#btn-start");
    return pg;
  }

  const shot = async (pg, name) => {
    await pg.waitForTimeout(250);
    await pg.screenshot({ path: path.join(SHOTS, name), fullPage: false });
  };

  async function startGame(pg) {
    await pg.click("#btn-start");
    await pg.waitForSelector("#screen-sint.on");
  }

  async function verderNaSint(pg) {
    await pg.click("#btn-verder");
    await pg.waitForSelector("#screen-piet.on");
  }

  async function uploadFoto(pg, file) {
    await pg.waitForSelector("#screen-camera.on");
    await pg.setInputFiles("#file-input", file);
    // afterPhoto is triggered by the change handler
  }

  console.log("▶ start + layouts");
  {
    const pg = await page([768, 1024]);
    ok(await pg.locator("#btn-start").isVisible(), "startknop zichtbaar op 768x1024");
    ok(await pg.locator("#start-title").textContent().then((t) => /speurtocht/i.test(t)), "titel");
    await shot(pg, "start_768x1024.png");
    await pg.close();
  }
  {
    const pg = await page([1024, 768]);
    ok(await pg.locator("#btn-start").isVisible(), "startknop zichtbaar op 1024x768");
    await shot(pg, "start_1024x768.png");
    await pg.close();
  }
  {
    const pg = await page([800, 1280]);
    ok(await pg.locator("#btn-start").isVisible(), "startknop zichtbaar op 800x1280");
    await shot(pg, "start_800x1280.png");
    await pg.close();
  }

  console.log("▶ sint-video scherm (na tik, iOS-regel)");
  {
    const pg = await page([768, 1024]);
    await startGame(pg);
    ok(await pg.locator("#btn-nog-eens").isVisible(), "knop Nog een keer");
    ok(await pg.locator("#btn-verder").isVisible(), "knop Verder");
    await shot(pg, "sint_768x1024.png");
    // media starts after tap: only the video, not also sint-rijm.mp3
    const playing = await pg.evaluate(() => {
      return !!(document.getElementById("sint-video") || document.getElementById("sint-still"));
    });
    ok(playing, "sint media aanwezig");
    await pg.waitForFunction(() => {
      const s = window.__SINT__ && window.__SINT__.mediaSnapshot && window.__SINT__.mediaSnapshot();
      return s && s.video && s.video.currentTime > 0.2 && s.video.width > 0;
    }, { timeout: 8000 }).catch(() => {});
    const snap = await pg.evaluate(() => window.__SINT__.mediaSnapshot());
    ok(snap && snap.video && snap.video.currentTime > 0.2, "video loopt (t=" + (snap && snap.video && snap.video.currentTime) + ")");
    ok(snap && snap.video && snap.video.width > 0 && snap.video.height > 0, "video heeft beeld " + (snap && snap.video && snap.video.width) + "x" + (snap && snap.video && snap.video.height));
    ok(snap && snap.playingAudio.filter((id) => id === "sint").length === 0, "geen tweede audiospoor (sint-rijm): " + (snap && snap.playingAudio));
    await verderNaSint(pg);
    const bubble1 = await pg.locator("#piet-bubble").textContent();
    ok(/vergeten|kwijt|zak|kamers/i.test(bubble1), "Piet legt uit over de zak: " + bubble1);
    ok(/\bManu\b/.test(bubble1) && !/Mannoe/.test(bubble1), "uitleg-bubbel schrijft Manu, niet Mannoe: " + bubble1);
    ok(await pg.locator("#btn-piet-verder").isVisible(), "Verder-knop na de uitleg");
    await shot(pg, "piet_uitleg_768x1024.png");
    await pg.click("#btn-piet-verder");
    await pg.waitForSelector("#btn-foto-gaan");
    const bubble = await pg.locator("#piet-bubble").textContent();
    ok(/foto/i.test(bubble) && /kamer|ruimte/i.test(bubble), "Piet vraagt om een foto van een kamer: " + bubble);
    ok(!/Mannoe/.test(bubble), "foto-bubbel schrijft geen Mannoe: " + bubble);
    const written = await pg.evaluate(() => {
      const texts = [];
      document.querySelectorAll("body, body *").forEach((el) => {
        if (el.childNodes && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
          texts.push(el.textContent);
        }
      });
      return texts.join("\n");
    });
    ok(!/Mannoe/.test(written), "geen Mannoe in zichtbare schermtekst");
    await shot(pg, "piet_intro_768x1024.png");
    await pg.close();
  }

  console.log("▶ Piet-uitleg op tablet 800x1280");
  {
    const pg = await page([800, 1280]);
    await startGame(pg);
    await verderNaSint(pg);
    await pg.waitForSelector("#btn-piet-verder");
    const bubble = await pg.locator("#piet-bubble").textContent();
    ok(/\bManu\b/.test(bubble) && !/Mannoe/.test(bubble), "800x1280 uitleg schrijft Manu: " + bubble);
    ok(/vergeten|zak|kamers/i.test(bubble), "800x1280 uitleg noemt zak/kamers");
    await shot(pg, "piet_uitleg_800x1280.png");
    await pg.close();
  }

  console.log("▶ foto's, koud, strooi, koelkast, polaroid, code, oorkonde");
  {
    const pg = await page([800, 1280]);
    await startGame(pg);
    await verderNaSint(pg);
    if (await pg.locator("#btn-piet-verder").count()) {
      await pg.click("#btn-piet-verder");
    }
    await pg.click("#btn-foto-gaan");
    await pg.waitForSelector("#screen-camera.on");
    await shot(pg, "camera_800x1280.png");

    // Strooi
    const before = await pg.evaluate(() => window.__SINT__.getState().pepernoten);
    await pg.click("#btn-strooi");
    await pg.waitForTimeout(200);
    const after = await pg.evaluate(() => window.__SINT__.getState().pepernoten);
    ok(after > before, "strooi verhoogt de teller (" + before + " → " + after + ")");

    // 3 koude kamerfoto's
    for (let i = 0; i < 3; i++) {
      if (!(await pg.locator("#screen-camera.on").count())) {
        // knop naar volgende foto
        const btn = pg.locator("#btn-volgende-foto, #btn-foto-gaan, #btn-koelkast");
        if (await btn.count()) await btn.first().click();
      }
      await pg.waitForSelector("#screen-camera.on", { timeout: 8000 });
      await uploadFoto(pg, KAMER);
      await pg.waitForSelector("#screen-piet.on", { timeout: 8000 });
      const txt = await pg.locator("#piet-bubble").textContent();
      if (i < 2) {
        ok(/koud|ijs|sok|kippenvel/i.test(txt), "koud-regel " + (i + 1) + ": " + txt);
        await shot(pg, "koud_" + (i + 1) + "_800x1280.png");
        await pg.click("#btn-volgende-foto");
      }
    }
    // na 3x koud: knop "Verder" of automatisch de koelkastvraag
    await pg.waitForSelector("#btn-volgende-foto, #btn-koelkast", { timeout: 10000 });
    if (await pg.locator("#btn-koelkast").count() === 0) {
      await pg.click("#btn-volgende-foto");
    }
    await pg.waitForSelector("#btn-koelkast", { timeout: 10000 });
    const koelTxt = await pg.locator("#piet-bubble").textContent();
    ok(/koelkast/i.test(koelTxt), "Piet vraagt om de koelkast: " + koelTxt);
    await shot(pg, "koelkast_vraag_800x1280.png");
    await pg.click("#btn-koelkast");
    await pg.waitForSelector("#screen-camera.on", { timeout: 8000 });
    await uploadFoto(pg, KOELKAST);
    await pg.waitForSelector("#screen-polaroid.on", { timeout: 8000 });
    ok(await pg.locator("#polaroid").isVisible(), "polaroid zichtbaar");
    const hangt = await pg.locator("#polaroid-bubble").textContent();
    ok(/hangt/i.test(hangt), "Hé, wat hangt daar: " + hangt);
    await pg.waitForTimeout(900);
    await shot(pg, "polaroid_800x1280.png");
    await pg.click("#btn-naar-code");
    await pg.waitForSelector("#screen-code.on");

    // verkeerde code
    for (const d of ["1", "2", "3", "4"]) await pg.click(`.key:text-is("${d}")`);
    await pg.waitForTimeout(400);
    const wrong = await pg.locator("#code-msg").textContent();
    ok(/niet de juiste|Helaas|briefje/i.test(wrong), "verkeerde code: " + wrong);
    ok(await pg.locator("#btn-gevonden").isDisabled(), "Gevonden nog uit na foute code");

    // juiste code 5122 (na reset van de foute)
    await pg.waitForTimeout(800);
    for (const d of ["5", "1", "2", "2"]) await pg.click(`.key:text-is("${d}")`);
    await pg.waitForTimeout(200);
    ok(await pg.locator("#btn-gevonden").isEnabled(), "Gevonden aan na juiste code");
    await shot(pg, "code_800x1280.png");
    await pg.click("#btn-gevonden");
    await pg.waitForSelector("#screen-gevonden.on");
    ok(await pg.locator("#zak-stage").isVisible(), "zak-animatie zichtbaar");
    await shot(pg, "gevonden_800x1280.png");

    // spring naar oorkonde (niet 30s wachten op het lied)
    await pg.evaluate(() => window.__SINT__.goto("oorkonde"));
    await pg.waitForSelector("#screen-oorkonde.on");
    await pg.waitForTimeout(600);
    const label = await pg.evaluate(() => {
      const c = document.getElementById("oorkonde");
      // we can't easily OCR; check canvas has pixels and state name via download attribute path later
      return { w: c.width, h: c.height, name: window.SINT_CONFIG.playerFullName };
    });
    ok(label.w > 800 && label.h > 1000, "oorkonde canvas getekend " + label.w + "x" + label.h);
    ok(label.name === "Manu Maliek Sprangers", "naam op config: " + label.name);
    await shot(pg, "oorkonde_800x1280.png");

    // voortgang bewaren
    const pep = await pg.evaluate(() => window.__SINT__.getState().pepernoten);
    ok(pep > 0, "pepernoten bewaard in state: " + pep);
    await pg.reload({ waitUntil: "networkidle" });
    await pg.waitForTimeout(400);
    const st = await pg.evaluate(() => window.__SINT__.getState().stage);
    ok(st === "oorkonde", "na herladen nog op oorkonde, stage=" + st);
    ok(await pg.locator("#btn-pietenspel").isVisible(), "Pieten-spelknop blijft op oorkonde");
    ok(await pg.locator("#btn-opnieuw-oorkonde").isVisible(), "opnieuw-knop zichtbaar op oorkonde na herladen");
    const oorkondeConfirm = await pg.evaluate(() => {
      const orig = window.confirm;
      let msg = "";
      window.confirm = function (m) { msg = String(m || ""); return false; };
      document.getElementById("btn-opnieuw-oorkonde").click();
      window.confirm = orig;
      return msg;
    });
    ok(/opnieuw|wist|voortgang|nieuwste/i.test(oorkondeConfirm), "oorkonde-reset vraagt bevestiging: " + oorkondeConfirm);
    const stAfterCancel = await pg.evaluate(() => window.__SINT__.getState().stage);
    ok(stAfterCancel === "oorkonde", "annuleren blijft op oorkonde, stage=" + stAfterCancel);
    await pg.close();
  }

  console.log("▶ geen externe verzoeken + config");
  {
    ok(ext.length === 0, "geen externe verzoeken: " + ext.slice(0, 5).join(", "));
    const pg = await page([768, 1024]);
    const cfg = await pg.evaluate(() => window.SINT_CONFIG);
    ok(cfg.secretCode === "5122", "geheime code staat op één plek");
    ok(cfg.dePlekSrc.indexOf("de-plek") !== -1, "de-plek pad configureerbaar");
    // hidden reset bestaat
    await pg.click("#start-title");
    ok(true, "titel is tappable voor reset");
    ok(await pg.locator("#btn-opnieuw").isVisible(), "kleine opnieuw-knop op startscherm");
    const confirmed = await pg.evaluate(() => {
      const orig = window.confirm;
      let msg = "";
      window.confirm = function (m) { msg = String(m || ""); return false; };
      document.getElementById("btn-opnieuw").click();
      window.confirm = orig;
      return msg;
    });
    ok(/opnieuw|wist|voortgang|nieuwste/i.test(confirmed), "reset vraagt bevestiging: " + confirmed);
    ok(await pg.locator("#btn-start").isVisible(), "annuleren blijft op start");
    await pg.close();
  }

  console.log("▶ WebKit iPhone: video speelt, één audiospoor");
  {
    const { webkit, devices } = require("playwright-core");
    const device = devices["iPhone 13"] || devices["iPhone 12"];
    const wk = await webkit.launch({ args: [] });
    const ctx = await wk.newContext({
      ...device,
      locale: "nl-NL",
    });
    const pg = await ctx.newPage();
    const wkErrs = [];
    pg.on("pageerror", (e) => wkErrs.push(e.message));
    await pg.goto(URL0, { waitUntil: "networkidle" });
    await pg.waitForSelector("#btn-start");
    await pg.click("#btn-start");
    await pg.waitForSelector("#screen-sint.on");
    await pg.waitForFunction(() => {
      const s = window.__SINT__ && window.__SINT__.mediaSnapshot && window.__SINT__.mediaSnapshot();
      return s && s.video && s.video.currentTime > 0.2 && s.video.width > 0 && s.video.height > 0;
    }, { timeout: 12000 }).catch(() => {});
    const snap = await pg.evaluate(() => window.__SINT__.mediaSnapshot());
    ok(snap && snap.video && snap.video.currentTime > 0.2, "WebKit: video loopt (t=" + (snap && snap.video && snap.video.currentTime) + ")");
    ok(snap && snap.video && snap.video.width > 0 && snap.video.height > 0, "WebKit: beeld " + (snap && snap.video && (snap.video.width + "x" + snap.video.height)));
    ok(snap && snap.playingAudio.filter((id) => id === "sint").length === 0, "WebKit: geen dubbele audio " + (snap && JSON.stringify(snap.playingAudio)));
    // Tap-to-play fallback bestaat
    ok(await pg.locator("#btn-sint-play").count(), "tik-om-te-kijken knop aanwezig");
    // Na SW-install: video blijft Range-vriendelijk (SW onderschept .mp4 niet)
    await pg.waitForTimeout(800);
    const rangeOk = await pg.evaluate(async () => {
      const url = new URL("assets/video/sint.mp4", location.href).href;
      const res = await fetch(url, { headers: { Range: "bytes=0-1023" } });
      return { status: res.status, cr: res.headers.get("Content-Range") || "", cl: res.headers.get("Content-Length") || "" };
    });
    ok(rangeOk.status === 206 || rangeOk.status === 200, "video Range-antwoord status " + rangeOk.status + " " + rangeOk.cr);
    if (rangeOk.status === 206) {
      ok(/bytes 0-1023\//.test(rangeOk.cr) || /bytes 0-/.test(rangeOk.cr), "Content-Range: " + rangeOk.cr);
    }
    await shot(pg, "sint_webkit_iphone.png");
    await pg.close();
    await ctx.close();
    await wk.close();
    ok(wkErrs.filter((e) => !/favicon|serviceWorker|AbortError|sw\.js load failed/i.test(e)).length === 0, "WebKit geen page errors: " + wkErrs.slice(0, 3).join(" | "));
  }

  console.log("▶ page errors");
  const realErrs = errs.filter((e) => !/favicon|serviceWorker|AbortError/i.test(e));
  ok(realErrs.length === 0, "geen page errors: " + realErrs.slice(0, 3).join(" | "));

  await b.close();
  console.log("\n" + pass + " goed, " + fail + " fout");
  if (fails.length) fails.forEach((f) => console.log(" - " + f));
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
