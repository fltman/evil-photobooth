// Samma hårda prompt genom flera bildmodeller: vilken släpper igenom blod, och behåller den personerna?
// Kör: node tools/probe-models.mjs <bild.jpg> <utmapp> <tema:blod:rot:skräck> <modell> [modell ...]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { EVIL, cleanSettings, imagePrompt } from '../server/modes.mjs';
import { transformImage, Moderated } from '../server/openrouter.mjs';

const [src, out, spec, ...models] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const dataUrl = `data:image/jpeg;base64,${readFileSync(src).toString('base64')}`;
const [theme, blod, rot, skrack] = spec.split(':');
const settings = cleanSettings(EVIL, { theme, sliders: { blod, rot, skrack, sallskap: 30 } });
const prompt = imagePrompt(EVIL, settings);

const results = await Promise.all(models.map(async (model) => {
  const t0 = Date.now();
  const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
  try {
    const img = await transformImage({ model, prompt, dataUrl, aspect: '3:4' });
    const name = `${model.replaceAll('/', '_')}__${spec.replaceAll(':', '_')}.jpg`;
    writeFileSync(join(out, name), Buffer.from(img.dataUrl.split(',')[1], 'base64'));
    return `OK    ${model}  ${secs()}s  $${img.cost}  ${name}`;
  } catch (err) {
    return `${err instanceof Moderated ? 'STOPP' : 'FEL  '} ${model}  ${secs()}s  ${err.message.slice(0, 240)}`;
  }
}));
console.log(results.join('\n'));
