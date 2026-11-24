# De speurtocht van Sint

Een interactieve Sinterklaas-speurtocht voor **Manu** (8), op de tablet. Hij scant een QR-code op een klein kadootje en volgt Piet tot hij de zak vindt.

**Speel:** https://kmhkasper-boop.github.io/sints-geheim-m26/

Niets verlaat de tablet: foto’s en voortgang blijven lokaal (geen analytics, geen uploads).

## Voor Lucas: de foto van ‘de plek’

1. Maak een duidelijke foto van de zak in de ruimte waar hij écht ligt.
2. Vervang dit bestand (zelfde naam, graag JPEG):

   `assets/images/de-plek.jpg`

   (Er staat nu een duidelijke placeholder: «hier komt de foto».)
3. Optioneel hetzelfde doen voor `assets/images/de-plek.webp` (anders is de JPG genoeg; de app gebruikt de JPG).
4. Daarna: `node tools/build.js` (bumpt de service worker) en opnieuw publiceren.

Zonder die foto werkt het spel al: Manu ziet de placeholder-polaroid en kan de rest afmaken.

## Geheime code

De code staat **op één plek**: `src/config.js` → `secretCode` (standaard **5122**, 4 cijfers).

Printbaar briefje om aan de zak te hangen:

- `print/geheime-code.png` — formaat om op de zak te plakken
- `print/geheime-code-a6.png` — A6 om te printen

Hulp voor ouders als Manu de code niet ziet: houd Piet **3 seconden** ingedrukt op het codescherm. Dan gaat «Gevonden!» vast open.

Opnieuw beginnen: tik **7 keer** op de titel op het startscherm.

## QR-code

- `print/qr-klein.png` — klein, voor op het kadootje
- `print/qr-a6.png` — A6 om te printen

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
