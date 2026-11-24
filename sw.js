/* Speurtocht service worker – gegenereerd door tools/build.js. Alleen eigen bestanden, geen externe verzoeken. */
const VERSION = "v1d44ce780f";
const CACHE = "sint-speurtocht-" + VERSION;
const FILES = [
 "./",
 "./assets/audio/flits.mp3",
 "./assets/audio/fonkel.mp3",
 "./assets/audio/fout.mp3",
 "./assets/audio/goed.mp3",
 "./assets/audio/hinnik.mp3",
 "./assets/audio/piet-again1.mp3",
 "./assets/audio/piet-again2.mp3",
 "./assets/audio/piet-code.mp3",
 "./assets/audio/piet-cold1.mp3",
 "./assets/audio/piet-cold2.mp3",
 "./assets/audio/piet-cold3.mp3",
 "./assets/audio/piet-found.mp3",
 "./assets/audio/piet-fridge.mp3",
 "./assets/audio/piet-hangt.mp3",
 "./assets/audio/piet-intro.mp3",
 "./assets/audio/piet-oorkonde.mp3",
 "./assets/audio/piet-pep-0.mp3",
 "./assets/audio/piet-pep-1.mp3",
 "./assets/audio/piet-pep-100.mp3",
 "./assets/audio/piet-pep-12.mp3",
 "./assets/audio/piet-pep-15.mp3",
 "./assets/audio/piet-pep-150.mp3",
 "./assets/audio/piet-pep-20.mp3",
 "./assets/audio/piet-pep-200.mp3",
 "./assets/audio/piet-pep-25.mp3",
 "./assets/audio/piet-pep-250.mp3",
 "./assets/audio/piet-pep-30.mp3",
 "./assets/audio/piet-pep-300.mp3",
 "./assets/audio/piet-pep-350.mp3",
 "./assets/audio/piet-pep-40.mp3",
 "./assets/audio/piet-pep-400.mp3",
 "./assets/audio/piet-pep-450.mp3",
 "./assets/audio/piet-pep-50.mp3",
 "./assets/audio/piet-pep-500.mp3",
 "./assets/audio/piet-pep-60.mp3",
 "./assets/audio/piet-pep-600.mp3",
 "./assets/audio/piet-pep-70.mp3",
 "./assets/audio/piet-pep-700.mp3",
 "./assets/audio/piet-pep-80.mp3",
 "./assets/audio/piet-pep-800.mp3",
 "./assets/audio/piet-pep-90.mp3",
 "./assets/audio/piet-pep-900.mp3",
 "./assets/audio/piet-pep-bijna1000.mp3",
 "./assets/audio/piet-pep-handjevol.mp3",
 "./assets/audio/piet-pep-paar.mp3",
 "./assets/audio/piet-pep_veel.mp3",
 "./assets/audio/piet-tap.mp3",
 "./assets/audio/piet-wrong.mp3",
 "./assets/audio/sint-rijm.mp3",
 "./assets/audio/stil.mp3",
 "./assets/audio/strooi.mp3",
 "./assets/audio/tik.mp3",
 "./assets/audio/zak-lied.mp3",
 "./assets/images/de-plek.jpg",
 "./assets/images/de-plek.webp",
 "./assets/images/geheime-code-kaart.png",
 "./assets/images/magneet.png",
 "./assets/images/oorkonde-kader.jpg",
 "./assets/images/oorkonde-kader.webp",
 "./assets/images/pepernoot.jpg",
 "./assets/images/pepernoot.png",
 "./assets/images/perkament.jpg",
 "./assets/images/perkament.webp",
 "./assets/images/piet-cold.jpg",
 "./assets/images/piet-cold.png",
 "./assets/images/piet-excited.jpg",
 "./assets/images/piet-excited.png",
 "./assets/images/piet-talking.jpg",
 "./assets/images/piet-talking.png",
 "./assets/images/piet-thinking.jpg",
 "./assets/images/piet-thinking.png",
 "./assets/images/sint-portrait.jpg",
 "./assets/images/sint-portrait.webp",
 "./assets/images/sint-zak.jpg",
 "./assets/images/sint-zak.png",
 "./assets/images/zak-dak.jpg",
 "./assets/images/zak-dak.webp",
 "./assets/images/zak-paard.jpg",
 "./assets/images/zak-paard.webp",
 "./assets/images/zak-schoorsteen.jpg",
 "./assets/images/zak-schoorsteen.webp",
 "./assets/images/zak-stoomboot.jpg",
 "./assets/images/zak-stoomboot.webp",
 "./assets/video/sint.mp4",
 "./fonts/cinzel.ttf",
 "./fonts/cinzel.woff2",
 "./fonts/fredoka-latin.woff2",
 "./fonts/great-vibes.ttf",
 "./fonts/great-vibes.woff2",
 "./icons/apple-touch-icon.png",
 "./icons/favicon-48.png",
 "./icons/icon-192.png",
 "./icons/icon-512.png",
 "./icons/icon-maskable-512.png",
 "./icons/icon.svg",
 "./manifest.webmanifest",
 "./spel/assets/dakpannen.webp",
 "./spel/assets/huizen.webp",
 "./spel/assets/kat.webp",
 "./spel/assets/kraai.webp",
 "./spel/assets/lucht.webp",
 "./spel/assets/pakje-blauw.webp",
 "./spel/assets/pakje-groen.webp",
 "./spel/assets/pakje-rood.webp",
 "./spel/assets/pepernoot.webp",
 "./spel/assets/piet-blij.webp",
 "./spel/assets/piet-gooien.webp",
 "./spel/assets/piet-rennen.webp",
 "./spel/assets/piet-springen.webp",
 "./spel/assets/piet-staan.webp",
 "./spel/assets/schoorsteen.webp",
 "./spel/assets/sint-poster.webp",
 "./spel/assets/sint-rond.webp",
 "./spel/assets/zak.webp",
 "./spel/audio.js",
 "./spel/index.html",
 "./spel/levels.js",
 "./spel/spel.css",
 "./spel/spel.js",
 "./spel/video/sint-belt.mp4",
 "./spel/video/sint-vraag.mp4",
 "./spel/voice/piet-allemaal.mp3",
 "./spel/voice/piet-au.mp3",
 "./spel/voice/piet-gelukt.mp3",
 "./spel/voice/piet-level3.mp3",
 "./spel/voice/piet-raak.mp3",
 "./spel/voice/piet-start.mp3",
 "./src/app.js",
 "./src/config.js",
 "./src/lied-cues.js",
 "./src/lied-cues.json",
 "./src/rijm.txt",
 "./src/shell.html",
 "./src/style.css"
];

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
