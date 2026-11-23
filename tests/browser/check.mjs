// Browser checks on the running game (Playwright + the system Chrome, real GPU).
//   node tests/browser/check.mjs [all|shots|perf|flicker|audit] [--app URL] [--quality low|medium|high] [--level kosice] [--plot 0-4|all]
//                                [--budget 18] [--viewport 2560x1440] [--dpr 2] [--headed] [--out tests/browser/out]
//   --quality all  runs the whole command once per preset (low, medium, high) in turn and fails if any run fails;
//   `flicker --plot all --quality all` is the coplanar-surface check on every plot and every quality preset.
// Needs the game served (npm run serve, or npm run preview with --app http://localhost:8001).
// Prints a short report, writes it and the screenshots to the out folder, and exits 1 if a check fails.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const cmd = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
if (opt('quality', 'high') === 'all') {
  let bad = 0;
  for (const q of ['low', 'medium', 'high']) {
    const a = args.slice(); a[a.indexOf('--quality') + 1] = q;
    if (!a.includes('--out')) a.push('--out', `tests/browser/out/${q}`);
    console.log(`\n=== quality ${q} ===`);
    bad += spawnSync(process.execPath, [process.argv[1], ...a], { stdio: 'inherit' }).status ? 1 : 0;
  }
  console.log(bad ? `RESULT FAIL (${bad} preset runs failed)` : 'RESULT PASS (all presets)');
  process.exit(bad ? 1 : 0);
}
const app = opt('app', 'http://localhost:8000'), quality = opt('quality', 'high'), level = opt('level', 'kosice');
const budget = Number(opt('budget', 18)), out = opt('out', 'tests/browser/out'), headed = args.includes('--headed');
// share of pixels that may change: 'depth' = camera moves 4 mm; 'shadow' = only the sun's aim point moves 4 cm
const FLICKER_MAX = { depth: 0.01, shadow: 0.002 };
const POSES = {
  menu: { radius: 44, height: 24, look: [0, 2, 0] },
  game: { radius: 23, height: 12, look: [0, 8, 0] },
  low: { radius: 20, height: 6, look: [0, 1, 0] },
  ground: { radius: 34, height: 3.5, look: [0, 0.5, 0] },   // grazing view over the ground layers: bike lanes, roads, paths, car parks, track beds
};

mkdirSync(out, { recursive: true });
const lines = [], fails = [];
const log = (s) => { lines.push(s); console.log(s); };
const plot = opt('plot', null);   // plot index of --level (kosice or newtown): the scene of that plot is built around the tower before the checks; 'all' runs the flicker check on every plot
const plotList = plot === 'all' ? [0, 1, 2, 3, 4] : plot !== null ? [Number(plot)] : [];
const tag = `${level}${plot !== null ? '-p' + plot : ''}-${quality}${opt('dpr', 1) != 1 ? '-dpr' + opt('dpr', 1) : ''}`;

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: !headed,
  executablePath: process.env.PW_PATH || (existsSync(chrome) ? chrome : undefined),
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
});
const [vw, vh] = opt('viewport', '1280x720').split('x').map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: Number(opt('dpr', 1)) });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript((q) => {
  try { const k = 'skyline_settings_v2'; const s = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...s, quality: q, hints: false })); } catch { /* ignore */ }
}, quality);

await page.goto(app, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__debug, null, { timeout: 15000 });
await page.waitForTimeout(800);
const loadPlot = async (n) => { const errs = await page.evaluate(([n, c]) => window.__debug.loadPlot(Number(n), c), [n, level]); log(`plot ${n} loaded${errs.length ? ' with errors ' + JSON.stringify(errs) : ''}`); await page.waitForTimeout(500); };
if (plotList.length) await loadPlot(plotList[0]);
const info = await page.evaluate(() => window.__debug.info());
log(`app ${app} · level ${level} · quality ${quality} · ${vw}x${vh} dpr ${opt('dpr', 1)} · GPU ${info.gpu}`);

