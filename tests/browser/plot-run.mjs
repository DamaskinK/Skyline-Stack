// Scripted district run (S0002 04): play Kosice plots with lowered targets from the page, check the result screen, the map after it
// and the finished towers seen from the next plot. Usage: node tests/browser/plot-run.mjs [--quality low|high] [--out dir]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s2-04'), app = opt('app', 'http://localhost:8000');
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], fails = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript((q) => {
  if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.removeItem('skyline_district_v1'); localStorage.removeItem('skyline_progress_v3'); }
  const k = 'skyline_settings_v2'; const s = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...s, quality: q, hints: false, difficulty: 'easy' }));
}, quality);
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
await page.goto(app, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__debug, null, { timeout: 15000 });
await page.waitForTimeout(800);
// lower the targets of the first plots so a run is short
await page.evaluate(async () => { const m = await import('/js/levels.js'); const p = m.cityById('kosice').district.plots; p[0].target = 3; p[1].target = 3; p[2].target = 3; p[3].target = 3; p[4].target = 3; });
await page.evaluate(() => {
  window.__bot = setInterval(() => {
    const g = window.__game, b = g.block, T = g.tower;
    if (!b || b.state !== 'hang' || g.state !== 'play') return;
    const top = T.n ? T.top() : { x: T.bx, z: T.bz };
    if (Math.abs(b.x - top.x) < 0.2 && Math.abs(b.z - top.z) < 0.2) g.drop();
  }, 8);
});
const openMap = () => page.evaluate(() => { const g = window.__game; if (!document.querySelector('#sMap').offsetParent) { document.querySelector('[data-go="sNew"]').click(); setTimeout(() => document.querySelector('[data-district="kosice"]').click(), 80); } });
async function playPlot(n, plotId) {
  await openMap(); await page.waitForTimeout(400);
  if (n === 0) await page.screenshot({ path: join(out, `map-start-${quality}.png`) });
  await page.evaluate((id) => document.querySelector(`[data-play="${id}"]`).click(), plotId);
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const hud = await page.evaluate(() => ({ req: document.querySelector('#hReq').textContent, tgt: document.querySelector('#hTarget').textContent, tw: window.__scene.getObjectByName('district-towers').children.map((c) => c.name || c.type) }));
  console.log(`plot ${plotId} HUD: "${hud.tgt}" / "${hud.req}" towers in scene: ${hud.tw.length} (${hud.tw.join(',')})`);
  await page.screenshot({ path: join(out, `play-${plotId}-${quality}.png`) });
  await page.waitForFunction(() => window.__game.state === 'over', null, { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('#sPlot').hidden, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `result-${plotId}-${quality}.png`) });
  return { hud, text: await page.evaluate(() => document.querySelector('#sPlot').innerText) };
}
const snapPng = (name, pos, look) => page.evaluate(([pos, look]) => {
  const w = 960, h = 540, px = window.__debug.snap(pos, look, w, h, [0, 0, 0]);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(im, 0, 0); return c.toDataURL('image/png');
}, [pos, look]).then((d) => writeFileSync(join(out, `${name}-${quality}.png`), Buffer.from(d.split(',')[1], 'base64')));
let r = await playPlot(0, 'terasa');
ok(/COUNTED/.test(r.text) && !/NOT COUNTED/.test(r.text), 'plot 1 result says counted');
ok(r.hud.req.length > 0, 'HUD shows the requirement');
const st1 = await page.evaluate(() => JSON.parse(localStorage.getItem('skyline_district_v1')).cities.kosice.plots.terasa);
ok(st1.counted && st1.bestHeight >= 3 && st1.residents > 0, `plot 1 saved ${JSON.stringify(st1)}`);
await page.evaluate(() => document.querySelector('#btnPlotMap').click());
await page.waitForTimeout(900);
const mapState = await page.evaluate(() => ({ shown: !document.querySelector('#sMap').hidden, res: document.querySelector('#mapRes').innerText, sel: document.querySelector('.pcard.sel')?.dataset.plot, towers: window.__scene.getObjectByName('district-towers').children.length }));
console.log('map after plot 1:', JSON.stringify(mapState));
ok(mapState.shown && mapState.sel === 'juzna' && /RESIDENTS\s*\d+/.test(mapState.res) && mapState.towers === 1, 'map shown, residents updated, next plot selected, own tower standing');
await page.screenshot({ path: join(out, `map-after-1-${quality}.png`) });
await snapPng('own-tower', [14, 6, 16], [0, 4, 0]);
// plot 2: the tower of plot 1 must be in the scene (Terasa is ~800 m away)
r = await playPlot(1, 'juzna');
ok(r.hud.tw.length >= 1, 'plot 2 shows the finished tower of plot 1');
// look at it: camera on plot 2 pointing at plot 1 (north-west of it), snapshot into a PNG
await snapPng('far-tower', [30, 14, 40], [-640, 6, -480]);
await page.evaluate(() => document.querySelector('#btnPlotMap').click());
await page.waitForTimeout(600);
// force the goal: three more counted plots with plenty of height, then look at the result screen text for "next city opened"
await page.evaluate(() => {
  const k = 'skyline_district_v1', d = JSON.parse(localStorage.getItem(k));
  d.cities.kosice.plots.kulturpark = { stars: 3, bestHeight: 40, residents: 0, counted: true };
  d.cities.kosice.plots['hlavna-south'] = { stars: 3, bestHeight: 40, residents: 0, counted: true };
  localStorage.setItem(k, JSON.stringify(d));
});
r = await playPlot(4, 'cathedral');
console.log(r.text.replace(/\n+/g, ' | '));
ok(/Next city opened/i.test(r.text), 'next city opened shown at the goal');
const res = await page.evaluate(() => JSON.parse(localStorage.getItem('skyline_district_v1')).cities.kosice);
ok(res.goalReached === true, 'goalReached saved');
console.log(errors.length ? 'console errors: ' + errors.join(' | ') : 'no console errors');
ok(errors.length === 0, 'no console errors');
await browser.close();
process.exit(fails.length ? 1 : 0);
