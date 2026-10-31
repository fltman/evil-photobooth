import { Mirror } from './mirror.js';
import { Sound } from './sound.js';
import { Gallery, savePhoto } from './gallery.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STYLE = {
  evil: { folder: 'evil', font: '"IM Fell English", serif', ink: '#e8dcc8', paper: '#0a0708' },
  kind: { folder: 'kind', font: 'Fredoka, sans-serif', ink: '#fff4dc', paper: '#2c1650' },
};

let cfg, style, frames, mirror, sound, gallery;
let partyCode = localStorage.getItem('partyCode') ?? '';
let theme;
const sliders = {};
let busy = false;
let run = 0;
let lastItem = null;

async function api(path, init = {}) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-party-code': partyCode, ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? res.status), { status: res.status });
  return body;
}

function applyFrame() {
  const landscape = matchMedia('(orientation: landscape)').matches;
  const key = `${style.folder}-${landscape ? 'landscape' : 'portrait'}`;
  const geo = frames[key];
  const box = $('mirror');
  box.dataset.aspect = geo.aspect;
  box.style.setProperty('--ratio', geo.ratio);
  $('frame').src = `/img/frame-${key}.webp`;
  Object.assign($('glass').style, {
    left: `${geo.x * 100}%`, top: `${geo.y * 100}%`, width: `${geo.w * 100}%`, height: `${geo.h * 100}%`,
  });
}

function pushSliders() {
  const [a, b, c] = cfg.sliders.map((s) => sliders[s.id] / 100);
  mirror.setSliders(a, b, c);
}

function buildControls() {
  const themes = $('themes');
  themes.replaceChildren(...cfg.themes.map((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.label;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', i === 0);
    b.onclick = () => {
      theme = t.id;
      themes.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', x === b));
      sound.play('pick', { gain: 0.7 });
    };
    return b;
  }));
  theme = cfg.themes[0].id;

  const box = $('sliders');
  box.replaceChildren(...cfg.sliders.map((s) => {
    sliders[s.id] = s.value;
    const label = document.createElement('label');
    label.className = 'slider';
    label.innerHTML = '<span class="slider-name"></span><input type="range" min="0" max="100" step="1"><span class="slider-ends"><i></i><i></i></span>';
    label.querySelector('.slider-name').textContent = s.label;
    const [low, high] = label.querySelectorAll('i');
    low.textContent = s.low;
    high.textContent = s.high;
    const input = label.querySelector('input');
    input.value = s.value;
    input.setAttribute('aria-label', s.label);
    input.style.setProperty('--v', `${s.value}%`);
    let lastTick = s.value;
    input.oninput = () => {
      const v = Number(input.value);
      sliders[s.id] = v;
      input.style.setProperty('--v', `${v}%`);
      pushSliders();
      if (Math.abs(v - lastTick) >= 6) {
        lastTick = v;
        sound.play('tick', { gain: 0.5, rate: 0.75 + v / 100 });
      }
    };
    return label;
  }));
  pushSliders();
}

function setStatus(text) {
  const el = $('status');
  el.classList.remove('show');
  if (!text) return;
  el.textContent = text;
  void el.offsetWidth;
  el.classList.add('show');
}

function setPhase(phase) {
  document.body.dataset.phase = phase;
}

async function countdown() {
  const el = $('count');
  for (const n of [3, 2, 1]) {
    el.textContent = n;
    el.classList.remove('beat');
    void el.offsetWidth;
    el.classList.add('beat');
    sound.play('toll', { gain: 0.8, rate: 1 - (3 - n) * 0.06 });
    await sleep(950);
  }
  el.textContent = '';
}

