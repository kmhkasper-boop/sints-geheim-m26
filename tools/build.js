#!/usr/bin/env node
/* Schrijft index.html (kopie van de shell) en sw.js met alle te cachen bestanden. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules" || name === "screenshots") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const skip = new Set([
  "README.md",
  "tools/build.js",
  "tools/make_assets.py",
  "src/shell.html",
  "src/rijm.txt",
  "src/lied-cues.json",
]);
// skip raw wav, raw video sources, print (optional: include print? no, not needed in the PWA)
const skipExt = new Set([".wav", ".py", ".md"]);
const skipDir = new Set(["tools", "tests", "print", "screenshots", ".git"]);

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

const files = [];
function walk2(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = path.join(dir, name);
    const r = rel(p);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (skipDir.has(name)) continue;
      walk2(p);
    } else {
      if (skipExt.has(path.extname(name))) continue;
      if (name.endsWith("-raw.mp4")) continue;
      if (r === "index.html") continue;
      if (r === "sw.js") continue;
      files.push("./" + r);
    }
  }
}
walk2(ROOT);
files.sort();
const list = ["./"].concat(files.filter((f) => f !== "./index.html"));

let hash = crypto.createHash("sha1");
for (const f of list) {
  const p = path.join(ROOT, f === "./" ? "src/shell.html" : f.replace(/^\.\//, ""));
  if (fs.existsSync(p)) hash.update(fs.readFileSync(p));
  hash.update(f);
}
const version = hash.digest("hex").slice(0, 10);

const sw = `/* Speurtocht service worker – gegenereerd door tools/build.js. Alleen eigen bestanden, geen externe verzoeken. */
const VERSION = ${JSON.stringify("v" + version)};
const CACHE = "sint-speurtocht-" + VERSION;
const FILES = ${JSON.stringify(list, null, 1)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("sint-speurtocht-") && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        return res;
      }).catch(() => cached);
    })
  );
});
`;
fs.writeFileSync(path.join(ROOT, "sw.js"), sw);
fs.copyFileSync(path.join(ROOT, "src/shell.html"), path.join(ROOT, "index.html"));
console.log("sw.js", VERSION_LOG(version), "files", list.length);
function VERSION_LOG(v) { return v; }