if (cmd === 'all' || cmd === 'audit') {
  // placement audit (S0004 00): every object placed in the built scene of each plot (trees, hedges, beds, furniture, shops, stalls ...) against the
  // real size of houses, carriageways, bike lanes, tram beds, footways, basins, river and the plaza; the plan it was built from; any finding fails
  for (const n of plotList.length ? plotList : [0, 1, 2, 3, 4]) {
    await loadPlot(n);
    const r = await page.evaluate(() => window.__debug.placementAudit());
    if (!r) { fails.push(`audit plot ${n}`); log(`audit plot ${n}: no near ring in the scene FAIL`); continue; }
    const { count: midCount = 0, ...midFind } = r.middle, midTotal = Object.values(midFind).reduce((a, b) => a + b, 0);
    const total = Object.values(r.byCategory).reduce((a, b) => a + b, 0) + midTotal, planTotal = Object.values(r.planByCategory).reduce((a, b) => a + b, 0);
    const ok = total === 0 && planTotal === 0 && r.mismatches.length === 0;
    if (!ok) fails.push(`audit plot ${n}`);
    log(`audit plot ${n}: ${Object.values(r.counts).reduce((a, b) => a + b, 0)} scene objects, ${total} findings (middle ring ${midCount} footprints, ${midTotal}), plan ${planTotal} findings, ${r.mismatches.length} count mismatches ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) log(`  ${JSON.stringify(r.byCategory)} ${JSON.stringify(midFind)} ${JSON.stringify(r.planByCategory)} ${JSON.stringify(r.mismatches)} ${JSON.stringify(r.sample)}`);
  }
}

if (cmd === 'all' || cmd === 'flicker') {
  // twice per pose with a 4 mm camera move (depth) or a 4 cm sun move (shadow); with --plot all every plot of the district is built and checked
  for (const n of plotList.length ? plotList : [null]) {
    if (plotList.length > 1 && n !== plotList[0]) await loadPlot(n);
    for (const kind of ['depth', 'shadow']) {
      for (const [name, pose] of Object.entries(POSES)) {
        const r = await page.evaluate((p) => window.__debug.flicker(p), { ...pose, kind });
        const ok = r.max <= FLICKER_MAX[kind], label = n === null ? '' : `plot ${n} `;
        if (!ok) fails.push(`flicker ${label}${kind} ${name}`);
        log(`flicker ${label}${kind.padEnd(6)} ${name.padEnd(6)} max ${(r.max * 100).toFixed(2)}% mean ${(r.mean * 100).toFixed(2)}% (limit ${(FLICKER_MAX[kind] * 100).toFixed(1)}%) ${ok ? 'PASS' : 'FAIL'}`);
      }
    }
  }
}

if (cmd !== 'flicker' && cmd !== 'audit') {
  // start a run and let a simple bot drop each block when it is over the tower top
  await page.evaluate((lv) => { document.querySelector('[data-go="sNew"]').click(); document.querySelector(`[data-endless="${lv}"]`)?.click(); document.querySelector('#btnStart').click(); }, level);
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__bot = setInterval(() => {
      const g = window.__game, b = g.block, T = g.tower;
      if (!b || b.state !== 'hang' || g.state !== 'play') return;
      const top = T.n ? T.top() : { x: T.bx, z: T.bz };
      if (Math.abs(b.x - top.x) < 0.2 && Math.abs(b.z - top.z) < 0.2) g.drop();
    }, 8);
  });
  await page.waitForTimeout(1500);
  if (cmd === 'all' || cmd === 'shots') {
    await page.screenshot({ path: join(out, `${tag}-start.png`) });
    log(`shot ${join(out, `${tag}-start.png`)}`);
  }
  if (cmd === 'all' || cmd === 'perf') {
    const r = await page.evaluate(() => new Promise((done) => {
      const d = []; let last = performance.now();
      const tick = (now) => { d.push(now - last); last = now; if (d.length < 360) requestAnimationFrame(tick); else done(d); };
      requestAnimationFrame(tick);
    }));
    const s = r.slice(10).sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    const i2 = await page.evaluate(() => window.__debug.info());
    const ok = q(0.9) <= budget;
    if (!ok) fails.push('perf');
    log(`perf p50 ${q(0.5).toFixed(1)} ms · p90 ${q(0.9).toFixed(1)} ms (budget ${budget}) · ${(1000 / q(0.5)).toFixed(0)} fps · ${i2.calls} draw calls · ${i2.triangles} triangles ${ok ? 'PASS' : 'FAIL'}`);
  }
  if (cmd === 'all' || cmd === 'shots') {
    await page.waitForFunction(() => window.__game.tower && window.__game.tower.n >= 8 || window.__game.state !== 'play', null, { timeout: 60000 }).catch(() => {});
    await page.screenshot({ path: join(out, `${tag}-mid.png`) });
    log(`shot ${join(out, `${tag}-mid.png`)} (floor ${await page.evaluate(() => window.__game.tower?.n ?? 0)})`);
  }
}

if (errors.length) { fails.push('console'); log(`console errors: ${errors.length}`); for (const e of errors.slice(0, 5)) log(`  ${e}`); }
else log('console errors: none');
log(fails.length ? `RESULT FAIL (${fails.join(', ')})` : 'RESULT PASS');
writeFileSync(join(out, `report-${tag}.txt`), lines.join('\n') + '\n');
await browser.close();
process.exit(fails.length ? 1 : 0);
