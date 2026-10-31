// Liten Node-server utan beroenden: håller OpenRouter-nyckeln, bygger prompterna och äger galleriet.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOFTENING_STEPS, captionPrompt, cleanSettings, fallbackCaption, imagePrompt, publicMode, resolveMode } from './modes.mjs';
import { Moderated, transformImage, writeCaption } from './openrouter.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const CONFIG = process.env.CONFIG_FILE ?? join(ROOT, 'config.json');
const DATA = process.env.DATA_DIR ?? join(ROOT, 'data');
const PHOTOS = join(DATA, 'photos');
const GALLERY = join(DATA, 'gallery.json');
const PORT = Number(process.env.PORT ?? 8290);
const MAX_BODY = 8 * 1024 * 1024;
const DEADLINE_MS = 100_000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.tflite': 'application/octet-stream',
};

mkdirSync(PHOTOS, { recursive: true });

// Läses om vid varje anrop, så att byte till barnkalasläge gäller direkt utan omstart.
const config = () => JSON.parse(readFileSync(CONFIG, 'utf8'));
const readGallery = () => (existsSync(GALLERY) ? JSON.parse(readFileSync(GALLERY, 'utf8')) : []);

function writeGallery(items) {
  writeFileSync(`${GALLERY}.tmp`, JSON.stringify(items, null, 2));
  renameSync(`${GALLERY}.tmp`, GALLERY);
}

const recent = [];
function overLimit(perMinute) {
  const now = Date.now();
  while (recent.length && now - recent[0] > 60_000) recent.shift();
  if (recent.length >= perMinute) return true;
  recent.push(now);
  return false;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('för stor bild'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Testar grundmodellen och sedan reservmodellen. Säger båda nej mildras prompten ett steg i taget.
async function conjure(cfg, mode, settings, dataUrl, aspect) {
  const started = Date.now();
  const models = [cfg.imageModel, cfg.fallbackImageModel].filter(Boolean);
  let last;
  for (let softening = 0; softening < SOFTENING_STEPS; softening += 1) {
    for (const model of models) {
      const left = DEADLINE_MS - (Date.now() - started);
      if (left < 5_000) throw last ?? new Error('tiden tog slut');
      try {
        const result = await transformImage({ model, prompt: imagePrompt(mode, settings, softening), dataUrl, aspect, timeoutMs: Math.min(60_000, left) });
        return { ...result, model, softened: softening > 0 };
      } catch (err) {
        last = err;
        console.warn(`[conjure] ${model} steg ${softening}: ${err instanceof Moderated ? 'stoppad av moderering' : err.message}`);
      }
    }
  }
  throw last;
}

async function handleConjure(req, res, cfg, mode) {
  if (overLimit(cfg.maxPerMinute ?? 20)) return json(res, 429, { error: 'busy' });
  const body = JSON.parse(await readBody(req));
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(body.image ?? '')) return json(res, 400, { error: 'bad image' });
  const aspect = body.aspect === '4:3' ? '4:3' : '3:4';
  const settings = cleanSettings(mode, body);

  const result = await conjure(cfg, mode, settings, body.image, aspect);
  const id = randomUUID();
  writeFileSync(join(PHOTOS, `${id}.jpg`), Buffer.from(result.dataUrl.split(',')[1], 'base64'));
  const item = {
    id, mode, aspect, ...settings,
    url: `/photos/${id}.jpg`,
    caption: fallbackCaption(mode),
    captioned: false,
    softened: result.softened,
    createdAt: new Date().toISOString(),
  };
  writeGallery([item, ...readGallery()]);
  console.log(`[conjure] ${result.model} ${settings.theme} $${result.cost}${result.softened ? ' (mildrad)' : ''}`);
  return json(res, 200, item);
}

// Bildtexten är ett eget anrop: bilden ska visas direkt och texten skrivas fram efteråt.
async function handleCaption(res, cfg, id) {
  const item = readGallery().find((x) => x.id === id);
  if (!item) return json(res, 404, { error: 'not found' });
  if (item.captioned) return json(res, 200, item);
  const dataUrl = `data:image/jpeg;base64,${readFileSync(join(PHOTOS, `${id}.jpg`)).toString('base64')}`;
  let caption = item.caption;
  for (const model of [cfg.captionModel, cfg.fallbackCaptionModel].filter(Boolean)) {
    try {
      ({ text: caption } = await writeCaption({ model, prompt: captionPrompt(item.mode, item), dataUrl }));
      break;
    } catch (err) {
      console.warn(`[caption] ${model}: ${err.message}`);
    }
  }
  const items = readGallery();
  const current = items.find((x) => x.id === id);
  if (!current) return json(res, 404, { error: 'not found' });
  Object.assign(current, { caption, captioned: true });
  writeGallery(items);
  return json(res, 200, current);
}

function handleDelete(res, id) {
  const items = readGallery();
  if (!items.some((x) => x.id === id)) return json(res, 404, { error: 'not found' });
  writeGallery(items.filter((x) => x.id !== id));
  rmSync(join(PHOTOS, `${id}.jpg`), { force: true });
  return json(res, 200, { ok: true });
}

function serveFile(res, base, path, cache) {
  const file = normalize(join(base, path));
  if (!file.startsWith(base + sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': cache });
  return createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    const cfg = config();
    const mode = resolveMode(cfg.mode);
    const unlocked = !cfg.partyCode || req.headers['x-party-code'] === cfg.partyCode;

    if (pathname === '/api/config') return json(res, 200, { ...publicMode(mode), locked: !unlocked });
    if (pathname.startsWith('/api/') && !unlocked) return json(res, 401, { error: 'party code' });

    if (pathname === '/api/gallery' && req.method === 'GET') {
      // Bara det aktuella lägets bilder: blodet från igår får inte dyka upp på dagens barnkalas.
      return json(res, 200, readGallery().filter((x) => x.mode === mode));
    }
    if (pathname === '/api/conjure' && req.method === 'POST') return await handleConjure(req, res, cfg, mode);

    const photo = pathname.match(/^\/api\/photos\/([0-9a-f-]{36})(\/caption)?$/);
    if (photo && photo[2] && req.method === 'POST') return await handleCaption(res, cfg, photo[1]);
    if (photo && !photo[2] && req.method === 'DELETE') return handleDelete(res, photo[1]);
    if (pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' });

    if (pathname.startsWith('/photos/')) return serveFile(res, PHOTOS, pathname.slice('/photos/'.length), 'private, max-age=86400');
    const longCache = /^\/(vendor|fonts|audio|img)\//.test(pathname);
    return serveFile(res, PUBLIC, pathname === '/' ? 'index.html' : pathname.slice(1), longCache ? 'public, max-age=3600' : 'no-cache');
  } catch (err) {
    console.error('[fel]', err);
    if (!res.headersSent) json(res, err instanceof Moderated ? 422 : 500, { error: err instanceof Moderated ? 'moderated' : 'failed' });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Spegeln vaknar på http://localhost:${PORT} (läge: ${resolveMode(config().mode)})`);
  if (!process.env.OPENROUTER_API_KEY) console.warn('OPENROUTER_API_KEY saknas: spegeln kommer inte att kunna framkalla något.');
});
