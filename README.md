# De speurtocht van Sint

Een interactieve Sinterklaas-speurtocht voor **Manu** (8), op de tablet. Hij scant een QR-code op een klein kadootje en volgt Piet tot hij de zak vindt.

**Speel:** https://kmhkasper-boop.github.io/sints-geheim-m26/

Niets verlaat de tablet: foto’s en voortgang blijven lokaal (geen analytics, geen uploads).

## De foto van ‘de plek’

De polaroid toont de echte foto van de plek (witte kastdeur tussen grijze gordijnen) in `assets/images/de-plek.jpg`. Onderschrift: «de plek».

## Geheime code

De code staat **op één plek**: `src/config.js` → `secretCode` (standaard **5122**, 4 cijfers).

Printbaar briefje om aan de zak te hangen:

- `print/geheime-code.png` — formaat om op de zak te plakken
- `print/geheime-code-a6.png` — A6 om te printen

Hulp voor ouders als Manu de code niet ziet: houd Piet **3 seconden** ingedrukt op het codescherm. Dan gaat «Gevonden!» vast open.

Opnieuw beginnen (handig bij testen): op het startscherm staat een klein **opnieuw beginnen**. Na bevestiging wordt de voortgang gewist, de oude cache/service worker opgeruimd, en laadt de nieuwste versie. Tikken **7 keer** op de titel doet hetzelfde.

## QR-code

Printbare Sinterklaas-kaartjes (300 dpi) met de QR naar de speurtocht:

- `print/qr-kaart-a6.png` — A6 (105 × 148 mm)
- `print/qr-kadokaartje.png` — klein kadokaartje (60 × 90 mm)

(Oudere kale QR-jes blijven staan als `print/qr-a6.png` en `print/qr-klein.png`.)

## Hoe het loopt

1. Tik op **Start!** (nodig voor geluid op iPhone/iPad).
2. Filmpje van Sinterklaas met een kort gedicht (traditie + een bericht voor Manu). **Nog een keer** of **Verder**.
3. Piet vraagt om een foto van de ruimte. Drie keer zegt hij «koud», met een thermometer. Ondertussen kan Manu **Strooi!** doen: virtuele pepernoten (met teller).
4. Daarna vraagt Piet om een foto van de **koelkast**. Op die foto vliegt een polaroid van «de plek» met een magneetje. Tik erop voor een grote weergave.
5. Op de zak hangt het briefje met de code. Die tikt hij in, dan **Gevonden!**
6. Korte versie van het volksliedje *De zak van Sinterklaas* (eigen arrangement), terwijl de zak op het dak, in de schoorsteen, op de stoomboot en op Amerigo landt. Amerigo hinnikt aan het eind. Piet noemt het aantal gestrooide pepernoten.
7. Oorkonde **Officiële Hulppiet** voor *Manu Maliek Sprangers*, met de datum van die dag (2026) en het pepernotenaantal. Te bewaren of te printen.

## Techniek

- Bron in `src/` (`config.js`, `style.css`, `app.js`). `node tools/build.js` schrijft `index.html` en `sw.js` (versie bumpt automatisch).
- Alle bestanden van hetzelfde domein, offline via de service worker. Lettertypes in `fonts/`.
- Camera: achtercamera via `getUserMedia`, met een file-input als reserve (en voor de tests).
- Tests: `node tests/speurtocht.test.js` (Playwright, Chrome). Layouts 768×1024, 1024×768 en 800×1280.

## Het gedicht

Zie `src/rijm.txt`. Op het scherm staat de naam als **Manu**; in de stem klinkt die als **Mannoe**.

## Piet-stem (ElevenLabs, ook voor `/spel/`)

Piet spreekt via ElevenLabs. Houd in het Pieten spel (`/spel/`) dezelfde stem aan:

- **voice_id:** `SpRzmdV0YTgetjcWNbpH`
- **stem:** Dex – Energetic Dutch Commercial, TVHost
- **model_id:** `eleven_v4`
- **Gesproken naam:** Mannoe (in het script; eventueel IPA `/mɑˈnu/`). Op het scherm blijft de naam **Manu**.
- **Pepernotenteller:** Piet zegt een afgerond aantal in hele zinnen (Dex, `eleven_v4`), bijvoorbeeld «een stuk of vijftig». Het exacte aantal staat in het tekstballonnetje op het zak-scherm en op de oorkonde. Boven de 999 blijft de bestaande regel «ontzettend veel».

## Pieten spel (`/spel/`)
Platformspel als extraatje: knop "🎮 Pieten spel" op het oorkondescherm, of direct `spel/`.
3 levels (1 kort/makkelijk, 2 makkelijk, 3 pittig met vlaggen-checkpoints). Touch + toetsen (pijltjes/WASD, spatie = springen, E/X = gooien).
Na level 1 een eenmalig "Sint belt mama"-tussenstuk (video `spel/video/sint-belt.mp4`; Maarten-TTS -8%/-6Hz + HeyGen Avatar 6 Turbo).
Voortgang in localStorage `pieten_spel_v1`. Ouder-reset: tik 7× op de titel "Pieten spel" in het menu (zet ook het belletje weer aan).
Test: `node tests/pietenspel.test.js http://127.0.0.1:8777/`. Debug: `spel/?debug=1` (N = level winnen, I = onkwetsbaar).
