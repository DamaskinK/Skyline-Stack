// S0001 19: menu over the real city, intro card and camera pass, skip, transitions, frame time. Usage: node tests/browser/s1-19.mjs [--quality low|medium|high] [--out dir]
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s1-19'), app = opt('app', 'http://localhost:8000');
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const fails = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
// frame times over `ms` milliseconds: p95 and worst
const frames = (page, ms) => page.evaluate((ms) => new Promise((res) => { const t = []; let last = performance.now(), end = last + ms;
  const f = (n) => { t.push(n - last); last = n; if (n < end) requestAnimationFrame(f); else { t.shift(); t.sort((a, b) => a - b); res({ p95: t[Math.floor(t.length * 0.95)], max: t[t.length - 1], n: t.length }); } }; requestAnimationFrame(f); }), ms);
for (const [name, vp, touch] of [['desktop', { width: 1280, height: 720 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((q) => { try { localStorage.setItem('skyline_settings_v2', JSON.stringify({ quality: q, hints: false }));
    const pl = (h) => ({ stars: 3, bestHeight: h, residents: 40, counted: true });
    localStorage.setItem('skyline_district_v1', JSON.stringify({ v: 2, cities: { kosice: { plots: { terasa: pl(14), juzna: pl(16), kulturpark: pl(20), 'hlavna-south': pl(24) } } } })); } catch {} }, quality);
  await page.goto(app, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
  const shot = async (n, w = 500) => { await page.waitForTimeout(w); await page.screenshot({ path: join(out, `${name}-${n}.png`) }); };
  await page.waitForFunction(() => window.__game.loadedPlotId === 'cathedral', null, { timeout: 30000 }).then(() => ok(true, `${name}: menu loaded the Kosice centre plot in the background`), () => ok(false, `${name}: menu scene did not load`));
  ok(await page.evaluate(() => document.getElementById('menuLoad').hidden), `${name}: loading pill gone after load`);
  await shot('1-menu', 900);
  const f1 = await frames(page, 3000); ok(f1.p95 < 25, `${name}: menu frames p95 ${f1.p95.toFixed(1)} ms, worst ${f1.max.toFixed(1)} ms (${f1.n} frames)`);
  await page.evaluate(() => { document.querySelector('[data-go="sNew"]').click(); }); await page.waitForSelector('#sNew:not([hidden])');
  await page.evaluate(() => { document.querySelector('[data-district="kosice"]').click(); }); await page.waitForSelector('#sMap:not([hidden])');
  // start the cathedral plot (last) through the map's Play
  await page.evaluate(() => { document.querySelector('#sMap .pcard[data-plot="cathedral"]').click(); }); await page.waitForTimeout(300);
  const play = await page.evaluate(() => { const b = document.querySelector('#sMap [data-play="cathedral"]'); if (b && !b.disabled) { b.click(); return b.textContent; } return null; });
  ok(!!play, `${name}: Play pressed on the map (${play})`);
  await page.waitForSelector('#sIntro:not([hidden])', { timeout: 20000 }); ok(true, `${name}: intro card shown`);
  ok(await page.evaluate(() => window.__game.state === 'menu' && !!window.__game.intro), `${name}: run not started during intro`);
  const txt = await page.evaluate(() => document.getElementById('introCity').textContent + ' | ' + document.getElementById('introKicker').textContent + ' | ' + document.getElementById('introPlot').textContent);
  console.log('  card:', txt);
  const cam = () => page.evaluate(() => { const p = window.__game.camera.position; return [p.x, p.y, p.z].map((v) => +v.toFixed(1)); });
  await shot('2-intro-a', 700); const c1 = await cam(); await shot('3-intro-b', 1500); const c2 = await cam(); await shot('4-intro-c', 1500);
  ok(JSON.stringify(c1) !== JSON.stringify(c2), `${name}: camera moves during the pass ${c1} -> ${c2}`);
  const f2 = await frames(page, 1500); ok(f2.p95 < 25, `${name}: intro frames p95 ${f2.p95.toFixed(1)} ms, worst ${f2.max.toFixed(1)} ms`);
  // skip
  if (touch) await page.evaluate(() => document.getElementById('sIntro').click()); else await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 3000 }).then(() => ok(true, `${name}: skip starts the run`), () => ok(false, `${name}: skip did not start the run`));
  await shot('5-play', 1200);
  const f3 = await frames(page, 2000); ok(f3.p95 < 25, `${name}: play frames p95 ${f3.p95.toFixed(1)} ms`);
  // back to the menu: it reloads the last played city and flies over it
  await page.evaluate(() => document.getElementById('btnPause').click()); await page.waitForSelector('#sPause:not([hidden])');
  await page.evaluate(() => document.getElementById('btnQuit').click()); await page.waitForSelector('#sTitle:not([hidden])');
  await shot('6-menu-again', 1500);
  ok(await page.evaluate(() => window.__game.levelId === 'kosice' && window.__game.loadedPlotId === 'cathedral'), `${name}: menu scene is the last played city`);
  ok(errors.length === 0, `${name}: no console errors ${errors.slice(0, 3).join(' / ')}`);
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `FAILED: ${fails.length}` : 'ALL PASSED'); process.exit(fails.length ? 1 : 0);
