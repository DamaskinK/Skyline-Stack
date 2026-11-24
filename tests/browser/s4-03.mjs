// S0004 03 screenshots: junction with traffic lights, crossings, kerbs, bikes, name plates, trams (day and night).
// Usage: node tests/browser/s4-03.mjs [--quality low|medium|high] [--plots 0,1,2,3,4] [--out dir]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s4-03'), plots = opt('plots', '2,3').split(',').map(Number), app = opt('app', 'http://localhost:8000');
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
for (const n of plots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((q) => { const k = 'skyline_settings_v2'; const s = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...s, quality: q, hints: false })); }, quality);
  await page.goto(app, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__debug, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.evaluate((n) => window.__debug.loadPlot(n), n);
  await page.waitForTimeout(1500);
  const st = await page.evaluate(async () => {
    const { Trams } = await import('/js/trams.js');
    return { spots: window.__debug.detailSpots(), trams: Trams.line ? Trams.line.where() : [], plat: Trams.line ? Trams.line.platforms : [] };
  });
  console.log(`plot ${n} ${quality}:`, JSON.stringify({ counts: st.spots?.counts, lights: st.spots?.lights, trams: st.trams.length, plat: st.plat.length }));
  const snap = (name, pos, look, hour = 14) => page.evaluate(async ([pos, look, hour]) => {
    window.__debug.setHour(hour);
    const w = 1280, h = 720, px = window.__debug.snap(pos, look, w, h, look);
    window.__debug.setHour(14);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(im, 0, 0); return c.toDataURL('image/png');
  }, [pos, look, hour]).then((d) => writeFileSync(join(out, `p${n}-${quality}-${name}.png`), Buffer.from(d.split(',')[1], 'base64')));
  const L = st.spots?.lights?.[0];
  if (L) { for (const [nm, h] of [['day', 14], ['night', 22]]) await snap(`light-${nm}`, [L.x + 16, 5, L.z + 18], [L.x, 1.5, L.z], h); await snap('light-high', [L.x + 30, 22, L.z + 34], [L.x, 0, L.z]); }
  const Z = st.spots?.zebras?.[3] || st.spots?.zebras?.[0];
  if (Z) await snap('zebra', [Z.x + 5, 13, Z.z + 5], [Z.x, 0, Z.z]);
  const S = st.spots?.signs?.[0]; if (S) await snap('sign', [S[0] + Math.sin(S[3]) * 4, 2.5, S[2] + Math.cos(S[3]) * 4], [S[0], 2.4, S[2]]);
  const Rk = st.spots?.racks?.[0]; if (Rk) await snap('bikes', [Rk[0] + 3, 1.6, Rk[2] + 3], [Rk[0], 0.4, Rk[2]]);
  for (const [i, t] of st.trams.entries()) { await snap(`tram${i}-day`, [t.x + 14, 4, t.z + 16], [t.x, 2, t.z]); await snap(`tram${i}-night`, [t.x + 14, 4, t.z + 16], [t.x, 2, t.z], 22); }
  for (const [i, q] of st.plat.slice(0, 2).entries()) await snap(`stop${i}`, [q.x + 12, 5, q.z + 14], [q.x, 1, q.z]);
  console.log('errors', errors.slice(0, 3));
  await page.close();
}
await browser.close();
