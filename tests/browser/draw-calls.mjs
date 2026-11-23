const { chromium } = await import(process.cwd() + '/node_modules/playwright/index.mjs');
const q = process.argv[2] || 'high';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--ignore-gpu-blocklist','--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.addInitScript((q) => {
  localStorage.setItem('skyline_settings_v2', JSON.stringify({ quality: q, hints: false }));
  const mk = (ids, h) => Object.fromEntries(ids.map((id, i) => [id, { stars: 1, bestHeight: h[i], residents: 0, counted: true }]));   // a full district: every plot has a finished tower
  localStorage.setItem('skyline_district_v1', JSON.stringify({ v: 2, cities: {
    kosice: { opened: true, goalReached: false, plots: mk(['terasa','juzna','kulturpark','hlavna-south','cathedral'], [12,15,18,22,26]) },
    newtown: { opened: true, goalReached: false, plots: mk(['edge','park-row','outer-ring','inner-ring','plaza'], [12,15,18,22,26]) } } }));
}, q);
await page.goto('http://localhost:8000', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__debug);
await page.waitForTimeout(800);
await page.evaluate(() => window.__debug.loadPlot(3, 'newtown'));
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const s = window.__scene, out = {};
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  // find renderer via debug info
  await frame(); const base = window.__debug.info().calls; out.base = base;
  for (const c of s.children) {
    if (!c.visible) continue;
    c.visible = false; await frame(); const v = window.__debug.info().calls; c.visible = true;
    const nm = (c.name || c.type) + (c.isMesh ? '(mesh)' : '');
    out[nm] = (out[nm] || 0) + (base - v);
  }
  // nearProc breakdown
  const np = s.getObjectByName('procedural-near'); let meshes = 0, groupsDraws = 0, mats = new Set();
  np.traverse(o => { if (o.isMesh) { meshes++; groupsDraws += Array.isArray(o.material) ? o.geometry.groups.length : 1; } });
  out.nearProcMeshes = meshes; out.nearProcGroupDraws = groupsDraws;
  out.castShadowMeshes = 0; s.traverse(o => { if (o.isMesh && o.castShadow && o.visible) out.castShadowMeshes++; });
  return out;
});
console.log(q, JSON.stringify(r, null, 1), errs);
await browser.close();
