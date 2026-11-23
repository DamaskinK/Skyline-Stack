// S0002 10 checks: trams, bike lane by the tower, parked and moving cars, defaults. Builds each Kosice plot and takes close-up screenshots.
// Usage: node tests/browser/s2-10.mjs [--quality low|medium|high] [--plots 0,1,2,3,4] [--out dir]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s2-10'), plots = opt('plots', '0,1,2,3,4').split(',').map(Number), app = opt('app', 'http://localhost:8000');
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const fails = [], ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
for (const n of plots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((q) => { const k = 'tb3d_settings_v2'; const s = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...s, quality: q, hints: false })); }, quality);
  await page.goto(app, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__debug, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.evaluate((n) => window.__debug.loadPlot(n), n);
  await page.waitForTimeout(1200);
  const st = await page.evaluate(async () => {
    const { Trams } = await import('/js/trams.js'), { People } = await import('/js/fx.js'), { traffic } = await import('/js/world.js');
    return { trams: Trams.line ? Trams.line.where() : null, line: Trams.line ? { lines: Trams.line.lines, stops: Trams.line.stops, platforms: Trams.line.platforms } : null, parked: People.parked.map((k) => k.ims.map((i) => i.count)), cars: traffic.count, routes: traffic.routes.length };
  });
  console.log(`plot ${n} ${quality}:`, JSON.stringify(st));
  const snap = (name, pos, look) => page.evaluate(async ([pos, look]) => {
    const w = 1280, h = 720, px = window.__debug.snap(pos, look, w, h, look);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(im, 0, 0); return c.toDataURL('image/png');
  }, [pos, look]).then((d) => writeFileSync(join(out, `p${n}-${quality}-${name}.png`), Buffer.from(d.split(',')[1], 'base64')));
  await snap('start', [23, 12, 0], [0, 8, 0]);
  await snap('tower-ground', [30, 4, 18], [0, 1, 0]);
  for (const [i, t] of (st.trams || []).entries()) await snap(`tram${i}`, [t.x + 14, 6, t.z + 16], [t.x, 2, t.z]);
  for (const [i, q] of (st.line?.platforms || []).slice(0, 2).entries()) await snap(`stop${i}`, [q.x + 12, 5, q.z + 14], [q.x, 1, q.z]);
  ok(errors.length === 0, `plot ${n}: no console errors ${errors.slice(0, 2).join(' | ')}`);
  await page.close();
}
await browser.close();
process.exit(fails.length ? 1 : 0);
