# Den onda spegeln

[![Support me on Patreon](https://img.shields.io/badge/Patreon-Support%20my%20work-FF424D?style=flat&logo=patreon&logoColor=white)](https://www.patreon.com/AndersBjarby)

En fotobox för halloween. Du väljer vad du ska förvandlas till och drar i reglagen för skräck, blod,
förruttnelse och sällskap. Medan modellen arbetar suddar spegeln ut ansiktsdragen på alla i bilden, och
sedan brinner resultatet fram med en bildtext som passar inställningarna. Allt hamnar i ett gemensamt galleri.

Fungerar på mobil och desktop. Varje bild kostar ungefär 2 cent och tar omkring 20 sekunder.

## Starta

```bash
npm install                      # hämtar även MediaPipe och ansiktsmodellen
export OPENROUTER_API_KEY=...
npm start                        # http://localhost:8290
```

## Barnkalasläge

Ändra en rad i `config.json`:

```json
"mode": "not-so-scary"
```

Det gäller direkt, utan omstart, och kan inte rundas från webbläsaren eftersom prompterna byggs på servern.
Allt annat än exakt `"evil"` blir snällt läge, så ett stavfel kan aldrig ge blod på ett kalas. Teman, reglage,
ram, ljud, musik, väntan och bildtexter byts, och galleriet visar bara bilder från det aktuella läget.

## config.json

| Nyckel | Betydelse |
| --- | --- |
| `mode` | `evil` eller `not-so-scary` |
| `partyCode` | Tomt är öppet. Annars måste gästerna ange koden. Krävs för driftsättning. |
| `maxPerMinute` | Tak för hela servern, så att kostnaden inte kan skena |
| `imageModel`, `fallbackImageModel` | Bildmodell och reserv |
| `captionModel`, `fallbackCaptionModel` | Bildtextmodell och reserv |

## Mobilen

Webbläsare släpper bara fram kameran över https eller på `localhost`. Över vanlig http från en telefon
erbjuder sidan i stället att välja en bild, vilket öppnar telefonens kamera. För livespegeln krävs https:

```bash
# Sätt partyCode i config.json och peka spegeln.bjarby.com på servern först.
npm run deploy
```

## Bilder och integritet

Bilderna skickas till OpenRouter och sparas i `data/` på servern. Alla som kommer in kan se och radera
dem i galleriet.

## Bygga om tillgångarna

| Kommando | Vad det gör |
| --- | --- |
| `python3 tools/gen_frames.py` | Genererar saknade ramar. `--recut` stansar om utan kostnad. |
| `python3 tools/gen_sfx.py` | Genererar bara ändrade ljudeffekter. `--dry` visar vad det skulle bli. |
| `python3 tools/build_audio.py` | Nivåjusterar `assets-src/` till `public/audio/` utan kostnad. |

Musiken läggs som `assets-src/music/evil.mp3` och `assets-src/music/kind.mp3`. Barnläget saknar musik än så länge och är tyst tills filen finns.

## Tester

```bash
npm test                                             # logik och server mot en falsk OpenRouter
node tools/shot.mjs kamera.mjpeg namn 390 844 --mobile # hela flödet i Chrome, kostar en bild
node tools/nocam.mjs bild.jpg namn                   # reservvägen utan kamera
```

Ansiktsdetektion: [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) (Apache 2.0).
Typsnitt: Pirata One, IM Fell English och Fredoka (SIL OFL, se `public/fonts/OFL.txt`).
Övrig kod: MIT, se `LICENSE`.
