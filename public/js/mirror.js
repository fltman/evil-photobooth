// Spegeln: kameran ritas genom en WebGL2-shader. Medan bilden framkallas hittar MediaPipe
// ansiktena och shadern löser upp ansiktsdragen, så att huvudena blir kvar men ögon och mun försvinner.

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float(gl_VertexID == 1) * 4.0 - 1.0, float(gl_VertexID == 2) * 4.0 - 1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
#define MAX_FACES 4
uniform sampler2D uCam, uResult, uTrail;
uniform vec2 uCrop, uResultCrop;
uniform float uAspect, uTime, uVeil, uReveal, uFlash, uKind;
uniform float uA, uB, uC;           // reglagen: skräck/bus, blod/slime, förruttnelse/glitter
uniform int uFaces;
uniform vec4 uFace[MAX_FACES];      // x, y, rx, ry
uniform vec4 uEyes[MAX_FACES];      // vänster x,y och höger x,y
uniform float uRoll[MAX_FACES];
in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { return noise(p) * 0.62 + noise(p * 2.1 + 3.1) * 0.28 + noise(p * 4.3 + 7.7) * 0.10; }

vec2 camUv(vec2 uv) {
  vec2 p = (uv - 0.5) * uCrop + 0.5;
  return vec2(1.0 - p.x, p.y);       // spegelvänt
}

float faceMask(vec2 uv, int i) {
  vec2 d = uv - uFace[i].xy;
  d.x *= uAspect;
  float c = cos(-uRoll[i]), s = sin(-uRoll[i]);
  d = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  float v = length(d / vec2(uFace[i].z * uAspect, uFace[i].w));
  return 1.0 - smoothstep(0.55, 1.1, v);
}

