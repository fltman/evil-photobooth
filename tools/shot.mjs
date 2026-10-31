// Kör hela flödet i äkta Chrome med en falsk kamera och sparar skärmdumpar i progress/.
// Kör: node tools/shot.mjs <kamera.mjpeg> <namn> [bredd] [höjd] [--mobile] [--theme=id] [--no-photo]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const [cam, name, width = '1440', height = '900'] = args.filter((a) => !a.startsWith('--'));
const mobile = flags.includes('--mobile');
const noPhoto = flags.includes('--no-photo');
const theme = flags.find((f) => f.startsWith('--theme='))?.split('=')[1];
const URL = process.env.BOOTH_URL ?? 'http://localhost:8290';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${cam}`,
    '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  permissions: ['camera'],
});
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

const shot = (step) => page.screenshot({ path: `progress/${name}-${step}.png` });

await page.goto(URL);
await page.waitForFunction(() => document.getElementById('enter').textContent);
await page.waitForTimeout(300);
await shot('1-troskel');
await page.click('#enter');
await page.waitForFunction(() => window.booth?.mirror.ready(), null, { timeout: 15000 });
await page.waitForFunction(() => window.booth.mirror.detector, null, { timeout: 30000 }).catch(() => errors.push('detektorn laddades inte'));
await page.waitForTimeout(1800);
await shot('2-spegel');

const scroll = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
const hit = await page.evaluate(() => {
  const r = document.getElementById('conjure').getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.bottom <= innerHeight };
});
console.log('sidmått', JSON.stringify(scroll), 'knappen', JSON.stringify(hit));

if (theme) await page.click(`#themes button:has-text("${theme}")`);

if (noPhoto) {
  // Bara slöjan: håller kvar ansiktsupplösningen utan att anropa modellen.
  await page.evaluate(() => window.booth.mirror.startVeil(3));
  await page.waitForTimeout(1500);
  await shot('3-slöja-halv');
  await page.waitForTimeout(3000);
  await shot('4-slöja-full');
  const faces = await page.evaluate(() => window.booth.mirror.faces.map((f) => ({ x: +f.x.toFixed(2), y: +f.y.toFixed(2), rx: +f.rx.toFixed(2), ry: +f.ry.toFixed(2) })));
  console.log('ansikten', JSON.stringify(faces));
} else {
  const t0 = Date.now();
  await page.click('#conjure');
  await page.waitForTimeout(1200);
  await shot('3-nedrakning');
  await page.waitForFunction(() => document.body.dataset.phase === 'waiting', null, { timeout: 6000 });
  await page.waitForTimeout(6500);
  await shot('4-slojan');
  const faces = await page.evaluate(() => window.booth.mirror.faces.length);
  console.log('ansikten under slöjan:', faces);
  await page.waitForFunction(() => ['result', 'idle'].includes(document.body.dataset.phase), null, { timeout: 120000 });
  console.log('fas', await page.evaluate(() => document.body.dataset.phase), `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.waitForTimeout(900);
  await shot('5-framkallas');
  await page.waitForFunction(() => document.getElementById('caption').textContent.length > 5, null, { timeout: 30000 }).catch(() => errors.push('ingen bildtext'));
  await page.waitForTimeout(4000);
  await shot('6-resultat');
  console.log('bildtext:', await page.textContent('#caption'));
  const saved = await page.evaluate(async () => {
    const { framedPhoto } = await import('/js/gallery.js');
    const list = await fetch('/api/gallery').then((r) => r.json());
    const frames = await fetch('/img/frames.json').then((r) => r.json());
    const dark = document.body.dataset.mode === 'evil';
    const blob = await framedPhoto(list[0], { frames, folder: document.body.dataset.mode, font: dark ? '"IM Fell English", serif' : 'Fredoka, sans-serif', ink: dark ? '#e8dcc8' : '#fff4dc', paper: dark ? '#0a0708' : '#2c1650' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return btoa(bytes.reduce((a, b) => a + String.fromCharCode(b), ''));
  });
  writeFileSync(`progress/${name}-8-sparad.jpg`, Buffer.from(saved, 'base64'));
  await page.click('#open-gallery');
  await page.waitForTimeout(1500);
  await shot('7-galleri');
  await page.click('.gallery-card');
  await page.waitForTimeout(800);
  await shot('9-storbild');
}

const audio = await page.evaluate(() => Object.keys(window.booth.sound.buffers));
console.log('ljud laddade:', audio.length, audio.join(' '));
console.log(errors.length ? `FEL:\n${errors.join('\n')}` : 'inga konsolfel');
await browser.close();
