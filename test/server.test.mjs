// Hela servern mot en falsk OpenRouter: inga anrop kostar något här.
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PIXEL = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const IMAGE = `data:image/jpeg;base64,${PIXEL}`;
const PORT = 8391;
const STUB_PORT = 8392;
const BASE = `http://localhost:${PORT}`;

const dir = mkdtempSync(join(tmpdir(), 'spegeln-'));
const configFile = join(dir, 'config.json');
const baseConfig = { mode: 'evil', partyCode: '', maxPerMinute: 1000, imageModel: 'grund', fallbackImageModel: 'reserv', captionModel: 'text', fallbackCaptionModel: 'reservtext' };
const setConfig = (extra = {}) => writeFileSync(configFile, JSON.stringify({ ...baseConfig, ...extra }));

let calls = [];
let script = () => 'ok';

const stub = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const parsed = JSON.parse(body);
    const prompt = parsed.messages[0].content[0].text;
    calls.push({ model: parsed.model, prompt, image: !!parsed.modalities });
    const answer = script(parsed.model, prompt);
    if (answer === 'moderated') {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: { message: 'Generated image rejected by content moderation', metadata: { raw: 'imagine:content-moderated' } } }));
    }
    if (answer === 'broken') {
      res.writeHead(500);
      return res.end('{}');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const message = parsed.modalities ? { images: [{ image_url: { url: IMAGE } }] }
      : { content: answer === 'refusal' ? "I'm sorry, I can't help with that." : 'Tröjan sitter kvar. Du gör det inte.' };
    return res.end(JSON.stringify({ choices: [{ message }], usage: { cost: 0.018 } }));
  });
});

let server;

