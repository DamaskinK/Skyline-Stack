const { chromium } = await import(process.cwd() + '/node_modules/playwright/index.mjs');
const q = process.argv[2] || 'high';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-precise-memory-info','--js-flags=--expose-gc'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.addInitScript((q) => {
  localStorage.setItem('skyline_settings_v2', JSON.stringify({ quality: q, hints: false }));
  // all plots counted so district towers appear
  const mk = (ids, h) => Object.fromEntries(ids.map((id, i) => [id, { stars: 1, bestHeight: h[i], residents: 0, counted: true }]));
  if (!location.hash) localStorage.setItem('skyline_district_v1', JSON.stringify({ v: 2, cities: {
    kosice: { opened: true, goalReached: false, plots: mk(['terasa','juzna','kulturpark','hlavna-south','cathedral'], [12,15,18,22,26]) },
    newtown: { opened: true, goalReached: false, plots: mk(['edge','park-row','outer-ring','inner-ring','plaza'], [12,15,18,22,26]) } } }));
  const live = { buf: 0, tex: 0, vao: 0, prog: 0 }; window.__live = live;
  for (const C of [WebGL2RenderingContext]) {
    const P = C.prototype, w = (n, k, d) => { const o = P[n]; P[n] = function (...a) { const r = o.apply(this, a); live[k] += d; return r; }; };
    w('createBuffer','buf',1); w('deleteBuffer','buf',-1); w('createTexture','tex',1); w('deleteTexture','tex',-1);
    w('createVertexArray','vao',1); w('deleteVertexArray','vao',-1); w('createProgram','prog',1); w('deleteProgram','prog',-1);
  }
}, q);
await page.goto('http://localhost:8000/' + (process.argv[3]==='empty' ? '#e' : ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__debug);
await page.waitForTimeout(1000);
const snap = async (label) => {
  const r = await page.evaluate(() => { let objs = 0, people = 0; window.__scene.traverse(o => { objs++; }); const geos = new Set(), mats = new Set(); window.__scene.traverse(o => { if (o.geometry) geos.add(o.geometry); for (const m of [].concat(o.material || [])) mats.add(m); });
    return { ...window.__live, objs, geos: geos.size, mats: mats.size, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0, calls: window.__debug.info().calls }; });
  console.log(label.padEnd(14), JSON.stringify(r)); return r;
};
const rounds = []; await snap('start');
for (let round = 0; round < 4; round++) {
  for (const city of (process.argv[4] ? [process.argv[4]] : ['kosice','newtown'])) for (let n = 0; n < 5; n++) {
    await page.evaluate(([n, c]) => window.__debug.loadPlot(n, c), [n, city]);
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => window.gc && window.gc());
  await page.waitForTimeout(500);
  rounds.push(await snap('round ' + round)); console.log(await page.evaluate(() => [window.__game.levelId, window.__game.loadedPlotId, window.__scene.getObjectByName('district-towers').children.length, window.__scene.getObjectByName('level').children.length]));
}
console.log(errs);
// buffers must stay flat after the first round (before the fix: +300 per round); 10 % allows for lazy uploads
const grow = rounds[3].buf / rounds[0].buf; console.log('buffer growth round 0 -> 3:', grow.toFixed(2));
if (grow > 1.1 || errs.length) { console.log('FAIL'); process.exitCode = 1; } else console.log('PASS');
await browser.close();
