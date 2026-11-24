// Screenshots of the near-ring houses per Kosice plot from fixed rules (S0004 02): an aerial view, a street-level view of the nearest old-town house and of the nearest panel block.
// Usage: node tests/browser/house-poses.mjs [--app http://localhost:8000] [--quality high|low] [--out dir] [--houses kit|procedural] [--plots 0,1,2,3,4] [--size 1280x720]
// Prints draw calls and triangles of each frame. Needs the game served (npm run serve).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s4-02'), houses = opt('houses', 'kit'), [W, H] = opt('size', '1280x720').split('x').map(Number);
const plots = opt('plots', '0,1,2,3,4').split(',').map(Number);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.addInitScript((q) => { try { const k = 'skyline_settings_v2'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || '{}'), quality: q, hints: false })); } catch { /* ignore */ } }, quality);
await page.goto(`${opt('app', 'http://localhost:8000')}/?houses=${houses}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__debug, null, { timeout: 20000 }); await page.waitForTimeout(800);
for (const n of plots) {
  await page.evaluate((n) => window.__debug.loadPlot(n, 'kosice'), n); await page.waitForTimeout(1500);
  const spots = await page.evaluate(() => window.__debug.houseSpots());
  const shots = { aerial: { pos: [0, 70, 75], look: [0, 4, -15] } };
  for (const kind of ['old', 'panel', 'mid', 'barracks', 'resi', 'office']) {
    const s = spots[kind]; if (!s) continue;
    const d = Math.hypot(s.x, s.z) || 1, ux = -s.x / d, uz = -s.z / d;                  // from the house towards the tower
    shots[`${kind}-street`] = { pos: [s.x + ux * 26 - uz * 8, 6, s.z + uz * 26 + ux * 8], look: [s.x, Math.min(s.h * 0.45, 12), s.z] };
    shots[`${kind}-high`] = { pos: [s.x + ux * 55, 34, s.z + uz * 55], look: [s.x, 6, s.z] };
  }
  for (const [name, p] of Object.entries(shots)) {
    const url = await page.evaluate(({ p, w, h }) => {
      const px = window.__debug.snap(p.pos, p.look, w, h), c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), im = g.createImageData(w, h);
      for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      g.putImageData(im, 0, 0); return c.toDataURL('image/png');
    }, { p, w: W, h: H });
    writeFileSync(join(out, `${houses}-${quality}-p${n}-${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  const info = await page.evaluate(() => window.__debug.info());
  console.log(JSON.stringify({ plot: n, houses, quality, calls: info.calls, triangles: info.triangles, spots: Object.fromEntries(Object.entries(spots).map(([k, v]) => [k, v && [Math.round(v.x), Math.round(v.z), v.storeys]])) }));
}
if (errs.length) console.log('console errors', errs.slice(0, 4));
await browser.close();
