const { chromium } = await import(process.cwd() + '/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => localStorage.setItem('tb3d_settings_v2', JSON.stringify({ quality: 'high', hints: false })));
await page.goto('http://localhost:8000', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__debug); await page.waitForTimeout(800);
for (const n of [4, 3, 4]) {
  await page.evaluate((n) => window.__debug.loadPlot(n, 'kosice'), n);
  await page.waitForTimeout(300);
  console.log(n, await page.evaluate(() => { const c = window.__scene.getObjectByName('level').getObjectByName('st-elisabeth'); const lod = c && c.children.find(o => o.isLOD); let meshes = 0; c && c.traverse(o => { if (o.isMesh) meshes++; }); return { found: !!c, lod: !!lod, levels: lod ? lod.levels.length : null, meshes }; }));
}
await browser.close();