// Medan modellen arbetar: spegeln tar ansiktet, och ljudet kryper närmare.
function startWaiting() {
  const intensity = cfg.mode === 'evil' ? sliders.skrack / 100 : 0.5;
  mirror.startVeil(6);
  sound.duckMusic(0.18, 2);
  if (cfg.mode === 'evil') {
    sound.loop('heartbeat', { gain: 0.5 + intensity * 0.5, fade: 3 });
    sound.loop('whispers', { gain: 0.25 + intensity * 0.55, fade: 6 });
    sound.play('rise', { gain: 0.45, delay: 3 });
  } else {
    sound.loop('bubbles', { gain: 0.55, fade: 1.5 });
    sound.loop('giggles', { gain: 0.45, fade: 3 });
  }
  let i = 0;
  const lines = [...cfg.waitLines].sort(() => Math.random() - 0.5);
  setStatus(lines[0]);
  const timer = setInterval(() => setStatus(lines[(i += 1) % lines.length]), 3400);
  return () => {
    clearInterval(timer);
    setStatus('');
  };
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

async function typeCaption(text, mine) {
  const el = $('caption');
  el.textContent = '';
  for (const ch of text) {
    if (mine !== run) return;
    el.textContent += ch;
    await sleep(ch === ' ' ? 34 : 24);
  }
}

async function conjure() {
  if (busy || !mirror.ready()) return;
  busy = true;
  const mine = ++run;
  sound.wake();
  $('caption').textContent = '';
  $('note').textContent = '';
  setPhase('countdown');
  await countdown();

  const aspect = $('mirror').dataset.aspect;
  const image = mirror.snapshot(aspect);
  sound.play('shutter');
  mirror.firePhotoFlash();
  setPhase('waiting');
  const stopWaiting = startWaiting();

  try {
    const item = await api('/api/conjure', { method: 'POST', body: JSON.stringify({ image, aspect, theme, sliders }) });
    const photo = await loadImage(item.url);
    stopWaiting();
    sound.stopLoops(0.6);
    sound.play('sting');
    if (cfg.mode === 'evil') sound.play('crack', { gain: 0.6 });
    sound.duckMusic(0.5, 4);
    mirror.showResult(photo);
    lastItem = item;
    setPhase('result');
    if (item.softened && cfg.softenedNote) $('note').textContent = cfg.softenedNote;
    $('caption').classList.add('pending');
    const done = await api(`/api/photos/${item.id}/caption`, { method: 'POST' }).catch(() => item);
    if (mine !== run) return;
    lastItem = done;
    $('caption').classList.remove('pending');
    await typeCaption(done.caption, mine);
  } catch (err) {
    console.error(err);
    stopWaiting();
    sound.stopLoops(0.4);
    sound.play('growl');
    sound.duckMusic(0.5, 2);
    mirror.clearVeil();
    setPhase('idle');
    setStatus(cfg.errorLine);
    setTimeout(() => setStatus(''), 4000);
  }
  busy = false;
}

function resetMirror() {
  run += 1;
  busy = false;
  mirror.clearVeil();
  lastItem = null;
  $('caption').classList.remove('pending');
  $('caption').textContent = '';
  $('note').textContent = '';
  setPhase('idle');
}

async function startCamera() {
  const video = $('cam');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
  });
  video.srcObject = stream;
  await video.play();
  mirror.setSource(video);
}

// Kameran kräver https (eller localhost). Utan den går det ändå att välja en bild.
function offerUpload(message) {
  $('nocam-text').textContent = message;
  $('nocam').hidden = false;
  $('upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await loadImage(URL.createObjectURL(file));
    mirror.setSource(img);
    $('nocam').hidden = true;
  };
}

async function enter() {
  sound.unlock();    // före första await: iOS släpper bara upp ljudet direkt i trycket
  if (cfg.locked) {
    partyCode = $('code').value.trim();
    const check = await fetch('/api/config', { headers: { 'x-party-code': partyCode } }).then((r) => r.json());
    if (check.locked) {
      $('code').classList.add('wrong');
      return;
    }
    localStorage.setItem('partyCode', partyCode);
  }
  $('threshold').classList.add('gone');
  setTimeout(() => { $('threshold').hidden = true; }, 1200);
  document.body.dataset.entered = '1';
  sound.loading.then(() => sound.play('enter', { gain: 0.8 }));
  mirror.resize();
  try {
    await startCamera();
  } catch (err) {
    console.warn(err);
    offerUpload(window.isSecureContext ? 'Spegeln får inte se dig. Tillåt kameran, eller välj en bild.' : 'Kameran kräver en säker anslutning. Välj en bild i stället.');
  }
  mirror.loadDetector();
}

async function boot() {
  [cfg, frames] = await Promise.all([
    fetch('/api/config', { headers: { 'x-party-code': partyCode } }).then((r) => r.json()),
    fetch('/img/frames.json').then((r) => r.json()),
  ]);
  const kind = cfg.mode !== 'evil';
  style = kind ? STYLE.kind : STYLE.evil;
  document.body.dataset.mode = style.folder;
  document.title = cfg.title;
  $('title').textContent = cfg.title;
  $('wordmark').textContent = cfg.title;
  $('tagline').textContent = cfg.tagline;
  $('enter').textContent = cfg.enter;
  $('conjure').textContent = cfg.button;
  $('again').textContent = cfg.again;
  $('code').hidden = !cfg.locked;

  sound = new Sound(style.folder);
  mirror = new Mirror($('glass'), { kind });
  buildControls();
  applyFrame();
  matchMedia('(orientation: landscape)').addEventListener('change', applyFrame);

  const options = { frames, ...style };
  gallery = new Gallery({ root: $('gallery'), api, sound, options, title: cfg.galleryTitle, emptyText: cfg.galleryEmpty });

  $('enter').onclick = enter;
  $('conjure').onclick = conjure;
  $('again').onclick = resetMirror;
  $('save').onclick = () => lastItem && savePhoto(lastItem, options);
  $('open-gallery').onclick = () => gallery.open();
  const mute = $('mute');
  const paintMute = () => {
    mute.setAttribute('aria-pressed', sound.muted);
    mute.textContent = sound.muted ? 'Ljud av' : 'Ljud på';
  };
  mute.onclick = () => {
    sound.setMuted(!sound.muted);
    paintMute();
  };
  paintMute();
  window.booth = { mirror, sound, gallery };
}

boot();
