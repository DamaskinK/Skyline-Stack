// S0004 04: camera at floor 0 and floor 10 on every Kosice plot, and the intro pass frames of the plots with landmarks.
// Usage: node tests/browser/s4-04.mjs [--quality low|high] [--out dir] [--plots 0,1,2,3,4] [--vp 1280x720]
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'high'), out = opt('out', 'tests/browser/out-s4-04'), app = opt('app', 'http://localhost:8000');
const [W, H] = opt('vp', '1280x720').split('x').map(Number), plots = opt('plots', '0,1,2,3,4').split(',').map(Number);
const IDS = ['terasa', 'juzna', 'kulturpark', 'hlavna-south', 'cathedral'];
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const fails = [];
for (const n of plots) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((q) => { try { localStorage.setItem('skyline_settings_v2', JSON.stringify({ quality: q, hints: false, difficulty: 'easy' }));
    const pl = (h) => ({ stars: 3, bestHeight: h, residents: 40, counted: true });
    localStorage.setItem('skyline_district_v1', JSON.stringify({ v: 2, cities: { kosice: { plots: { terasa: pl(14), juzna: pl(16), kulturpark: pl(20), 'hlavna-south': pl(24) } } } })); } catch {} }, quality);
  await page.goto(app, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.loadedPlotId === 'cathedral', null, { timeout: 40000 });
  await page.evaluate(() => { document.querySelector('[data-go="sNew"]').click(); }); await page.waitForSelector('#sNew:not([hidden])');
  await page.evaluate(() => { document.querySelector('[data-district="kosice"]').click(); }); await page.waitForSelector('#sMap:not([hidden])');
  const id = IDS[n];
  await page.evaluate((id) => document.querySelector(`#sMap .pcard[data-plot="${id}"]`).click(), id); await page.waitForTimeout(300);
  await page.evaluate((id) => document.querySelector(`#sMap [data-play="${id}"]`).click(), id);
  await page.waitForSelector('#sIntro:not([hidden])', { timeout: 40000 });
  const nk = await page.evaluate(() => window.__game.intro.keys.length), dur = await page.evaluate(() => window.__game.intro.dur);
  // intro: set the clock to fractions of the pass, so frames are the same every run
  for (const f of [0.2, 0.4, 0.6, 0.8]) {
    await page.evaluate(([f]) => { const it = window.__game.intro; it.t = f * it.dur; }, [f]); await page.waitForTimeout(250);
    await page.screenshot({ path: join(out, `p${n}-${id}-intro-${Math.round(f * 100)}.png`) });
  }
  console.log(`plot ${n} ${id}: intro ${nk} keys, ${dur.toFixed(1)} s`);
  await page.evaluate(() => window.__game.intro.done());
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(out, `p${n}-${id}-floor0.png`) });
  await page.evaluate(() => { window.__bot = setInterval(() => { const g = window.__game, b = g.block, T = g.tower;
    if (!b || b.state !== 'hang' || g.state !== 'play') return; const top = T.n ? T.top() : { x: T.bx, z: T.bz };
    if (Math.abs(b.x - top.x) < 0.2 && Math.abs(b.z - top.z) < 0.2) g.drop(); }, 8); });
  await page.waitForFunction(() => window.__game.tower && window.__game.tower.n >= 10, null, { timeout: 120000 }).catch(() => console.log('  floor 10 not reached'));
  await page.evaluate(() => clearInterval(window.__bot)); await page.waitForTimeout(2200);
  console.log(`  floors ${await page.evaluate(() => window.__game.tower.n)}`);
  await page.screenshot({ path: join(out, `p${n}-${id}-floor10.png`) });
  if (errors.length) { fails.push(id); console.log('  errors', errors.slice(0, 3)); }
  await ctx.close();
}
await browser.close(); process.exit(fails.length ? 1 : 0);