vec3 smear(vec2 p, float radius, float lod, float t) {
  vec3 sum = vec3(0.0);
  float spin = t * 0.7 + hash(p + t) * 0.5;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.39996 + spin;
    float r = radius * sqrt((float(i) + 0.5) / 12.0);
    sum += textureLod(uCam, camUv(p + r * vec2(cos(a) / uAspect, sin(a))), lod).rgb;
  }
  return sum / 12.0;
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  float veil = uVeil;

  // Hur mycket varje pixel tillhör ett ansikte, och ansiktets egen hudton.
  float mask = 0.0;
  vec3 skin = vec3(0.0);
  float hollow = 0.0;
  for (int i = 0; i < uFaces; i++) {
    float m = faceMask(uv, i);
    if (m > mask) {
      mask = m;
      skin = textureLod(uCam, camUv(uFace[i].xy + vec2(0.0, -uFace[i].w * 0.1)), 5.0).rgb;
    }
    vec2 l = (uv - uEyes[i].xy) * vec2(uAspect, 1.0);
    vec2 r = (uv - uEyes[i].zw) * vec2(uAspect, 1.0);
    float size = uFace[i].w * 0.17;
    hollow = max(hollow, exp(-dot(l, l) / (size * size)) + exp(-dot(r, r) / (size * size)));
  }

  // Tomgångsrörelse från reglagen, så att de märks innan bilden är tagen.
  vec2 p = uv;
  float wobble = uKind > 0.5 ? uA * 0.006 : uA * uA * 0.004;
  p += (vec2(noise(vec2(uv.y * 7.0, t * 0.6)), noise(vec2(uv.x * 7.0, t * 0.5))) - 0.5) * wobble;

  // Ansiktsdragen kryper, rinner nedåt och suddas ut.
  float amount = mask * veil;
  vec2 warp = vec2(fbm(uv * 9.0 + t * 0.35), fbm(uv * 9.0 - t * 0.3 + 7.0)) - 0.5;
  p += warp * amount * 0.075;
  p.y += amount * 0.05 * (0.4 + fbm(vec2(uv.x * 16.0, t * 0.15)));

  vec3 col = amount > 0.01 ? smear(p, 0.015 + 0.06 * amount, 1.5 + 2.5 * amount, t) : texture(uCam, camUv(p)).rgb;
  float blank = smoothstep(0.1, 0.9, amount);
  col = mix(col, skin * (0.92 + 0.14 * warp.x), blank * (uKind > 0.5 ? 0.3 : 0.78));

  // Långsam eftersläpning: det utsuddade ansiktet hänger kvar när huvudet rör sig.
  col = mix(col, texture(uTrail, uv).rgb, clamp(veil * (0.55 + 0.3 * mask), 0.0, 0.88));

  vec2 c = uv - 0.5;
  float edge = dot(c, c);

  if (uKind > 0.5) {
    // Snällt läge: varm dimma och stjärnstoft i stället för ögonhålor.
    vec3 fog = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + fbm(uv * 3.5 + t * 0.18) * 1.6 + t * 0.07));
    fog = mix(fog, vec3(1.0, 0.93, 0.78), 0.42);
    col = mix(col, fog, smoothstep(0.0, 0.75, amount) * 0.9);
    col = mix(col, col * vec3(1.08, 0.98, 0.86), 0.5);
    vec2 cell = uv * vec2(uAspect, 1.0) * 26.0;
    vec2 id = floor(cell);
    float twinkle = pow(max(0.0, sin(t * 2.5 + hash(id) * 40.0)), 8.0);
    float star = smoothstep(0.32, 0.0, length(fract(cell) - 0.5)) * step(0.82 - veil * 0.3 - uC * 0.3 - amount * 0.35, hash(id + 3.0)) * twinkle;
    col += vec3(1.0, 0.9, 0.55) * star * (0.5 + uC);
    float slime = smoothstep(0.62 - uB * 0.24, 0.72 - uB * 0.2, (1.0 - uv.y) * 0.55 + fbm(vec2(uv.x * 7.0, 2.0)) * 0.6);
    col = mix(col, vec3(0.42, 0.85, 0.22), slime * uB * 0.8);
  } else {
    // Ond spegel: tomma ögonhålor, kyla och blod som sipprar in från kanterna.
    col *= 1.0 - clamp(hollow, 0.0, 1.0) * veil * veil * (0.55 + 0.42 * uA);
    float grey = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, vec3(grey) * vec3(0.92, 0.98, 1.06), clamp(0.2 + uA * 0.42 + veil * 0.45, 0.0, 0.9));
    col = mix(col, col * vec3(0.84, 0.95, 0.68), uC * 0.55);
    col *= 1.0 - smoothstep(0.12, 0.62, edge) * (0.5 + uA * 0.4 + veil * 0.4);
    col *= 0.94 + 0.06 * noise(vec2(t * 13.0, 1.0)) - (uA + veil) * 0.09 * step(0.93, noise(vec2(t * 3.0, 4.0)));
    float seep = smoothstep(0.34 - uB * 0.2, 0.05, 0.5 - length(c) + (fbm(uv * 6.0 + t * 0.02) - 0.5) * 0.3);
    col = mix(col, vec3(0.2, 0.012, 0.018), seep * uB * 0.9);
    col += (hash(uv * 900.0 + t) - 0.5) * (0.03 + uC * 0.08 + veil * 0.05);
  }

  // Framkallningen: resultatet brinner fram genom spegeln.
  if (uReveal > 0.0) {
    vec2 q = (uv - 0.5) * uResultCrop + 0.5;
    vec3 result = texture(uResult, vec2(q.x, q.y)).rgb;
    float n = fbm(uv * 5.0 + 2.0) * 0.8 + (1.0 - length(c) * 1.3) * 0.2;
    float front = uReveal * 1.35 - 0.2;
    float shown = smoothstep(front, front - 0.08, n);
    col = mix(col, result, shown);
    float rim = smoothstep(0.1, 0.0, abs(n - front + 0.04)) * (1.0 - smoothstep(0.92, 1.0, uReveal));
    col += (uKind > 0.5 ? vec3(1.0, 0.85, 0.4) : vec3(1.0, 0.28, 0.06)) * rim * 1.4;
  }

  fragColor = vec4(col + uFlash, 1.0);
}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function target(gl, width, height) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo };
}

const FALLBACK_FACE = { x: 0.5, y: 0.58, rx: 0.2, ry: 0.2, roll: 0, eyes: [0.44, 0.62, 0.56, 0.62], seen: 0 };
const lerp = (a, b, t) => a + (b - a) * t;

