// Renders the cathedral from fixed poses (ring frame, x east, z south) with the Blender GLB and with the procedural model,
// and prints triangles / draw calls of the whole frame for both. Usage: node tests/browser/cathedral-compare.mjs [--quality high|low] [--out dir]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out40/compare');
mkdirSync(out, { recursive: true });
const POSES = {
  far: { pos: [-28, 9, -24], look: [40, 22, 80] },          // about the game camera, 100+ m from the cathedral
  mid: { pos: [-10, 30, 20], look: [45, 22, 80] },
  northwest: { pos: [-20, 24, 40], look: [47, 20, 81] },
  close: { pos: [8, 14, 62], look: [32, 16, 80] },
  west: { pos: [-4, 8, 82], look: [28, 18, 81] },
  south: { pos: [52, 12, 130], look: [50, 14, 90] },
};
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const rows = [];
for (const flag of ['glb', 'procedural']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.addInitScript((q) => { try { const k = 'skyline_settings_v2'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || '{}'), quality: q, hints: false })); } catch {} }, quality);
  await page.goto(`http://localhost:8000/?cathedral=${flag === 'glb' ? 'glb' : 'procedural'}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__debug, null, { timeout: 20000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { document.querySelector('[data-go="sNew"]').click(); document.querySelector('#btnStart').click(); });
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 30000 }); await page.waitForTimeout(1500);
  for (const [name, p] of Object.entries(POSES)) {
    const url = await page.evaluate(({ p }) => {
      const w = 1280, h = 720, px = window.__debug.snap(p.pos, p.look, w, h), c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), im = g.createImageData(w, h);
      for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      g.putImageData(im, 0, 0); return c.toDataURL('image/png');
    }, { p });
    writeFileSync(join(out, `${flag}-${quality}-${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  const info = await page.evaluate(() => window.__debug.info());
  const stats = await page.evaluate(() => { let t = 0; window.__game.scene?.traverse?.((o) => { if (o.name === 'st-elisabeth') o.traverse((m) => { if (m.isMesh && m.visible) t += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); }); return t; }).catch(() => 0);
  rows.push({ flag, calls: info.calls, triangles: info.triangles, errs: errs.slice(0, 3) });
  await page.close();
}
console.log(JSON.stringify(rows, null, 1));
await browser.close();
