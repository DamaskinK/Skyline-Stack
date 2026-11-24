// Screenshots of the birds (S0004 16): pigeons on a roof ridge, on a landmark ledge and on the plaza, a flock from the game camera distance.
// Usage: node tests/browser/bird-poses.mjs [--app http://localhost:8002] [--quality high|low] [--out dir] [--plots 0,1] [--size 1280x720]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const app = opt('app', 'http://localhost:8002'), quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s4-16'), [W, H] = opt('size', '1280x720').split('x').map(Number);
const plots = opt('plots', '0').split(',').map(Number);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.addInitScript((q) => { try { const k = 'skyline_settings_v2'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || '{}'), quality: q, hints: false })); } catch { /* ignore */ } }, quality);
await page.goto(app + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__debug && window.__birds, null, { timeout: 20000 }); await page.waitForTimeout(800);
const snap = async (name, p) => {
  const url = await page.evaluate(({ p, w, h }) => {
    const px = window.__debug.snap(p.pos, p.look, w, h), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(im, 0, 0); return c.toDataURL('image/png');
  }, { p, w: W, h: H });
  writeFileSync(join(out, name), Buffer.from(url.split(',')[1], 'base64'));
};
for (const n of plots) {
  await page.evaluate((n) => window.__debug.loadPlot(n, 'kosice'), n); await page.waitForTimeout(2500);
  const s = await page.evaluate(() => ({ stats: window.__birds.stats(), spots: window.__birds.spots() }));
  console.log(JSON.stringify({ plot: n, quality, stats: s.stats }));
  const roofP = s.spots.perches.filter((p) => p[3] === 1 && p[1] < 26).sort((a, b) => Math.hypot(a[0], a[2]) - Math.hypot(b[0], b[2]));
  const ground = s.spots.perches.filter((p) => p[3] === 0);
  const high = s.spots.perches.filter((p) => p[1] >= 26);
  const near = (p, d, up, side = 0.6) => { const L = Math.hypot(p[0], p[2]) || 1, ux = -p[0] / L, uz = -p[2] / L; return { pos: [p[0] + ux * d - uz * d * side, p[1] + up, p[2] + uz * d + ux * d * side], look: [p[0], p[1] + 0.15, p[2]] }; };
  if (roofP[0]) { await snap(`p${n}-${quality}-ridge-close.png`, near(roofP[0], 2.2, 0.6)); await snap(`p${n}-${quality}-ridge-mid.png`, near(roofP[0], 9, 3)); }
  if (high[0]) await snap(`p${n}-${quality}-ledge.png`, near(high[0], 4, 1.2));
  if (ground[0]) await snap(`p${n}-${quality}-plaza.png`, near(ground[0], 2.5, 1.0));
  const f = s.spots.flying; if (f.length) { const c = f[0]; await snap(`p${n}-${quality}-flock-near.png`, { pos: [c[0] + 9, c[1] + 1, c[2] + 9], look: c }); }
  await snap(`p${n}-${quality}-game.png`, { pos: [-22, 20, -19], look: [0, 14, 0] });
}
if (errs.length) console.log('console errors', errs.slice(0, 4));
await browser.close();