export class Mirror {
  constructor(canvas, { kind }) {
    this.canvas = canvas;
    this.kind = kind;
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!this.gl) throw new Error('WebGL2 saknas');
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    this.u = new Proxy({}, { get: (cache, name) => (cache[name] ??= gl.getUniformLocation(program, name)) });
    gl.bindVertexArray(gl.createVertexArray());
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    this.camTex = gl.createTexture();
    this.resultTex = gl.createTexture();
    for (const tex of [this.camTex, this.resultTex]) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 6, 7, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.uniform1i(this.u.uCam, 0);
    gl.uniform1i(this.u.uResult, 1);
    gl.uniform1i(this.u.uTrail, 2);
    gl.uniform1f(this.u.uKind, kind ? 1 : 0);

    this.source = null;
    this.sliders = { a: 0, b: 0, c: 0 };
    this.shown = { a: 0, b: 0, c: 0 };
    this.veil = 0;
    this.veilTarget = 0;
    this.veilSpeed = 1;
    this.reveal = 0;
    this.revealTarget = 0;
    this.flash = 0;
    this.resultSize = [1, 1];
    this.faces = [];
    this.lastDetect = 0;
    this.trail = null;
    this.size = [0, 0];
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // Ansiktsdetektorn är en bonus: laddas i bakgrunden, och utan den suddas mitten av bilden.
  async loadDetector() {
    try {
      const { FaceDetector, FilesetResolver } = await import('/vendor/mediapipe/vision_bundle.mjs');
      const vision = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
      const create = (delegate) => FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/vendor/mediapipe/face.tflite', delegate },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.4,
      });
      this.detector = await create('GPU').catch(() => create('CPU'));
    } catch (err) {
      console.warn('Ansiktsdetektorn kunde inte laddas', err);
    }
  }

  setSource(el) { this.source = el; }

  setSliders(a, b, c) { this.sliders = { a, b, c }; }

  startVeil(seconds = 5) {
    this.veilTarget = 1;
    this.veilSpeed = 1 / seconds;
  }

  clearVeil() {
    this.veilTarget = 0;
    this.veilSpeed = 1.2;
    this.reveal = 0;
    this.revealTarget = 0;
    this.faces = [];
  }

  firePhotoFlash() { this.flash = 1; }

  showResult(image) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.resultTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    this.resultSize = [image.naturalWidth, image.naturalHeight];
    this.revealTarget = 1;
  }

  // Originalet till modellen: spegelvänt som det man såg, utan effekter.
  snapshot(aspect) {
    const [w, h] = aspect === '4:3' ? [1152, 864] : [864, 1152];
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const { sw, sh } = this.sourceSize();
    const scale = Math.max(w / sw, h / sh);
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.source, (w - sw * scale) / 2, (h - sh * scale) / 2, sw * scale, sh * scale);
    return c.toDataURL('image/jpeg', 0.88);
  }

  sourceSize() {
    const s = this.source;
    return { sw: s.videoWidth || s.naturalWidth || s.width || 1, sh: s.videoHeight || s.naturalHeight || s.height || 1 };
  }

  ready() {
    return !!this.source && this.sourceSize().sw > 1;
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const scale = Math.min(1, 900 / Math.max(box.width * dpr, box.height * dpr, 1));
    const w = Math.max(2, Math.round(box.width * dpr * scale));
    const h = Math.max(2, Math.round(box.height * dpr * scale));
    if (w === this.size[0] && h === this.size[1]) return;
    this.size = [w, h];
    this.canvas.width = w;
    this.canvas.height = h;
    const gl = this.gl;
    this.trail = [target(gl, w, h), target(gl, w, h)];
    gl.uniform1f(this.u.uAspect, w / h);
  }

  detect(now) {
    if (!this.detector || now - this.lastDetect < 80 || this.veilTarget === 0) return;
    this.lastDetect = now;
    const { sw, sh } = this.sourceSize();
    let detections = [];
    try {
      detections = this.detector.detectForVideo(this.source, now).detections;
    } catch {
      return;
    }
    const [cx, cy] = this.crop();
    const toScreen = (x, y) => [1 - ((x - 0.5) / cx + 0.5), 1 - ((y - 0.5) / cy + 0.5)];
    const found = detections.slice(0, 4).map((d) => {
      const b = d.boundingBox;
      const [x, y] = toScreen((b.originX + b.width / 2) / sw, (b.originY + b.height / 2) / sh);
      const k = d.keypoints;
      const [ex1, ey1] = toScreen(k[0].x, k[0].y);
      const [ex2, ey2] = toScreen(k[1].x, k[1].y);
      const aspect = this.size[0] / this.size[1];
      const left = ex1 < ex2 ? [ex1, ey1, ex2, ey2] : [ex2, ey2, ex1, ey1];
      return {
        // Rutan är tajt kring ansiktsdragen, så masken görs lite större för att inte avslöja kanterna.
        x, y, rx: (b.width / sw / cx) * 0.78, ry: (b.height / sh / cy) * 0.92,
        roll: Math.atan2(left[3] - left[1], (left[2] - left[0]) * aspect),
        eyes: left,
      };
    });
    for (const face of this.faces) face.seen += 1;
    for (const f of found) {
      const near = this.faces.find((t) => Math.hypot(t.tx - f.x, t.ty - f.y) < 0.18 && t.seen > 0);
      if (near) Object.assign(near, { tx: f.x, ty: f.y, trx: f.rx, try_: f.ry, troll: f.roll, teyes: f.eyes, seen: 0 });
      else if (this.faces.length < 4) this.faces.push({ ...f, tx: f.x, ty: f.y, trx: f.rx, try_: f.ry, troll: f.roll, teyes: f.eyes, seen: 0 });
    }
    this.faces = this.faces.filter((t) => t.seen < 10);
  }

  crop() {
    const { sw, sh } = this.sourceSize();
    const view = this.size[0] / this.size[1];
    const src = sw / sh;
    return src > view ? [view / src, 1] : [1, src / view];
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    if (this.source) this.draw(now);
  }

  draw(now) {
    const gl = this.gl;
    this.resize();
    const dt = Math.min(0.05, (now - (this.lastDraw ?? now)) / 1000);
    this.lastDraw = now;
    const step = (from, to, speed) => (from < to ? Math.min(to, from + speed * dt) : Math.max(to, from - speed * dt));
    this.veil = step(this.veil, this.veilTarget, this.veilSpeed);
    this.reveal = step(this.reveal, this.revealTarget, 0.55);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    for (const k of ['a', 'b', 'c']) this.shown[k] = step(this.shown[k], this.sliders[k], 2.5);

    const u = this.u;
    if (this.reveal < 1 && this.ready()) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.camTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.detect(now);
    }

    const faces = this.faces.length ? this.faces : (this.veilTarget > 0 ? [FALLBACK_FACE] : []);
    for (const f of this.faces) {
      f.x = lerp(f.x, f.tx, 0.28); f.y = lerp(f.y, f.ty, 0.28);
      f.rx = lerp(f.rx, f.trx, 0.28); f.ry = lerp(f.ry, f.try_, 0.28);
      f.roll = lerp(f.roll, f.troll, 0.28);
      f.eyes = f.eyes.map((v, i) => lerp(v, f.teyes[i], 0.28));
    }
    gl.uniform1i(u.uFaces, faces.length);
    gl.uniform4fv(u['uFace[0]'], new Float32Array(faces.flatMap((f) => [f.x, f.y, f.rx, f.ry]).concat(Array(16).fill(0))).subarray(0, 16));
    gl.uniform4fv(u['uEyes[0]'], new Float32Array(faces.flatMap((f) => f.eyes).concat(Array(16).fill(0))).subarray(0, 16));
    gl.uniform1fv(u['uRoll[0]'], new Float32Array(faces.map((f) => f.roll).concat([0, 0, 0, 0])).subarray(0, 4));

    const [cx, cy] = this.crop();
    gl.uniform2f(u.uCrop, cx, cy);
    const view = this.size[0] / this.size[1];
    const res = this.resultSize[0] / this.resultSize[1];
    gl.uniform2f(u.uResultCrop, res > view ? view / res : 1, res > view ? 1 : res / view);
    gl.uniform1f(u.uTime, now / 1000);
    gl.uniform1f(u.uVeil, this.veil);
    gl.uniform1f(u.uReveal, this.reveal);
    gl.uniform1f(u.uFlash, this.flash);
    gl.uniform1f(u.uA, this.shown.a);
    gl.uniform1f(u.uB, this.shown.b);
    gl.uniform1f(u.uC, this.shown.c);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.trail[0].tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.resultTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.camTex);

    // Ritas först till en buffert som blir nästa rutas eftersläpning, och kopieras sedan till skärmen.
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.trail[1].fbo);
    gl.viewport(0, 0, this.size[0], this.size[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.trail[1].fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, this.size[0], this.size[1], 0, 0, this.size[0], this.size[1], gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    this.trail.reverse();
  }
}
