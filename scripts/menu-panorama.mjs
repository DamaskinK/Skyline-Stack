// S0004 19: renders the fixed main-menu picture (assets/ui/menu-kosice.png) from the game scene: Kosice, cathedral plot, a fixed camera pose,
// shrunk to a pixel grid and posterised to a small palette. Run once by hand when the city or its look changes; the menu itself loads no city.
// Usage: node scripts/menu-panorama.mjs [--app http://localhost:8000] [--pose 0] [--w 480] [--out assets/ui/menu-kosice.png]
import { chromium } from 'playwright';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const app = opt('app', 'http://localhost:8000'), W = Number(opt('w', 480)), H = Math.round(W * 9 / 16), out = opt('out', 'assets/ui/menu-kosice.png'), pose = Number(opt('pose', 0));
const POSES = [
  { p: [60, 30, 90], l: [-10, 22, -10] },
  { p: [-70, 38, 80], l: [0, 24, 0] },
  { p: [40, 55, 130], l: [0, 20, -20] },
  { p: [30, 75, 150], l: [0, 22, -20] },
  { p: [55, 62, 125], l: [-5, 24, -15] },
];
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('skyline_settings_v2', JSON.stringify({ quality: 'high', hints: false })); } catch {} });
await page.goto(app, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
await page.evaluate(async (po) => {
  const g = window.__game;
  document.body.classList.remove('menu-bg'); for (const s of document.querySelectorAll('.screen')) s.hidden = true;
  await g.loadPlot('kosice', 'cathedral', () => {});
  g.state = 'menu';
  g.intro = { t: 0, dur: 1e9, keys: [po, po], done() {} };
}, POSES[pose]);
await page.waitForTimeout(4000);
const png = await page.locator('#c').screenshot();
const data = await page.evaluate(async ([b64, w, h]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h), L = 11;   // levels per channel
  for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(Math.round(d.data[i + k] / 255 * (L - 1)) * 255 / (L - 1));
  x.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
}, [png.toString('base64'), W, H]);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(data, 'base64'));
console.log('wrote', out, W, 'x', H);
await browser.close();
