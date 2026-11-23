// UI screens at desktop and phone width (S0001 18): every screen, the HUD, the keyboard path and the old-storage migration.
// Usage: node tests/browser/ui-shots.mjs [--quality low|medium|high] [--out dir] [--app URL]
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const quality = opt('quality', 'low'), out = opt('out', 'tests/browser/out-s1-18'), app = opt('app', 'http://localhost:8000');
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const fails = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const RESULT = { plot: { reached: true, landings: 14, perfects: 9, livesLost: 1 }, counts: true, stars: 2, floors: 18, best: 18, residents: 61, bonuses: { view: true, skyline: false }, goalReached: true, goalNew: true, nextCity: { city: 'Prague' },
  totals: { residents: 120, goal: 150, counted: 3, plots: 5, stars: 7, maxStars: 15 } };
for (const [name, vp, touch] of [['desktop', { width: 1280, height: 720 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
  // OLD tb3d_* keys on purpose: the first load must carry them over
  await page.addInitScript((q) => {
    if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
    localStorage.setItem('tb3d_settings_v2', JSON.stringify({ quality: q, hints: false, difficulty: 'hard' }));
    localStorage.setItem('tb3d_district_v1', JSON.stringify({ v: 2, cities: { kosice: { plots: { terasa: { stars: 3, bestHeight: 14, residents: 40, counted: true }, juzna: { stars: 2, bestHeight: 15, residents: 38, counted: true } }, opened: true, goalReached: false } } }));
    localStorage.setItem('tb3d_name', 'Anna');
  }, quality);
  await page.goto(app, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const shot = async (n) => { await page.waitForTimeout(450); await page.screenshot({ path: join(out, `${name}-${n}.png`) }); };
  const mig = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem('skyline_settings_v2') || '{}'), d: !!localStorage.getItem('skyline_district_v1'), n: localStorage.getItem('skyline_name_v1') }));
  ok(mig.s.difficulty === 'hard' && mig.d && mig.n === 'Anna', `${name}: old tb3d_* keys carried over to skyline_*`);
  ok(!(await page.evaluate(() => document.body.innerText)).match(/tower bloxx/i), `${name}: no "Tower Bloxx" on the page`);
  await shot('1-title');
  if (touch) await page.tap('[data-go="sNew"]'); else { await page.keyboard.press('Enter'); }
  await page.waitForSelector('#sNew:not([hidden])'); ok(true, `${name}: Play opens New Game`);
  await shot('2-new');
  await page.click('[data-district="kosice"]'); await page.waitForSelector('#sMap:not([hidden])'); await shot('3-map');
  ok((await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)), `${name}: map has no horizontal scroll`);
  await page.click('#mapBack'); await page.waitForSelector('#sNew:not([hidden])');
  await page.keyboard.press('Escape'); await page.waitForSelector('#sTitle:not([hidden])'); ok(true, `${name}: Esc goes back to title`);
  for (const [go, n] of [['sSettings', '4-settings'], ['sScores', '5-scores'], ['sHelp', '6-help']]) {
    await page.click(`#sTitle [data-go="${go}"]`); await page.waitForSelector(`#${go}:not([hidden])`); await shot(n);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: ${go} has no horizontal scroll`);
    await page.keyboard.press('Escape'); await page.waitForSelector('#sTitle:not([hidden])');
  }
  // keyboard: arrow keys move focus on the title menu
  await page.waitForTimeout(200); await page.focus('#sTitle .mi'); await page.keyboard.press('ArrowDown');
  ok(await page.evaluate(() => document.activeElement.dataset.go === 'sScores'), `${name}: arrow down moves to the next menu item`);
  // play
  await page.click('#sTitle [data-go="sNew"]'); await page.click('[data-endless="newtown"]'); await page.click('#btnStart');
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 40000 });
  await page.waitForTimeout(1800);
  await page.evaluate(() => { window.__bot = setInterval(() => { const g = window.__game, b = g.block, T = g.tower; if (!b || b.state !== 'hang' || g.state !== 'play') return; const top = T.n ? T.top() : { x: T.bx, z: T.bz }; if (Math.abs(b.x - top.x) < 0.2 && Math.abs(b.z - top.z) < 0.2) g.drop(); }, 8); });
  await page.waitForFunction(() => window.__game.tower && window.__game.tower.n >= 4, null, { timeout: 60000 });
  await shot('7-hud');
  await page.evaluate(() => clearInterval(window.__bot));
  await page.keyboard.press('KeyP'); await page.waitForSelector('#sPause:not([hidden])'); await shot('8-pause');
  ok(true, `${name}: P pauses`);
  await page.keyboard.press('Escape'); await page.waitForSelector('#sPause', { state: 'hidden' });
  await page.evaluate(() => { const g = window.__game; g.state = 'over'; g.ui.gameOver({ score: 1840, floors: 14, pop: 52, diff: 'normal' }, true); });
  await page.waitForSelector('#sOver:not([hidden])'); await shot('9-over');
  await page.evaluate((R) => { window.__game.ui.plotDone(R, { name: 'Terasa estate', target: 12, require: { maxLivesLost: 2 } }, { city: 'Kosice', fictional: false }); }, RESULT);
  await page.waitForSelector('#sPlot:not([hidden])'); await shot('10-plot');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: result screens have no horizontal scroll`);
  ok(errors.length === 0, `${name}: no console errors ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `RESULT FAIL (${fails.length})` : 'RESULT PASS');
process.exit(fails.length ? 1 : 0);
