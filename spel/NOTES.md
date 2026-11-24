# Pieten spel – werknotities (executor)
- Bron: /workspace/pieten-spel-repo/spel (eigen clone van sints-geheim-m26). Werkmap assets: /workspace/pieten-spel-work
- Bestanden: index.html, spel.css, levels.js, audio.js (WebAudio sfx+muziek), spel.js, assets/*.webp (Imagine), video/, voice/ (ElevenLabs Dex SpRzmdV0YTgetjcWNbpH eleven_v4)
- Debug: ?debug=1 → window.PS (start(n), win(), god(), world()); N = level winnen
- Bot-test: /workspace/pieten-spel-work/bot.js + runbot.js (L1, L2 gehaald met bot; L3 bot faalt bij liften: botprobleem)
- Sint call: Maarten -8% -6Hz + HeyGen Avatar 6 Turbo op sint-portrait.jpg (ElevenLabs flow xd8Y57aX8nOhAln1M9sK)
- DONE: HeyGen-video in spel/video (sint-belt 17s, sint-vraag 4s). Knop in src/app.js. tests/pietenspel.test.js.
- DONE: build + tests (78 ok; speurtocht 29 ok); bot haalt L1-3 in god-modus. PUSHED da1c364, live OK. Bot zonder god: L1+L2 ok, L3 blijft hangen (bot ontwijkt geen vijanden).

## Telefoon-ronde (24 nov)
- viewport meta + iOS zoom-reset na draaien; gesture/dblclick/touchmove/multi-touch geblokt; canvas-maat uit layout viewport (niet ingezoomd), style px gezet.
- draai-overlay #rotate in staand (pauzeert, hervat bij terugdraaien); niet tijdens ring/call/ended.
- goFull(): requestFullscreen + orientation.lock('landscape') bij level-tik (Android). manifest.webmanifest fullscreen/landscape, icons/ in spel/. iOS-tip in menu.
- CSS @media (max-height:440px) voor kleine telefoons; menu grid met Piet links.
- SW: spel registreert ../sw.js (zelfde als hoofdapp).
- Test: tests/pietenspel-mobiel.test.js (iPhone 12/SE, Pixel 5, 740x360; 3x draaien).
