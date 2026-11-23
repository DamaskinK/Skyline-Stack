// Level assets: each level lists its files in assets/levels/<id>/manifest.json and they load on demand.
// Manifest: { "level": "<id>", "assets": [{ "id", "type": "hdri" | "gltf" | "texture" | "audio" | "json", "url", "bytes", "required"? }] }
// URLs are relative to the page. Loaded files are cached by URL, so a level loads only once per visit.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const cache = new Map();
const gltf = new GLTFLoader(), rgbe = new RGBELoader(), tex = new THREE.TextureLoader();
// Draco-compressed GLB (models built in Blender, scripts/blender/); the decoder is vendored in vendor/draco/ (scripts/vendor-addons.mjs)
const draco = new DRACOLoader().setDecoderPath('vendor/draco/');          // relative to the page, like every asset URL
gltf.setDRACOLoader(draco);

function loadOne(a, onBytes) {
  const progress = (e) => onBytes(e.loaded || 0);
  switch (a.type) {
    case 'hdri': return rgbe.loadAsync(a.url, progress).then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; return t; });
    case 'gltf': return gltf.loadAsync(a.url, progress).then((g) => g.scene);
    case 'texture': return tex.loadAsync(a.url, progress).then((t) => { t.colorSpace = THREE.SRGBColorSpace; return t; });
    case 'json': return fetch(a.url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
    case 'audio': return fetch(a.url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); }).then((b) => { onBytes(b.byteLength); return b; });
    default: return Promise.reject(new Error(`unknown asset type "${a.type}"`));
  }
}

// Loads every asset of a level. onProgress(fraction 0..1). Resolves to { assets: { id: value }, errors: [{ id, url, message }] }.
// A failed optional asset is reported in `errors` and left out; a failed required asset (or manifest) rejects.
// onLate(id, value) receives the audio files when they arrive: the level does not wait for them.
export function loadLevelAssets(level, onProgress = () => {}, onLate = null) {
  return loadManifest(`assets/levels/${level}/manifest.json`, onProgress, `level "${level}"`, onLate);
}

// Same loader for any manifest file, e.g. the shared audio list (assets/audio/manifest.json).
export async function loadManifest(url, onProgress = () => {}, label = url, onLate = null) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No asset list for ${label} (HTTP ${res.status})`);
  const manifest = await res.json();
  const all = manifest.assets || [];
  const list = onLate ? all.filter((a) => a.type !== 'audio') : all;   // with onLate, audio is not waited for
  const total = list.reduce((s, a) => s + (a.bytes || 1), 0) || 1;
  const got = new Map();
  const report = () => onProgress(Math.min(1, [...got.values()].reduce((s, v) => s + v, 0) / total));
  const assets = {}, errors = [];
  report();
  if (onLate) for (const a of all) if (a.type === 'audio') {
    if (!cache.has(a.url)) cache.set(a.url, loadOne(a, () => {}));
    cache.get(a.url).then((v) => onLate(a.id, v), () => cache.delete(a.url));
  }
  await Promise.all(list.map(async (a) => {
    try {
      if (!cache.has(a.url)) cache.set(a.url, loadOne(a, (b) => { got.set(a.id, Math.min(b, a.bytes || b)); report(); }));
      assets[a.id] = await cache.get(a.url);
    } catch (e) {
      cache.delete(a.url);
      errors.push({ id: a.id, url: a.url, message: e.message || String(e) });
      if (a.required) throw new Error(`Could not load ${a.url}: ${e.message || e}`);
    } finally { got.set(a.id, a.bytes || 1); report(); }
  }));
  return { assets, errors };
}