before(async () => {
  await new Promise((r) => stub.listen(STUB_PORT, r));
  setConfig();
  server = spawn(process.execPath, ['server/index.mjs'], {
    env: { ...process.env, PORT, CONFIG_FILE: configFile, DATA_DIR: join(dir, 'data'), OPENROUTER_URL: `http://localhost:${STUB_PORT}/`, OPENROUTER_API_KEY: 'x' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i += 1) {
    if (await fetch(`${BASE}/api/config`).then(() => true, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('servern startade aldrig');
});

after(() => {
  server.kill();
  stub.close();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  calls = [];
  script = () => 'ok';
  setConfig();
});

const conjure = (body = {}, headers = {}) => fetch(`${BASE}/api/conjure`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ image: IMAGE, aspect: '3:4', theme: 'zombie', sliders: { blod: 100, rot: 100, skrack: 100 }, ...body }),
});

test('grundmodellen används, och bilden hamnar i galleriet med en bildtext', async () => {
  const item = await conjure().then((r) => r.json());
  assert.equal(calls[0].model, 'grund');
  assert.equal(item.softened, false);
  assert.equal(await fetch(`${BASE}${item.url}`).then((r) => r.status), 200);
  const done = await fetch(`${BASE}/api/photos/${item.id}/caption`, { method: 'POST' }).then((r) => r.json());
  assert.equal(done.caption, 'Tröjan sitter kvar. Du gör det inte.');
  const list = await fetch(`${BASE}/api/gallery`).then((r) => r.json());
  assert.equal(list[0].caption, done.caption);
});

test('stoppad av moderering: reservmodellen får försöka med samma prompt', async () => {
  script = (model) => (model === 'grund' ? 'moderated' : 'ok');
  const item = await conjure().then((r) => r.json());
  assert.deepEqual(calls.map((c) => c.model), ['grund', 'reserv']);
  assert.equal(calls[0].prompt, calls[1].prompt);
  assert.equal(item.softened, false);
});

test('båda stoppar: prompten mildras och bilden märks som mildrad', async () => {
  script = (_, prompt) => (prompt.includes('Drenched') ? 'moderated' : 'ok');
  const item = await conjure().then((r) => r.json());
  assert.equal(calls.length, 3);
  assert.doesNotMatch(calls[2].prompt, /Drenched/);
  assert.equal(item.softened, true);
});

test('grundmodellen trasig: reservmodellen tar över', async () => {
  script = (model) => (model === 'grund' ? 'broken' : 'ok');
  assert.equal((await conjure()).status, 200);
});

test('alla steg stoppade: tydligt fel, ingen bild sparas', async () => {
  const before = (await fetch(`${BASE}/api/gallery`).then((r) => r.json())).length;
  script = () => 'moderated';
  assert.equal((await conjure()).status, 422);
  assert.equal((await fetch(`${BASE}/api/gallery`).then((r) => r.json())).length, before);
});

test('bildtextmodellen vägrar: reservmodellen skriver i stället', async () => {
  const item = await conjure().then((r) => r.json());
  script = (model) => (model === 'text' ? 'refusal' : 'ok');
  const done = await fetch(`${BASE}/api/photos/${item.id}/caption`, { method: 'POST' }).then((r) => r.json());
  assert.deepEqual(calls.slice(-2).map((c) => c.model), ['text', 'reservtext']);
  assert.equal(done.caption, 'Tröjan sitter kvar. Du gör det inte.');
});

test('bildtexten fallerar: en färdig rad finns kvar', async () => {
  const item = await conjure().then((r) => r.json());
  script = () => 'broken';
  const done = await fetch(`${BASE}/api/photos/${item.id}/caption`, { method: 'POST' }).then((r) => r.json());
  assert.equal(done.caption, item.caption);
  assert.ok(done.caption.length > 5);
});

test('config.json byter läge direkt, och klienten kan inte ta sig ur snällt läge', async () => {
  await conjure();
  setConfig({ mode: 'not-so-scary' });
  const cfg = await fetch(`${BASE}/api/config`).then((r) => r.json());
  assert.equal(cfg.mode, 'not-so-scary');
  assert.equal(await fetch(`${BASE}/api/gallery`).then((r) => r.json()).then((l) => l.filter((x) => x.mode === 'evil').length), 0);

  calls = [];
  const item = await conjure({ mode: 'evil', prompt: 'gore' }).then((r) => r.json());
  assert.equal(item.mode, 'not-so-scary');
  assert.doesNotMatch(calls[0].prompt.replace('no blood, no skulls', ''), /blood|zombie|gore/i);
  const list = await fetch(`${BASE}/api/gallery`).then((r) => r.json());
  assert.ok(list.some((x) => x.id === item.id));
});

test('festkoden skyddar API:t men inte startsidan', async () => {
  setConfig({ partyCode: 'kusligt' });
  assert.equal((await fetch(`${BASE}/`)).status, 200);
  assert.equal((await fetch(`${BASE}/api/config`).then((r) => r.json())).locked, true);
  assert.equal((await conjure()).status, 401);
  assert.equal((await fetch(`${BASE}/api/gallery`)).status, 401);
  const ok = await conjure({}, { 'x-party-code': 'kusligt' });
  assert.equal(ok.status, 200);
});

test('radering tar bort både post och fil', async () => {
  const item = await conjure().then((r) => r.json());
  assert.equal((await fetch(`${BASE}/api/photos/${item.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await fetch(`${BASE}${item.url}`)).status, 404);
  assert.equal(existsSync(join(dir, 'data', 'photos', `${item.id}.jpg`)), false);
});

test('taket per minut stoppar skenande kostnader', async () => {
  setConfig({ maxPerMinute: 0 });
  assert.equal((await conjure()).status, 429);
  assert.equal(calls.length, 0);
});

test('trasig bild avvisas utan att modellen anropas', async () => {
  assert.equal((await conjure({ image: 'javascript:alert(1)' })).status, 400);
  assert.equal(calls.length, 0);
});

test('sökvägar ur public går inte att nå', async () => {
  for (const path of ['/..%2fconfig.json', '/photos/..%2f..%2fconfig.json', '/%2e%2e/config.json']) {
    const body = await fetch(`${BASE}${path}`).then((r) => r.text());
    assert.doesNotMatch(body, /imageModel/, path);
  }
});
