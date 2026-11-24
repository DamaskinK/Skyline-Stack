// S0004 18: street profile, cars and trams from the game camera of a plot (loadPlot + fixed poses).
// Usage: node tests/browser/s4-18.mjs [--app http://localhost:8002] [--quality high|low] [--plots 0,1] [--out dir] [--size 1280x720]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const app = opt('app', 'http://localhost:8002'), quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s4-18'), [W, H] = opt('size', '1280x720').split('x').map(Number);
const plots = opt('plots', '0,1').split(',').map(Number);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.addInitScript((q) => { try { localStorage.setItem('skyline_settings_v2', JSON.stringify({ quality: q, hints: false })); } catch { /* ignore */ } }, quality);
await page.goto(app + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__debug, null, { timeout: 20000 }); await page.waitForTimeout(800);
await page.evaluate(() => document.body.classList.remove('menu-bg'));   // the menu stops the frame loop (S0004 19); the scene runs for these shots
const snap = async (name, p) => {
  const url = await page.evaluate(({ p, w, h }) => {
    const px = window.__debug.snap(p.pos, p.look, w, h), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(im, 0, 0); return c.toDataURL('image/png');
  }, { p, w: W, h: H });
  writeFileSync(join(out, name), Buffer.from(url.split(',')[1], 'base64'));
};
const POSES = { rail: { pos: [-70, 2.2, 80], look: [-73, 0.1, 60] },  top: { pos: [-60, 26, 105], look: [-72, 0, 82] },  street: { pos: [-28, 5.5, 20], look: [-74, 1.2, 60] }, streetN: { pos: [-60, 12, 100], look: [-72, 0, 20] },  tram: { pos: [-40, 9, 20], look: [-74, 1, 40] }, tram2: { pos: [-20, 22, 40], look: [-80, 0, 50] }, garages: { pos: [10, 7, -40], look: [10, 2, -63] }, game: { pos: [23, 12, 0], look: [0, 6, 0] }, game2: { pos: [-16, 14, 16], look: [0, 3, 0] }, high: { pos: [0, 60, 62], look: [0, 0, 0] } };
for (const n of plots) {
  await page.evaluate((n) => window.__debug.loadPlot(n, 'kosice'), n); await page.waitForTimeout(4000);
  for (const [k, p] of Object.entries(POSES)) await snap(`p${n}-${quality}-${k}.png`, p);
  // a tram of the plot's line (the nearest one, waiting up to 40 s for one to come by): from the pavement beside its track
  let tram = null;
  for (let t = 0; t < 40 && !tram; t++) {
    tram = await page.evaluate(() => { const l = window.__scene.getObjectByName('near-ring')?.userData.tram; const w = l ? l.where().filter((q) => Math.hypot(q.x, q.z) < 120).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0] : null; return w || null; });
    if (!tram) await page.waitForTimeout(1000);
  }
  console.log('tram', JSON.stringify(tram));
  // the street profile on the nearest main road: from the bike lane side, a little above the pavement, looking along the road
  const mr = await page.evaluate(() => { const o = window.__scene.getObjectByName('near-ring')?.userData.plan?.osm; if (!o) return null; let best = null; for (const r of o.roads) if ((r.k === 'main' || (r.k === 'street' && r.w >= 9)) && r.p.length >= 4) { for (let i = 0; i + 3 < r.p.length; i += 2) { const mx = (r.p[i] + r.p[i + 2]) / 2, mz = (r.p[i + 1] + r.p[i + 3]) / 2, d = Math.hypot(mx, mz); if (d > 40 && d < 250 && (!best || d < best.d)) best = { d, mx, mz, tx: r.p[i + 2] - r.p[i], tz: r.p[i + 3] - r.p[i + 1], w: r.w }; } } return best; });
  if (mr) { const l = Math.hypot(mr.tx, mr.tz), tx = mr.tx / l, tz = mr.tz / l; await snap(`p${n}-${quality}-profile.png`, { pos: [mr.mx - tz * (mr.w / 2 + 9) - tx * 14, 4.2, mr.mz + tx * (mr.w / 2 + 9) - tz * 14], look: [mr.mx + tx * 14 + tz * 1, 0.3, mr.mz + tz * 14 - tx * 1] }); }
  if (tram) await snap(`p${n}-${quality}-tram-close.png`, { pos: [tram.x + 16, 5, tram.z + 10], look: [tram.x, 1.8, tram.z] });
  console.log(JSON.stringify({ plot: n, traffic: await page.evaluate(() => window.__debug.trafficStats?.()) }));
}
// a bus (own 11 m model, not a stretched car): find it among the instanced meshes and look at it from the side
await page.evaluate(() => window.__debug.loadPlot(3, 'kosice')); await page.waitForTimeout(2500);
const bus = await page.evaluate(() => {
  let found = null;
  window.__scene.traverse((o) => { if (found || !o.isInstancedMesh || o.count < 1) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; if (b.max.z - b.min.z > 10 && b.max.z - b.min.z < 12) { const m = o.matrix.clone(); o.getMatrixAt(0, m); found = m.elements.slice(12, 15).concat(m.elements[8], m.elements[10]); } });
  return found;
});
console.log('bus', JSON.stringify(bus));
if (bus) { const [x, y, z, fx, fz] = bus; await snap(`bus-${quality}.png`, { pos: [x + fz * 14 + 3, 4, z - fx * 14 + 3], look: [x, 1.5, z] }); }
if (errs.length) console.log('errors', errs.slice(0, 4));
await browser.close();
