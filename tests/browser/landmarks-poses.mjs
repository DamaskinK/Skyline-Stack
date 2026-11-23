// Renders every Kosice landmark from fixed poses (ring frame of the cathedral plot, x east, z south) with the Blender GLBs and with the procedural fallback
// and prints draw calls / triangles of the whole frame. Usage: node tests/browser/landmarks-poses.mjs [--quality high|low] [--out dir] [--only glb|procedural] [--size 1280x720]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s4-01'), only = opt('only', ''), [W, H] = opt('size', '1280x720').split('x').map(Number);
mkdirSync(out, { recursive: true });
const POSES = {
  'theatre-front': { pos: [4, 4.5, -14], look: [-12, 14, -68] },           // from the Singing Fountain, as the Commons photo
  'theatre-close': { pos: [-8, 3, -46], look: [-14, 10, -76] },
  'theatre-nw': { pos: [-62, 24, -40], look: [-16, 12, -80] },
  'theatre-rear': { pos: [18, 16, -140], look: [-16, 12, -84] },
  'urban-nw': { pos: [18, 9, 8], look: [43, 16, 37.7] },
  'urban-close': { pos: [31, 4, 53], look: [43, 7, 37.7] },
  'chapel-ne': { pos: [88, 11, 98], look: [63, 8, 120] },                    // from the north-east like the Commons photo
  'chapel-south': { pos: [72, 8, 152], look: [63, 8, 120] },
  'immaculata': { pos: [-41, 6, -172], look: [-55, 8, -199] },
  'immaculata-far': { pos: [-20, 12, -128], look: [-55, 8, -199] },
  'fountain': { pos: [-14, 4, 8], look: [5, 1, -19] },
  'fountain-aerial': { pos: [32, 26, 8], look: [5, 0, -19] },
  'cathedral-far': { pos: [-28, 9, -24], look: [40, 22, 80] },
  'cathedral-close': { pos: [8, 14, 62], look: [32, 16, 80] },
  'cathedral-stone': { pos: [30, 3, 54], look: [38, 5, 62] },
  'cathedral-roof': { pos: [-6, 36, 44], look: [40, 26, 82] },
};
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const rows = [];
for (const flag of ['glb', 'procedural']) {
  if (only && only !== flag) continue;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.addInitScript((q) => { try { const k = 'skyline_settings_v2'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || '{}'), quality: q, hints: false })); } catch {} }, quality);
  await page.goto(`http://localhost:8000/?landmarks=${flag}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__debug, null, { timeout: 20000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { document.querySelector('[data-go="sNew"]').click(); document.querySelector('#btnStart').click(); });
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 30000 }); await page.waitForTimeout(1500);
  for (const [name, p] of Object.entries(POSES)) {
    const url = await page.evaluate(({ p, w, h }) => {
      const px = window.__debug.snap(p.pos, p.look, w, h), c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), im = g.createImageData(w, h);
      for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      g.putImageData(im, 0, 0); return c.toDataURL('image/png');
    }, { p, w: W, h: H });
    writeFileSync(join(out, `${flag}-${quality}-${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  const info = await page.evaluate(() => window.__debug.info());
  rows.push({ flag, calls: info.calls, triangles: info.triangles, errs: errs.slice(0, 3) });
  await page.close();
}
await browser.close();
for (const r of rows) console.log(JSON.stringify(r));
