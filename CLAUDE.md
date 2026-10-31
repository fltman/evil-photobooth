# Den onda spegeln

Fotobox för halloween: Node-server utan beroenden (`server/`) + vanilla-JS utan byggsteg (`public/`). Port 8290.

## Kedjan

Knappen → nedräkning → `mirror.snapshot()` → `POST /api/conjure` (prompten byggs i `server/modes.mjs`) →
bilden visas → `POST /api/photos/:id/caption` → bildtexten skrivs fram.

- `server/modes.mjs`: allt innehåll per läge. Klienten skickar bara tema-id och reglagevärden.
- `public/js/mirror.js`: WebGL2-shadern och MediaPipes ansiktsdetektor.
- `public/js/sound.js`: Web Audio. Ljudnamn per läge står i `SFX`.

## Fällor

- **Barnläget är en säkerhetsgräns.** Allt utom exakt `"evil"` ska ge snällt läge, och `test/` vaktar det. Inget
  promptinnehåll får komma från klienten. Galleriet filtreras på läge så att ond bild aldrig visas på ett kalas.
- **Bildmodell:** `seedream-5-0-flash` (18 s, $0,018). Pro tog 47–90+ s. Grok Imagine 2.0 stoppas av xAI:s
  moderering vid blodnivå 3 av 4 och är därför bara reserv. Ändra inte tillbaka utan att mäta.
- xAI tar inte 4:5, så bilderna är 3:4 eller 4:3.
- **Bildtext:** Sonnet 5 svarar på 4–5 s. Grok 4.7 tar 13–22 s och tajmar ibland ut. Grok 4.3 hittar på ord.
- `sound.unlock()` måste ligga före första `await` i klickhanteraren, annars förblir ljudet avstängt på iOS.
- `<video>` får inte ha `display:none`: iOS slutar då leverera bildrutor.
- Signalfärgen i ramarna blir mörk och randig. Stansa på färgton (`gen_frames.py`), inte på avstånd till #FF00FF.
- `tools/shot.mjs` skriver till servern den pekar på. Kör med `DATA_DIR` till en testmapp, annars hamnar
  testbilderna i festens galleri.

## Kostnader

ElevenLabs och Suno är riktiga pengar och kvot. `gen_sfx.py` genererar aldrig om en oförändrad effekt. Fråga innan
ny omgång. Nivåjustering sker i `build_audio.py` och kostar inget. Användaren lyssnar själv: Whisper används inte
för ljudkontroll.

## Språk

All text i gränssnittet är på svenska, med å, ä och ö.
