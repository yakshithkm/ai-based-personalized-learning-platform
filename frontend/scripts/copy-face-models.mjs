// Copies the on-device face-detector weights (~190 KB) from the installed package into
// public/models so Vite serves them at /models/ - no CDN and no network calls at exam time.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@vladmandic', 'face-api', 'model');
const target = join(root, 'public', 'models');
const files = ['tiny_face_detector_model-weights_manifest.json', 'tiny_face_detector_model.bin'];

if (!existsSync(source)) {
  console.warn('[copy-face-models] @vladmandic/face-api is not installed yet - skipping.');
  process.exit(0);
}

mkdirSync(target, { recursive: true });
files.forEach((file) => copyFileSync(join(source, file), join(target, file)));
console.log(`[copy-face-models] copied ${files.length} files to public/models`);