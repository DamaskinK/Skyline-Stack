// Scripted audio check: logs the music director's state changes (menu -> calm -> streak -> danger -> dropout -> win)
// with the music level (RMS before the volume setting) in each state, then tests mute, the sliders, and the synth
// fallback when the Kosice track is blocked. Needs the game served (npm run serve).
//   node tests/browser/audio-check.mjs [--app URL]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const app = args.includes('--app') ? args[args.indexOf('--app') + 1] : 'http://localhost:8000';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };

async function open(blockTrack) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_PATH || (existsSync(chrome) ? chrome : undefined), args: ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error' && !(blockTrack && /Failed to load resource/.test(m.text()))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('tb3d_settings_v2', JSON.stringify({ quality: 'low', hints: false, music: 0.35, sfx: 0.7, muted: false })); } catch { /* ignore */ } });
  if (blockTrack) await page.route('**/kosice.mp3', (r) => r.abort());
  await page.goto(app, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__music, null, { timeout: 15000 });
  await page.mouse.click(640, 360);                       // a gesture: starts the AudioContext
  return { browser, page };
}
const music = (page) => page.evaluate(() => ({ state: __music.state, chip: __music.usingChip, track: __music.trackId, rms: __music.rms(), out: __sfx.rms() }));

// ── 1. the full run ──
{
  const { browser, page } = await open(false);
  await page.waitForFunction(() => __sfx.menuTrack && __music.cur && !__music.cur.chip, null, { timeout: 20000 });
  await page.waitForTimeout(3000);
  const m = await music(page);
  console.log('menu', JSON.stringify(m));
  check(m.state === 'menu' && m.track === 'menu' && !m.chip && m.rms > 0.003, 'menu track plays from file (rms > 0)');
  const loaded = await page.evaluate(() => Object.keys(__sfx.buffers).sort().join(','));
  check(loaded === 'city,drop,land,rain,thunder,wind', `recorded SFX decoded (${loaded})`);

  // a district plot (the only run with a target since S0002): a short target so the win comes after the scripted collapse
  await page.evaluate(async () => { const m = await import('/js/levels.js'); m.cityById('kosice').district.plots[0].target = 12; });
  await page.evaluate(() => { document.querySelector('[data-go="sNew"]').click(); setTimeout(() => document.querySelector('[data-district="kosice"]').click(), 80); });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('[data-play="terasa"]').click());
  await page.waitForFunction(() => __game.state === 'play', null, { timeout: 60000 });
  // bot: drops when roughly over the tower. The Perfect window is widened for the 'perfect' phase (a simple bot cannot hit
  // 8 % of the width through wind and sway); mode 'risky' drops far off centre to push stability down.
  await page.evaluate(() => {
    window.__setMode = (m) => { window.__mode = m; __game.run.diff = { ...__game.run.diff, perfect: m === 'perfect' ? 0.45 : 0.08 }; };
    __game.run.lives = 9;   // extra lives so the scripted collapse does not end the run before the win
    window.__setMode('perfect');
    window.__samples = [];
    setInterval(() => window.__samples.push({ s: __music.state, rms: __music.rms(), n: __game.tower ? __game.tower.n : 0 }), 250);
    setInterval(() => {
      const g = __game, b = g.block, T = g.tower;
      if (!b || b.state !== 'hang' || g.state !== 'play') return;
      const top = T.n ? T.top() : { x: T.bx, z: T.bz };
      const off = window.__mode === 'risky' ? 1.0 : 0;
      const tol = window.__mode === 'risky' ? 0.25 : 0.15;
      if (Math.abs(b.x - top.x - off) < tol && Math.abs(b.z - top.z) < (off ? 0.35 : tol)) g.drop();
    }, 8);
  });
  const state = () => page.evaluate(() => __music.state);
  await page.waitForFunction(() => __music.state === 'streak', null, { timeout: 60000 }).catch(() => {});
  check((await state()) === 'streak', 'streak after consecutive Perfect landings');
  await page.evaluate(() => { window.__setMode('risky'); });
  await page.waitForFunction(() => __music.log.some((e) => e.to === 'danger') || __game.state !== 'play', null, { timeout: 90000 }).catch(() => {});
  const log1 = await page.evaluate(() => __music.log.map((e) => e.to));
  check(log1.includes('danger'), 'danger state when stability < 30 % (log: ' + log1.join(' > ') + ')');
  await page.waitForFunction(() => __music.log.some((e) => e.to === 'dropout') || __game.state !== 'play', null, { timeout: 90000 }).catch(() => {});
  await page.evaluate(() => { window.__setMode('perfect'); });   // survive: back to clean landings until the target
  await page.waitForFunction(() => __music.log.some((e) => e.to === 'win'), null, { timeout: 240000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const log = await page.evaluate(() => __music.log);
  console.log('state log: ' + log.map((e) => `${e.t}s ${e.from}->${e.to}${e.stability != null ? ' (stab ' + e.stability + ')' : ''}`).join(' | '));
  const seq = log.map((e) => e.to);
  for (const s of ['menu', 'calm', 'streak', 'danger', 'dropout', 'win']) check(seq.includes(s) || (s === 'menu' && log[0]?.from === 'menu'), `state reached: ${s}`);
  // level of the music per state (median of samples)
  const samples = await page.evaluate(() => window.__samples);
  const by = {}; for (const s of samples) (by[s.s] ||= []).push(s.rms);
  const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const levels = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +med(v).toFixed(4)]));
  console.log('music rms by state', JSON.stringify(levels), 'samples', Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length])));
  if (levels.dropout != null && levels.streak != null) check(levels.dropout < levels.streak * 0.6, 'dropout is quieter than streak');
  if (levels.calm != null && levels.streak != null) check(levels.calm < levels.streak, 'calm is quieter than streak');

  // mute and sliders (music keeps its own level; the output stage follows the settings)
  await page.evaluate(() => { document.querySelector('#btnMute').click(); });
  await page.waitForTimeout(600);
  const muted = await music(page);
  check(muted.out < 0.0005, `mute silences the output (out rms ${muted.out.toFixed(5)})`);
  await page.evaluate(() => { document.querySelector('#btnMute').click(); });
  await page.waitForTimeout(600);
  const on = await music(page);
  check(on.out > 0.001, `unmute restores output (out rms ${on.out.toFixed(4)})`);
  console.log('mus gain', await page.evaluate(() => __sfx.mus.gain.value), 'sfx gain', await page.evaluate(() => __sfx.fx.gain.value));
  await page.evaluate(() => { const el = document.querySelector('#volMusic'); el.value = 100; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  const hi = await page.evaluate(() => __sfx.mus.gain.value);
  await page.evaluate(() => { const el = document.querySelector('#volMusic'); el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const lo = await page.evaluate(() => __sfx.mus.gain.value);
  check(hi > 0.3 && lo === 0, `music slider drives the music gain (100 -> ${hi}, 0 -> ${lo})`);
  await browser.close();
}

// ── 2. fallback: the level track fails to load ──
{
  const { browser, page } = await open(true);
  await page.waitForFunction(() => __sfx.menuTrack, null, { timeout: 20000 });
  await page.evaluate(() => { document.querySelector('[data-go="sNew"]').click(); document.querySelector('#btnStart').click(); });
  await page.waitForFunction(() => __game.state === 'play', null, { timeout: 40000 });
  await page.waitForTimeout(2500);
  const m = await music(page);
  console.log('blocked track', JSON.stringify(m));
  check(m.chip && m.track === 'kosice' && m.rms > 0.002, `missing level track: synth fallback plays (rms ${m.rms.toFixed(4)})`);
  await browser.close();
}

if (errors.length) { fails.push('console'); console.log('console errors:', errors.slice(0, 5)); } else console.log('console errors: none');
console.log(fails.length ? `RESULT FAIL (${fails.length})` : 'RESULT PASS');
process.exit(fails.length ? 1 : 0);
