// S0004 19: the main menu draws no city (frame times at 2560x1440 DPR 2) and every icon is pixel art. Usage: node tests/browser/s4-19.mjs [--app URL] [--out dir]
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const app = opt('app', 'http://localhost:8000'), out = opt('out', 'tests/browser/out-s4-19'); mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const fails = []; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const frames = (page, ms) => page.evaluate((ms) => new Promise((res) => { const t = []; let last = performance.now(), end = last + ms;
  const f = (n) => { t.push(n - last); last = n; if (n < end) requestAnimationFrame(f); else { t.shift(); t.sort((a, b) => a - b); res({ p95: t[Math.floor(t.length * 0.95)], max: t[t.length - 1], n: t.length }); } }; requestAnimationFrame(f); }), ms);
{ // menu frame times, big screen
  const page = await (await browser.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 })).newPage();
  const t0 = Date.now(); await page.goto(app, { waitUntil: 'load' }); await page.waitForSelector('#sTitle:not([hidden]) .mi');
  ok(Date.now() - t0 < 4000, `title visible ${Date.now() - t0} ms after load`);
  const r = await frames(page, 5000); ok(r.p95 < 20 && r.max < 60, `menu 2560x1440 DPR2: p95 ${r.p95.toFixed(1)} ms, worst ${r.max.toFixed(1)} ms (${r.n} frames)`);
  ok(await page.evaluate(() => !window.__game.levelId), 'no city loaded in the menu');
  await page.screenshot({ path: join(out, 'big-menu.png') });
}
for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['narrow', { width: 562, height: 694 }], ['phone', { width: 390, height: 844 }]]) {
  const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 1 })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(app, { waitUntil: 'load' }); await page.waitForSelector('#sTitle:not([hidden]) .mi');
  await page.evaluate(() => { document.querySelector('[data-go="sHelp"]').click(); }); await page.waitForSelector('#sHelp:not([hidden])');
  const n = await page.evaluate(() => document.querySelectorAll('#helpWeather svg.px').length); ok(n === 8, `${name}: 8 pixel weather icons in help (${n})`);
  await page.evaluate(() => document.querySelector('#helpWeather').scrollIntoView()); await page.waitForTimeout(400); await page.screenshot({ path: join(out, `${name}-weather.png`) });
  const bad = await page.evaluate(() => [...document.querySelectorAll('[data-icon] svg, #hLives svg, #helpWeather svg')].filter((s) => !s.classList.contains('px') || s.querySelector('circle,ellipse,line,polyline,polygon')).length);
  ok(bad === 0, `${name}: HUD and help icons are all pixel svgs (${bad} not)`);
  ok(errors.length === 0, `${name}: no console errors ${errors.slice(0, 2).join(' / ')}`);
}
await browser.close(); console.log(fails.length ? `FAILED: ${fails.length}` : 'ALL PASSED'); process.exit(fails.length ? 1 : 0);
