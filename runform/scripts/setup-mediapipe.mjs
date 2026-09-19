// Copia el WASM de @mediapipe/tasks-vision y descarga el modelo de pose a public/.
// Uso: npm run setup:mediapipe
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(root, 'public', 'mediapipe', 'wasm');
const modelDir = join(root, 'public', 'mediapipe', 'models');
const modelFile = join(modelDir, 'pose_landmarker_heavy.task');
const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task';

mkdirSync(wasmDst, { recursive: true });
mkdirSync(modelDir, { recursive: true });

for (const f of readdirSync(wasmSrc)) {
  copyFileSync(join(wasmSrc, f), join(wasmDst, f));
}
console.log(`WASM copiado a ${wasmDst}`);

if (existsSync(modelFile) && statSync(modelFile).size > 1_000_000) {
  console.log('Modelo ya presente, no se descarga.');
} else {
  console.log('Descargando modelo (unos 30 MB)…');
  const res = await fetch(modelUrl);
  if (!res.ok) throw new Error(`Descarga fallida: ${res.status}`);
  writeFileSync(modelFile, Buffer.from(await res.arrayBuffer()));
  console.log(`Modelo guardado en ${modelFile}`);
}
