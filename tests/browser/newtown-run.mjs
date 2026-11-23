// Scripted Newtown run (S0002 07): every plot loads from the district map with its own site, landmarks are in the scene, plots 1, 2 and 5 are played
// with lowered targets (result screen, saved store, finished towers on the next plot), then Endless on Newtown. Also takes overview shots.
// Usage: node tests/browser/newtown-run.mjs [--quality low|high] [--out dir]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s2-07'), app = opt('app', 'http://localhost:8000');
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
await page.evaluate(async () => { const m = await import('/js/levels.js'); for (const p of m.cityById('newtown').district.plots) p.target = 3; });
await page.evaluate(() => {
  window.__bot = setInterval(() => {
    const g = window.__game, b = g.block, T = g.tower;
    if (!b || b.state !== 'hang' || g.state !== 'play') return;
    const top = T.n ? T.top() : { x: T.bx, z: T.bz };
    if (Math.abs(b.x - top.x) < 0.2 && Math.abs(b.z - top.z) < 0.2) g.drop();
  }, 8);
});
const snapPng = (name, pos, look) => page.evaluate(([pos, look]) => {
  const w = 960, h = 540, px = window.__debug.snap(pos, look, w, h, [0, 0, 0]);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(im, 0, 0); return c.toDataURL('image/png');
}, [pos, look]).then((d) => writeFileSync(join(out, `${name}-${quality}.png`), Buffer.from(d.split(',')[1], 'base64')));
const openMap = () => page.evaluate(() => { if (!document.querySelector('#sMap').offsetParent) { document.querySelector('[data-go="sNew"]').click(); setTimeout(() => document.querySelector('[data-district="newtown"]').click(), 80); } });
// 1) Newtown is on the menu from the start, district map opens and Play is enabled on plot 1
await page.evaluate(() => document.querySelector('[data-go="sNew"]').click());
const hasCards = await page.evaluate(() => !!document.querySelector('[data-district="newtown"]') && !!document.querySelector('[data-endless="newtown"]'));
ok(hasCards, 'Newtown is selectable from the start (district card and Endless card)');
await page.evaluate(() => document.querySelector('[data-district="newtown"]').click()); await page.waitForTimeout(400);
const playOn = await page.evaluate(() => [...document.querySelectorAll('[data-play]')].map((b) => b.dataset.play + (b.disabled ? ':disabled' : '')));
ok(playOn.length === 1 && playOn[0] === 'edge', `only plot 1 playable: ${playOn}`);
await page.screenshot({ path: join(out, `map-newtown-${quality}.png`) });
// 2) scene of each plot: tower site at origin, landmarks present, overview shots
for (let n = 0; n < 5; n++) {
  const info = await page.evaluate(async (i) => { const errs = await window.__debug.loadPlot(i, 'newtown'); const sc = window.__scene; const np = sc.getObjectByName('procedural-near'); return { errs, pos: [np.position.x, np.position.z], lm: !!sc.getObjectByName('newtown-landmarks') }; }, n);
  ok(!info.errs.length && info.lm, `plot ${n + 1} scene loaded, offset ${info.pos.map((v) => v.toFixed(0))}, landmarks ${info.lm}`);
  await page.waitForTimeout(300);
  await snapPng(`plot${n + 1}-overview`, [26, 18, 30], [0, 6, 0]);
}
// landmark views from the plaza scene
await page.evaluate(() => window.__debug.loadPlot(4, 'newtown')); await page.waitForTimeout(400);
await snapPng('clock-tower', [-30, 14, -20], [-72, 26, -62]);
await snapPng('clock-tower-wide', [10, 20, 24], [-72, 22, -62]);
await snapPng('lantern-bridge', [10, 9, -85], [44, 6, -112]);
await snapPng('lantern-bridge-close', [44, 5, -80], [44, 7, -112]);
// 3) play plots 1, 2 and 5
async function playPlot(plotId, shot) {
  await openMap(); await page.waitForTimeout(400);
  await page.evaluate((id) => document.querySelector(`[data-play="${id}"]`).click(), plotId);
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const hud = await page.evaluate(() => ({ tgt: document.querySelector('#hTarget').textContent, req: document.querySelector('#hReq').textContent, tw: window.__scene.getObjectByName('district-towers').children.length, np: window.__scene.getObjectByName('procedural-near').position.toArray().map((v) => Math.round(v)) }));
  console.log(`plot ${plotId} HUD "${hud.tgt}" "${hud.req}" towers ${hud.tw} city offset ${hud.np}`);
  if (shot) await page.screenshot({ path: join(out, `play-${plotId}-${quality}.png`) });
  await page.waitForFunction(() => window.__game.state === 'over', null, { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('#sPlot').hidden, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `result-${plotId}-${quality}.png`) });
  return { hud, text: await page.evaluate(() => document.querySelector('#sPlot').innerText) };
}
let r = await playPlot('edge', true);
ok(/COUNTED/.test(r.text) && !/NOT COUNTED/.test(r.text), 'plot 1 counted');
ok(r.hud.np[0] === 190 && r.hud.np[2] === -150, 'city moved so plot 1 site is at the tower');
const st = await page.evaluate(() => JSON.parse(localStorage.getItem('skyline_district_v1')).cities.newtown.plots.edge);
ok(st.counted && st.bestHeight >= 3 && st.residents > 0, `plot 1 saved ${JSON.stringify(st)}`);
await page.evaluate(() => document.querySelector('#btnPlotMap').click()); await page.waitForTimeout(900);
await page.screenshot({ path: join(out, `map-after-1-${quality}.png`) });
r = await playPlot('park-row', false);
ok(r.hud.tw >= 1, 'plot 2 shows the finished tower of plot 1');
await snapPng('far-tower', [10, 10, 16], [-340, 8, 25]);
await page.evaluate(() => document.querySelector('#btnPlotMap').click()); await page.waitForTimeout(600);
await page.evaluate(() => {
  const k = 'skyline_district_v1', d = JSON.parse(localStorage.getItem(k));
  for (const id of ['outer-ring', 'inner-ring']) d.cities.newtown.plots[id] = { stars: 3, bestHeight: 40, residents: 0, counted: true };
  localStorage.setItem(k, JSON.stringify(d));
});
r = await playPlot('plaza', true);
ok(/GOAL REACHED|PLOTS BUILT/.test(r.text) && !/Next city opened/i.test(r.text), 'plaza result, no next city for Newtown');
console.log(r.text.replace(/\n+/g, ' | '));
await snapPng('plaza-built', [30, 14, 36], [0, 10, 0]);
// 4) Endless on Newtown from the menu
await page.evaluate(() => { document.querySelector('#btnPlotMap').click(); });
await page.waitForTimeout(500);
await page.evaluate(() => { document.querySelector('#mapBack').click(); });
await page.waitForTimeout(400);
await page.evaluate(() => { if (!document.querySelector('#sNew').offsetParent) document.querySelector('[data-go="sNew"]').click(); document.querySelector('[data-endless="newtown"]').click(); document.querySelector('#btnStart').click(); });
await page.waitForFunction(() => window.__game.state === 'play' && window.__game.mode === 'endless', null, { timeout: 60000 });
await page.waitForTimeout(2500);
const en = await page.evaluate(() => ({ city: window.__game.cityId, n: window.__game.tower.n, off: window.__scene.getObjectByName('procedural-near').position.toArray() }));
ok(en.city === 'newtown' && en.n >= 1 && en.off[0] === 0, `Endless runs on Newtown (floors ${en.n})`);
await page.screenshot({ path: join(out, `endless-${quality}.png`) });
console.log(errors.length ? 'console errors: ' + errors.join(' | ') : 'no console errors');
ok(errors.length === 0, 'no console errors');
await browser.close();
process.exit(fails.length ? 1 : 0);
