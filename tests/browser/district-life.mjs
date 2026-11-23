// District life by progress (S0002 06): seed the progress store with 0, 2 or 5 finished Kosice plots, build plot 3 (Hlavna street), screenshot, count what is out.
// Usage: node tests/browser/district-life.mjs [--quality low|medium|high] [--out dir] [--plots 0,2,5]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const [vw, vh] = opt('viewport', '1280x720').split('x').map(Number), dpr = Number(opt('dpr', 1)), quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s2-06'), app = opt('app', 'http://localhost:8000'), steps = opt('plots', '0,2,5').split(',').map(Number);
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ORDER = ['kulturpark', 'cathedral', 'terasa', 'juzna', 'hlavna-south'], HEIGHT = [14, 18, 12, 15, 22];
const fails = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const stats = {};
for (const n of steps) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
  const errors = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([q, n, order, heights]) => {
    const plots = {}; order.slice(0, n).forEach((id, i) => { plots[id] = { stars: 3, bestHeight: heights[i], residents: 20, counted: true }; });
    localStorage.setItem('tb3d_district_v1', JSON.stringify({ v: 2, cities: { kosice: { plots, opened: true, goalReached: false } } }));
    const k = 'tb3d_settings_v2'; const s = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...s, quality: q, hints: false }));
  }, [quality, n, ORDER, HEIGHT]);
  await page.goto(app, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__debug, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__debug.loadPlot(3));
  await page.waitForTimeout(1500);
  const st = await page.evaluate(async () => {
    const { People } = await import('/js/fx.js'), { traffic } = await import('/js/world.js');
    const sc = window.__scene, find = (nm) => { let r = null; sc.traverse((o) => { if (o.name === nm) r = o; }); return r; };
    const cnt = (nm) => find(nm)?.count ?? 0;
    return { progress: People.progress, walkers: People.walkers.length, folk: People.folk.length, cyclists: People.cyclists.length, musicians: People.musicians.length, cars: traffic.count,
      shops: cnt('shop-frame'), stalls: cnt('stall-body'), busk: cnt('busker-props'), farTowers: cnt('far-towers'), realTowers: sc.getObjectByName('district-towers').children.filter((c) => c.isGroup).length, calls: 0 };
  });
  const perf = await page.evaluate(() => new Promise((res) => { const t = []; let last = performance.now(), k = 0; const f = (now) => { t.push(now - last); last = now; if (++k < 150) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ p50: t[75], p90: t[135] }); } }; requestAnimationFrame(f); }));
  const info = await page.evaluate(() => window.__debug.info());
  st.calls = info.calls; st.tris = info.triangles; st.p50 = +perf.p50.toFixed(1); st.p90 = +perf.p90.toFixed(1);
  ok(st.p90 <= 18, `${n} finished: frame p90 ${st.p90} ms (budget 18), ${st.calls} draw calls`);
  stats[n] = st; console.log(`${n} finished, ${quality}:`, JSON.stringify(st));
  await page.screenshot({ path: join(out, `plots${n}-${quality}-game.png`) });
  const snapPng = (name, pos, look, night = false) => page.evaluate(async ([pos, look, night]) => {
    const { glowMats } = await import('/js/world.js'); const keep = glowMats.map((m) => m.emissiveIntensity); if (night) glowMats.forEach((m) => { m.emissiveIntensity = 1.4; });
    const w = 1280, h = 720, px = window.__debug.snap(pos, look, w, h, [0, 0, 0]);
    glowMats.forEach((m, i) => { m.emissiveIntensity = keep[i]; });
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(im, 0, 0); return c.toDataURL('image/png');
  }, [pos, look, night]).then((d) => writeFileSync(join(out, `plots${n}-${quality}-${name}.png`), Buffer.from(d.split(',')[1], 'base64')));
  const poses = await page.evaluate(async () => {
    const { People } = await import('/js/fx.js'), { plotOffset } = await import('/js/level-scene.js'), { cityById } = await import('/js/levels.js');
    const E = People.life?.events, city = cityById('kosice'), pl = city.district.plots, c0 = plotOffset('kosice', pl[3]);
    const near = (q, d = 10, hgt = 3.2) => q ? { pos: [q.x + Math.sin(q.rot) * d, hgt, q.z + Math.cos(q.rot) * d], look: [q.x, 1.4, q.z] } : null;
    const far = pl.map((p) => { const o = plotOffset('kosice', p); return [o.x - c0.x, o.z - c0.z]; });
    return { stall: near(E?.stalls[0]), busker: near(E?.musicians[0], 7), far };
  });
  const dist = (v) => Math.hypot(v[0], v[1]);
  const farOne = poses.far.map((v, i) => ({ v, i })).filter((o) => dist(o.v) > 800).sort((a, b) => dist(a.v) - dist(b.v))[0];
  await snapPng('street', [34, 9, 38], [0, 1.5, 0]);
  await snapPng('street-night', [34, 9, 38], [0, 1.5, 0], true);
  const done = poses.far.map((v, i) => ({ v, i })).filter((o) => o.i !== 3 && ORDER.slice(0, n).includes(['terasa', 'juzna', 'kulturpark', 'hlavna-south', 'cathedral'][o.i]) && dist(o.v) < 900).sort((a, b) => dist(a.v) - dist(b.v))[0];
  if (done) await snapPng('tower-site', [done.v[0] + 70, 85, done.v[1] + 70], [done.v[0], 10, done.v[1]]);   // finished tower seen from above: no building under it
  if (poses.stall) await snapPng('stall', poses.stall.pos, poses.stall.look);
  if (poses.busker) await snapPng('busker', poses.busker.pos, poses.busker.look);
  if (farOne) {                                                  // stand 60 m off the plot looking at the tower 800 m+ away
    const [x, z] = farOne.v, d = dist(farOne.v), ux = x / d, uz = z / d;
    await snapPng('far-tower', [ux * 60 + 8, 50, uz * 60 + 8], [x, 22, z]);
    await snapPng('far-tower-night', [ux * 60 + 8, 50, uz * 60 + 8], [x, 25, z], true);
  }
  errors.splice(0, errors.length, ...errors.filter((e) => !/ERR_CONNECTION_RESET/.test(e)));
  ok(errors.length === 0, `${n} finished: no console errors ${errors.slice(0, 2).join(' | ')}`);
  await page.close();
}
if (steps.length >= 2) { const a = stats[steps[0]], b = stats[steps[steps.length - 1]]; ok(b.walkers > a.walkers && b.cars > a.cars && b.shops > a.shops && b.stalls >= a.stalls, 'density grows with progress'); }
await browser.close();
process.exit(fails.length ? 1 : 0);
