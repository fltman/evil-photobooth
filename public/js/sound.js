// Web Audio i stället för <audio>: mobiler låser upp ljudet på ett enda tryck, och looparna går utan glapp.

const MUSIC_FADE = 4;
const SFX = {
  evil: ['enter', 'toll', 'shutter', 'heartbeat', 'whispers', 'rise', 'sting', 'crack', 'tick', 'pick', 'lid', 'growl'],
  kind: ['enter', 'toll', 'shutter', 'bubbles', 'giggles', 'sting', 'tick', 'pick', 'lid', 'growl'],
};

export class Sound {
  constructor(folder) {
    this.folder = folder;
    this.buffers = {};
    this.loops = {};
    this.muted = localStorage.getItem('muted') === '1';
  }

  // Måste anropas inne i ett tryck: annars förblir ljudet avstängt på iOS.
  unlock() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.loading = Promise.all([...SFX[this.folder], 'music'].map((name) => this.fetch(name)));
    this.loading.then(() => this.startMusic());
  }

  async fetch(name) {
    try {
      const res = await fetch(`/audio/${this.folder}/${name}.mp3`);
      if (res.ok) this.buffers[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch (err) {
      console.warn('Ljud saknas:', name, err);
    }
  }

  // iOS stänger av ljudet vid avbrott, till exempel ett samtal.
  wake() {
    if (this.ctx?.state !== 'running') this.ctx?.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('muted', muted ? '1' : '0');
    this.master?.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  play(name, { gain = 1, rate = 1, delay = 0 } = {}) {
    const buffer = this.buffers[name];
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    const amp = this.ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    amp.gain.value = gain;
    src.connect(amp).connect(this.master);
    src.start(this.ctx.currentTime + delay);
  }

  loop(name, { gain = 1, fade = 1.5 } = {}) {
    const buffer = this.buffers[name];
    if (!buffer || this.loops[name]) return;
    const src = this.ctx.createBufferSource();
    const amp = this.ctx.createGain();
    src.buffer = buffer;
    src.loop = true;
    amp.gain.value = 0;
    amp.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + fade);
    src.connect(amp).connect(this.master);
    src.start();
    this.loops[name] = { src, amp };
  }

  stopLoops(fade = 0.5) {
    const now = this.ctx.currentTime;
    for (const { src, amp } of Object.values(this.loops)) {
      amp.gain.setTargetAtTime(0, now, fade / 3);
      src.stop(now + fade + 0.2);
    }
    this.loops = {};
  }

  // Två överlappande uppspelningar, så att spåret loopar utan glapp trots mp3-filens tysta kanter.
  startMusic() {
    const buffer = this.buffers.music;
    if (!buffer) return;
    this.musicBus.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 3);
    const schedule = (at) => {
      const src = this.ctx.createBufferSource();
      const amp = this.ctx.createGain();
      src.buffer = buffer;
      amp.gain.setValueAtTime(0, at);
      amp.gain.linearRampToValueAtTime(1, at + MUSIC_FADE);
      amp.gain.setValueAtTime(1, at + buffer.duration - MUSIC_FADE);
      amp.gain.linearRampToValueAtTime(0, at + buffer.duration);
      src.connect(amp).connect(this.musicBus);
      src.start(at);
      const next = at + buffer.duration - MUSIC_FADE;
      setTimeout(() => schedule(next), Math.max(0, (next - this.ctx.currentTime - 1) * 1000));
    };
    schedule(this.ctx.currentTime);
  }

  duckMusic(level, seconds = 1) {
    if (this.ctx) this.musicBus.gain.setTargetAtTime(level, this.ctx.currentTime, seconds / 3);
  }
}
