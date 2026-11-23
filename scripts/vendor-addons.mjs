// Copies the Three.js addons the game uses (and every file they import) into vendor/addons/, and the Draco decoder into vendor/draco/.
// Usage: node scripts/vendor-addons.mjs <path to an unpacked three@0.160.0 package>
// The version must match vendor/three.module.js (r160).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

const ADDONS = [
  'loaders/GLTFLoader.js', 'loaders/RGBELoader.js', 'loaders/DRACOLoader.js',
  'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/ShaderPass.js',
  'postprocessing/UnrealBloomPass.js', 'postprocessing/GTAOPass.js', 'postprocessing/OutputPass.js',
];

const pkg = process.argv[2];
if (!pkg) { console.error('usage: node scripts/vendor-addons.mjs <three package dir>'); process.exit(1); }
const version = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version;
if (version !== '0.160.0') { console.error(`expected three 0.160.0, got ${version}`); process.exit(1); }
const src = join(pkg, 'examples/jsm'), out = resolve('vendor/addons');
const done = new Set();

function copy(rel) {
  if (done.has(rel)) return; done.add(rel);
  const file = join(src, rel);
  if (!existsSync(file)) throw new Error(`missing ${rel}`);
  const code = readFileSync(file, 'utf8');
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  writeFileSync(join(out, rel), code);
  for (const m of code.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) copy(relative(src, resolve(dirname(file), m[1])));
}
for (const a of ADDONS) copy(a);
// Draco decoder (WASM + JS fallback) that DRACOLoader fetches at run time; the game points it at vendor/draco/ (js/assets.js)
const dracoOut = resolve('vendor/draco'); mkdirSync(dracoOut, { recursive: true });
for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) writeFileSync(join(dracoOut, f), readFileSync(join(src, 'libs/draco/gltf', f)));
console.log(`copied ${done.size} files into vendor/addons and the Draco decoder into vendor/draco (three ${version})`);
