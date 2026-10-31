// Kopierar MediaPipe till public/vendor och hämtar ansiktsmodellen en gång, så att allt
// serveras från vår egen server och fungerar utan CDN på festens wifi.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DEST = 'public/vendor/mediapipe';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

mkdirSync(`${DEST}/wasm`, { recursive: true });
cpSync('node_modules/@mediapipe/tasks-vision/vision_bundle.mjs', `${DEST}/vision_bundle.mjs`);
for (const name of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  cpSync(`node_modules/@mediapipe/tasks-vision/wasm/${name}`, `${DEST}/wasm/${name}`);
}

if (!existsSync(`${DEST}/face.tflite`)) {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Ansiktsmodellen: HTTP ${res.status}`);
  writeFileSync(`${DEST}/face.tflite`, Buffer.from(await res.arrayBuffer()));
}
console.log('MediaPipe klar i', DEST);
