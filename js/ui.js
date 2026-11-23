// Menus, settings, scores and the in-game HUD. Screens are <section class="screen"> elements shown one at a time.
import { BUILDING_TYPES } from './building-types.js';
import { CFG, DIFFICULTY, BTYPES, WEATHER, specialFor } from './config.js';
import { settings, setSetting, loadScores, addScore, resetScores, loadProgress } from './settings.js';
import { levelById, DISTRICT_CITIES } from './levels.js';
import { showDistrictTowers } from './district-towers.js';
import { loadDistrictProgress } from './settings.js';
import { cityProgress } from './core/district-progress.js';
import { requirementText } from './district-map.js';
import { createDistrictMap } from './district-map.js';
import { Sfx } from './audio.js';
import { People } from './fx.js';
import { buildDemo, clearDemo } from './game.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[<>&"]/g, '');

export const WX_ICONS = {
  Clear: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7" fill="#ffd34d" stroke="#000" stroke-width="2"/><g stroke="#ffd34d" stroke-width="3"><path d="M16 2v5M16 25v5M2 16h5M25 16h5M6 6l3 3M23 23l3 3M26 6l-3 3M6 26l3-3"/></g></svg>',
  Rain: '<svg viewBox="0 0 32 32"><path d="M8 18a6 6 0 0 1 1-12 8 8 0 0 1 15 3 5 5 0 0 1 0 9z" fill="#c8d2e2" stroke="#000" stroke-width="2"/><path d="M10 22l-2 6M16 22l-2 6M22 22l-2 6" stroke="#52d9ff" stroke-width="2.5"/></svg>',
  Snow: '<svg viewBox="0 0 32 32"><path d="M8 18a6 6 0 0 1 1-12 8 8 0 0 1 15 3 5 5 0 0 1 0 9z" fill="#eef3fa" stroke="#000" stroke-width="2"/><g fill="#fff" stroke="#000"><circle cx="10" cy="25" r="2"/><circle cx="17" cy="27" r="2"/><circle cx="23" cy="24" r="2"/></g></svg>',
  Storm: '<svg viewBox="0 0 32 32"><path d="M8 17a6 6 0 0 1 1-12 8 8 0 0 1 15 3 5 5 0 0 1 0 9z" fill="#5a6378" stroke="#000" stroke-width="2"/><path d="M17 15l-5 8h5l-3 7 8-10h-5l3-5z" fill="#ffd34d" stroke="#000" stroke-width="1.5"/></svg>',
  'Heat haze': '<svg viewBox="0 0 32 32"><circle cx="16" cy="12" r="6" fill="#ffd34d" stroke="#000" stroke-width="2"/><g stroke="#ff9a4d" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M3 22q3-3 6 0t6 0 6 0 6 0M3 28q3-3 6 0t6 0 6 0 6 0"/></g></svg>',
  Sandstorm: '<svg viewBox="0 0 32 32"><g stroke="#d8a468" stroke-width="3" stroke-linecap="round" fill="none"><path d="M4 10h16a3 3 0 1 0-3-3M4 17h22a3 3 0 1 1-3 3M4 24h12"/></g></svg>',
  Typhoon: '<svg viewBox="0 0 32 32"><path d="M8 17a6 6 0 0 1 1-12 8 8 0 0 1 15 3 5 5 0 0 1 0 9z" fill="#3a4258" stroke="#000" stroke-width="2"/><path d="M10 21l-3 8M16 21l-3 8M22 21l-3 8" stroke="#52d9ff" stroke-width="3"/></svg>',
  Fog: '<svg viewBox="0 0 32 32"><g stroke="#f2c0a0" stroke-width="3" stroke-linecap="round"><path d="M4 10h20M8 16h20M4 22h18M10 28h14"/></g></svg>',
};
const HEART = (on) => `<svg viewBox="0 0 24 22" class="${on ? '' : 'off'}"><path d="M12 21 L3 12 A5 5 0 0 1 12 5 A5 5 0 0 1 21 12 Z" fill="#ff4d5e" stroke="#000" stroke-width="2"/></svg>`;
const STAR = (on) => `<svg viewBox="0 0 24 24" class="${on ? '' : 'off'}"><path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.6 5.8 21.2l1.4-7L2 9.4l7-.9z" fill="#ffd34d" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export function createUI(game) {
  // ── screen stack ──
  let stack = [];
  const screens = $$('.screen');
  function show(id, push = true) {
    for (const s of screens) s.hidden = s.id !== id;
    if (push) stack.push(id);
    const s = $('#' + id);
    s.style.animation = 'none'; void s.offsetWidth; s.style.animation = '';
    if (id === 'sScores') renderScores($('#hsTable'), 'kosice');
    if (id === 'sTitle') renderTitleBest();
    if (id === 'sNew') renderModes();
    if (id === 'sSettings') syncSettings();
    setTimeout(() => (s.querySelector('[aria-pressed="true"].card-opt, .mi, .btn, button') || s).focus({ preventScroll: true }), 30);
  }
  function hideScreens() { for (const s of screens) s.hidden = true; }
  function back() {
    if (stack.length <= 1) return;
    stack.pop(); Sfx.uiBack();
    show(stack[stack.length - 1], false);
  }
  const current = () => screens.find((s) => !s.hidden);

  // ── logo ──
  const tileCols = ['#4f7cff', '#e86f4f', '#3fd07a', '#ffc531', '#ff5fa2'];
  [...'TOWER'].forEach((ch, i) => { const d = document.createElement('div'); d.className = 'lt'; d.textContent = ch; d.style.background = tileCols[i % 5]; d.style.animationDelay = `${i * 0.08}s, ${i * 0.15}s`; $('#logoTop').appendChild(d); });
  [...'BLOXX'].forEach((ch, i) => { const d = document.createElement('div'); d.className = 'lt'; d.textContent = ch; d.style.background = tileCols[(i + 2) % 5]; d.style.animationDelay = `${0.4 + i * 0.08}s, ${0.7 + i * 0.15}s`; $('#logoBot').appendChild(d); });
  function renderTitleBest() {
    const e = loadScores('kosice')[0];
    $('#titleBest').innerHTML = e ? `BEST TOWER <b>${e.score}</b> · ${e.floors} FL` : 'NO RECORDS YET. BE THE FIRST.';
  }

  // ── navigation ──
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]'); if (go) { Sfx.init(); Sfx.uiOk(); show(go.dataset.go); return; }
    if (e.target.closest('[data-back]')) back();
  });
  for (const b of $$('.mi, .card-opt, .seg button, .tabs button')) b.addEventListener('pointerenter', () => { if (document.activeElement !== b) { b.focus({ preventScroll: true }); Sfx.ui(); } });

  // ── new game ──
  let pickDiff = settings.difficulty, pickMode = 'endless', pickCity = 'kosice';
  const dc = $('#diffCards');
  for (const [k, d] of Object.entries(DIFFICULTY)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `card-opt d-${k}`; b.dataset.diff = k;
    const m = d.meters, bar = (v) => `<span class="meter"><i style="width:${v * 100}%"></i></span>`;
    b.innerHTML = `<b>${d.label}</b><span>${d.desc}</span><span class="meters"><span>Crane</span>${bar(m.crane)}<span>Wind</span>${bar(m.wind)}<span>Precision</span>${bar(m.precision)}<span>Lives</span><span>${'♥'.repeat(d.lives)}</span></span>`;
    b.onclick = () => { pickDiff = k; Sfx.ui(); syncNew(); };
    dc.appendChild(b);
  }
  function syncNew() {
    for (const b of $$('[data-diff]')) b.setAttribute('aria-pressed', String(b.dataset.diff === pickDiff));
    for (const b of $$('[data-endless]')) b.setAttribute('aria-pressed', String(b.dataset.endless === pickCity));
    $('#modeNote').textContent = `ENDLESS: one tower on the ${pickCity === 'newtown' ? 'Newtown plaza' : 'Kosice city centre plot'}, as high as you can.`
      + ' The weather keeps changing as you climb. Districts are played from the cards below.';
  }
  syncNew();
  // Mode cards: Kosice level (with its best stars) and Endless. The world map (ticket 20) will replace this.
  function renderModes() {
    $('#modeCards').innerHTML =
      `<button type="button" class="card-opt" data-mode="endless" data-endless="kosice"><b>ENDLESS · KOSICE</b><span class="sub">No target, as high as you can</span></button>`
      + `<button type="button" class="card-opt" data-mode="endless" data-endless="newtown"><b>ENDLESS · NEWTOWN</b><span class="sub">The made-up city, open from the start</span></button>`;
    for (const b of $$('[data-endless]')) b.onclick = () => { pickMode = 'endless'; pickCity = b.dataset.endless; Sfx.ui(); syncNew(); };
    syncNew();
    $('#districtCards').innerHTML = DISTRICT_CITIES.filter((c) => c.built).map((c) =>
      `<button type="button" class="card-opt" data-district="${c.id}"><b>${c.city.toUpperCase()}</b><span class="sub">${c.fictional ? 'Made-up city' : c.country} · 5 plots · goal ${c.district.goal} residents</span></button>`).join('');
    for (const b of $$('[data-district]')) b.onclick = () => { Sfx.init(); Sfx.uiOk(); districtMap.render(b.dataset.district); show('sMap'); };
  }
  // District map (S0002 05). Play loads the scene of the plot and runs it with the plot's rules.
  const districtMap = createDistrictMap({
    onPlay: (cityId, plotId) => startGame('plot', pickDiff, cityId, plotId),
    onBack: back,
  });
  // Back to the district map after a plot: the finished towers stand on their sites, the next open plot is selected.
  function toMap(cityId) {
    const plotId = game.plotId;
    game.clear(); game.state = 'menu'; game.paused = false;
    $('#hud').hidden = true; $('#wxCard').hidden = true;
    const info = districtMap.render(cityId, { focusNext: true });
    const plots = cityProgress(loadDistrictProgress(), cityId).plots;
    const shown = plotId ? showDistrictTowers(cityId, plotId, plots, { withCurrent: true }) : null;
    if (!shown || !plots[plotId] || !plots[plotId].counted) buildDemo();
    People.setWalkers(9);
    stack = ['sTitle', 'sNew']; show('sMap');
    return info;
  }
  $('#btnStart').onclick = () => startGame(pickMode, pickDiff, pickCity);
  let starting = false;
  // plot mode: a district plot of `level` (a city id). Endless and the other modes run on the city centre plot (Kosice: the cathedral).
  async function startGame(mode, diff, level = 'kosice', plotId = null) {
    if (starting) return; starting = true;
    Sfx.init(); Sfx.uiOk(); stack = [];
    const plots = (DISTRICT_CITIES.find((c) => c.id === level) || {}).district?.plots;
    const pid = plotId || (plots ? plots[plots.length - 1].id : null);
    if (pid && (game.levelId !== level || game.loadedPlotId !== pid || mode === 'plot')) await loadPlot(level, pid);
    else if (!pid && game.levelId !== level) await loadLevel(level);
    clearDemo(); hideScreens();
    if (mode === 'plot') game.startPlot(level, pid, diff); else game.start(mode, diff, level);
    starting = false;
  }
  const restart = () => (game.mode === 'plot' ? startGame('plot', game.diffKey, game.cityId, game.plotId) : startGame(game.mode, game.diffKey, game.cityId));
  // Loading screen with progress. A failed asset is named on screen and the game goes on with what it has.
  const loadLevel = (level) => loadWith((setP) => game.loadLevel(level, setP));
  const loadPlot = (level, pid) => loadWith((setP) => game.loadPlot(level, pid, setP));
  async function loadWith(load) {
    const bar = $('#loadBar'), fill = bar.querySelector('i'), text = $('#loadText');
    const setP = (p) => { fill.style.width = `${(p * 100).toFixed(0)}%`; bar.setAttribute('aria-valuenow', String(Math.round(p * 100))); };
    setP(0); text.classList.remove('err'); text.textContent = 'Fetching the city...';
    show('sLoading', false);
    try {
      const errors = await load(setP);
      if (errors.length) {
        text.classList.add('err');
        text.textContent = `Some files did not load (${errors.map((e) => e.url.split('/').pop()).join(', ')}). Playing without them.`;
        await new Promise((r) => setTimeout(r, 1800));
      }
    } catch (e) {
      text.classList.add('err');
      text.textContent = `Could not load the city: ${e.message}. Playing the basic scene.`;
      await new Promise((r) => setTimeout(r, 2200));
    }
  }

  // ── settings ──
  for (const seg of $$('.seg')) {
    const key = seg.dataset.set;
    for (const b of seg.querySelectorAll('button')) b.onclick = () => {
      let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
      setSetting(key, v); Sfx.ui(); syncSettings();
      if (key === 'difficulty') { pickDiff = v; syncNew(); }
      if (key === 'camera') game.camMode = v;
    };
  }
  const bindVol = (id, key) => {
    const el = $(id), out = $(id + 'V');
    el.oninput = () => { setSetting(key, el.value / 100); out.textContent = el.value; };
    el.onchange = () => { Sfx.init(); if (key === 'sfx') Sfx.uiOk(); };
  };
  bindVol('#volMusic', 'music'); bindVol('#volSfx', 'sfx');
  let resetArm = 0;
  $('#btnReset').onclick = () => {
    if (Date.now() - resetArm < 3000) { resetScores(); $('#btnReset').textContent = 'DONE'; resetArm = 0; return; }
    resetArm = Date.now(); $('#btnReset').textContent = 'SURE? CLICK AGAIN';
    setTimeout(() => { $('#btnReset').textContent = 'RESET'; }, 3000);
  };
  function syncSettings() {
    for (const seg of $$('.seg')) for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(String(settings[seg.dataset.set]) === b.dataset.v));
    $('#volMusic').value = Math.round(settings.music * 100); $('#volMusicV').textContent = $('#volMusic').value;
    $('#volSfx').value = Math.round(settings.sfx * 100); $('#volSfxV').textContent = $('#volSfx').value;
    syncMute();
  }
  game.camMode = settings.camera;

  // ── scores ──
  function renderScores(el, cityId) {
    const list = loadScores(cityId).slice(0, 10);
    el.innerHTML = list.length
      ? list.map((s, i) => `<tr><td class="rk">${i + 1}</td><td>${esc(s.name)}<span class="d ${esc(s.diff || 'normal')}">${esc((s.diff || 'normal').toUpperCase())}</span></td><td>${s.floors} fl</td><td class="sc">${s.score}</td></tr>`).join('')
      : '<tr><td class="empty">No scores yet. Your first tower goes here.</td></tr>';
  }

  // ── help ──
  $('#helpBlocks').innerHTML = Object.values(BTYPES).filter((b) => b.hint).map((b) => `<li><span class="swatch" style="background:${hex(b.color)}"></span><b>${b.label.toUpperCase()}</b>${b.hint}</li>`).join('');
  $('#helpTypes').innerHTML = Object.values(BUILDING_TYPES).map((t) => `<li><b>${t.label.toUpperCase()}</b>${t.hint}</li>`).join('');
  $('#helpWeather').innerHTML = Object.values(WEATHER).map((p) => `<li>${WX_ICONS[p.name]}<b>${p.name.toUpperCase()}</b>${p.text}</li>`).join('') + '<li>Each city has its own weather by floor and its own events. A warning comes before every hit.</li>';

  // ── keyboard ──
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') { if (e.key === 'Escape') e.target.blur(); return; }
    Sfx.init();
    const scr = current();
    if (scr) {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (scr.id === 'sPause') { togglePause(); e.preventDefault(); return; }
        back(); e.preventDefault(); return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && e.target.type !== 'range') {
        const items = [...scr.querySelectorAll('button:not([disabled]), input')].filter((x) => x.offsetParent);
        const i = items.indexOf(document.activeElement);
        const d = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
        const nx = items[(i + d + items.length) % items.length]; if (nx) { nx.focus(); Sfx.ui(); }
        e.preventDefault(); return;
      }
      if (e.key === 'Enter' && scr.id === 'sTitle' && !scr.contains(document.activeElement)) { scr.querySelector('.mi').click(); return; }
      return;
    }
    if (game.state !== 'play') return;
    if (e.code === 'Space') { e.preventDefault(); game.drop(); }
    else if (e.code === 'KeyA') game.useAnchor();
    else if (e.key === 'Shift') game.keys.focus = true;
    else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    else if (e.code === 'KeyC') cycleCam();
    else if (e.code === 'KeyM') toggleMute();
  });
  window.addEventListener('keyup', (e) => { if (e.key === 'Shift') game.keys.focus = false; });
  window.addEventListener('pointerdown', () => Sfx.init(), { once: true });
  $('#c').addEventListener('pointerdown', () => { if (!current()) game.drop(); });
  $('#tFocus').addEventListener('pointerdown', (e) => { e.preventDefault(); game.keys.focus = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#tFocus').addEventListener(ev, () => { game.keys.focus = false; });
  $('#anchorBtn').onclick = () => game.useAnchor();

  // ── pause, mute, camera ──
  function togglePause() {
    if (game.state !== 'play') return;
    game.paused = !game.paused; game.keys.focus = false;
    if (game.paused) { stack = []; show('sPause'); } else { hideScreens(); stack = []; }
  }
  $('#btnPause').onclick = togglePause; $('#btnResume').onclick = togglePause;
  $('#btnRestart').onclick = () => { game.paused = false; restart(); };
  function syncMute() { $('#muteX').hidden = !settings.muted; $('#muteWave').hidden = settings.muted; $('#btnMute').setAttribute('aria-label', settings.muted ? 'Unmute sound' : 'Mute sound'); }
  function toggleMute() { setSetting('muted', !settings.muted); syncMute(); }
  function cycleCam() { game.camMode = (game.camMode + 1) % 3; setSetting('camera', game.camMode); }
  $('#btnMute').onclick = toggleMute; $('#btnCam').onclick = cycleCam;
  syncMute();

  function toMenu() {
    game.clear(); game.state = 'menu'; game.paused = false;
    $('#hud').hidden = true; $('#wxCard').hidden = true;
    stack = []; show('sTitle'); buildDemo(); People.setWalkers(9);
  }
  $('#btnQuit').onclick = () => { Sfx.uiBack(); toMenu(); };
  $('#btnMenu').onclick = () => { Sfx.uiBack(); toMenu(); };
  $('#btnAgain').onclick = restart;
  $('#btnPlotRetry').onclick = restart;
  $('#btnPlotMap').onclick = () => { Sfx.uiOk(); toMap(game.cityId); };

  // ── game over ──
  $('#saveForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (game.saved || !game.lastResult || game.levelDef) return;
    const r = game.lastResult;
    addScore(game.cityId, { name: ($('#name').value || 'PLAYER').toUpperCase().slice(0, 12), score: r.score, floors: r.floors, diff: r.diff, date: Date.now() });
    try { localStorage.setItem('tb3d_name', $('#name').value); } catch { /* storage blocked */ }
    game.saved = true; $('#btnSave').disabled = true; $('#btnSave').textContent = 'SAVED'; Sfx.uiOk();
    renderScores($('#overHs'), game.cityId);
  });

  // ── HUD ──
  const hudCache = {};
  const setText = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; document.getElementById(id).textContent = v; } };
  const setHTML = (id, v) => { if (hudCache['h' + id] !== v) { hudCache['h' + id] = v; document.getElementById(id).innerHTML = v; } };
  const stabFill = $('#stabBar i'), focusFill = $('#focusBar i');
  let wxTimer = 0, bannerText = '', bannerT = 0;

  const ui = {
    show, toMenu,
    showHud() { hideScreens(); $('#hud').hidden = false; const d = DIFFICULTY[game.diffKey]; $('#hDiff').textContent = d.label; $('#hDiff').className = 'tag ' + game.diffKey; },
    popup(text, color, small) {
      const el = document.createElement('div'); el.className = 'pop' + (small ? ' small' : ''); el.textContent = text; el.style.color = color;
      el.style.marginTop = `${$('#popups').childElementCount * 36}px`;
      $('#popups').appendChild(el); setTimeout(() => el.remove(), 1100);
    },
    banner(text, sec) { bannerText = text; bannerT = sec; },
    weather(ph) {
      $('#wxCardIcon').innerHTML = WX_ICONS[ph.name]; $('#wxCardName').textContent = ph.name.toUpperCase(); $('#wxCardText').textContent = settings.hints ? ph.text : '';
      const c = $('#wxCard'); c.hidden = true; void c.offsetWidth; c.hidden = false; wxTimer = 3.2;
    },
    bumpFloor() { const el = $('#floorBig'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); },
    // Result of a district plot: counted or not (and why), stars, residents, district progress, next city.
    plotDone(r, plot, city) {
      $('#hud').hidden = true;
      const q = plot.require || {}, p = r.plot, share = p.landings ? Math.round(100 * p.perfects / p.landings) : 0, why = [];
      if (!p.reached) why.push(`the tower did not reach ${plot.target} floors (best ${r.floors})`);
      if (p.reached && q.maxLivesLost != null && p.livesLost > q.maxLivesLost) why.push(`${p.livesLost} lives lost, the limit is ${q.maxLivesLost}`);
      if (p.reached && q.minPerfectShare != null && !(p.landings > 0 && p.perfects / p.landings >= q.minPerfectShare)) why.push(`${share} % perfect landings, ${Math.round(q.minPerfectShare * 100)} % needed`);
      $('#plotTitle').textContent = r.counts ? `${plot.name.toUpperCase()} BUILT` : `${plot.name.toUpperCase()} NOT COUNTED`;
      $('#plotCount').className = `verdict ${r.counts ? 'ok' : 'bad'}`;
      $('#plotCount').innerHTML = r.counts
        ? `<b>COUNTED</b> You met the requirement: ${esc(requirementText(plot))}.`
        : `<b>NOT COUNTED</b> ${esc(why.join('; '))}. Needed: ${esc(requirementText(plot))}.`;
      $('#plotStars').innerHTML = [1, 2, 3].map((i) => STAR(i <= r.stars)).join('');
      $('#plotStars').setAttribute('aria-label', `${r.stars} of 3 stars`);
      const bon = [r.bonuses.view ? 'VIEW +20 %' : '', r.bonuses.skyline ? 'SKYLINE +15 %' : ''].filter(Boolean).join(' · ');
      $('#plotStats').innerHTML = `<div><span class="lbl">HEIGHT</span><b>${r.floors} FL</b></div><div><span class="lbl">PERFECTS</span><b>${p.perfects}/${p.landings}</b></div><div><span class="lbl">LIVES LOST</span><b>${p.livesLost}</b></div>`
        + (r.counts ? `<div><span class="lbl">RESIDENTS</span><b>${r.residents}</b></div><div><span class="lbl">BONUS</span><b>${bon || 'NONE'}</b></div>` : `<div><span class="lbl">BEST HERE</span><b>${r.best} FL</b></div>`);
      const t = r.totals, pct = Math.min(100, Math.round(t.residents / t.goal * 100));
      $('#plotDistrict').innerHTML = `<div class="lbl">${esc(city.city.toUpperCase())} DISTRICT · RESIDENTS <b>${t.residents}</b> / ${t.goal}</div>`
        + `<div class="bar res" role="progressbar" aria-label="Residents towards the goal" aria-valuemin="0" aria-valuemax="${t.goal}" aria-valuenow="${t.residents}"><i style="width:${pct}%"></i></div>`
        + `<div class="lbl">${t.counted} / ${t.plots} PLOTS BUILT · ${t.stars} / ${t.maxStars} STARS</div>`
        + (r.goalReached ? `<div class="verdict ok"><b>${r.goalNew ? 'GOAL REACHED' : 'GOAL REACHED EARLIER'}</b> ${r.nextCity ? `Next city opened: ${esc(r.nextCity.city)}.` : city.fictional ? 'The whole district is built.' : 'Next city opened.'}</div>` : '');
      stack = []; show('sPlot');
    },
    gameOver(r, record) {
      $('#hud').hidden = true;
      const lv = !!game.levelDef;   // a failed level run: result screen, no high-score form
      $('#overTitle').textContent = lv ? `${game.levelDef.city.toUpperCase()} FAILED` : 'GAME OVER';
      $('#newRecord').hidden = lv || !record;
      $('#saveForm').hidden = lv; $('#overHs').hidden = lv;
      $('#btnAgain').textContent = lv ? 'RETRY' : 'PLAY AGAIN';
      $('#overStats').innerHTML = lv
        ? `<div><span class="lbl">HEIGHT</span><b>${r.floors} FL</b></div><div><span class="lbl">STARS</span><b>0 / 3</b></div>`
        : `<div><span class="lbl">SCORE</span><b>${r.score}</b></div><div><span class="lbl">HEIGHT</span><b>${r.floors} FL</b></div><div><span class="lbl">RESIDENTS</span><b>${r.pop}</b></div>`;
      $('#btnSave').disabled = false; $('#btnSave').textContent = 'SAVE';
      try { $('#name').value = localStorage.getItem('tb3d_name') || 'PLAYER'; } catch { /* storage blocked */ }
      if (!lv) renderScores($('#overHs'), game.cityId);
      stack = []; show('sOver');
      if (record) Sfx.fanfare();
    },
    update(rdt, camAz) {
      if (wxTimer > 0) { wxTimer -= rdt; if (wxTimer <= 0) $('#wxCard').hidden = true; }
      if (bannerT > 0) { bannerT -= rdt; setText('banner', bannerText); } else setText('banner', '');
      if ($('#hud').hidden) return;
      const T = game.tower, n = T ? T.n : 0, ph = game.weather, w = game.wind;
      setText('hTarget', game.levelDef ? `TARGET ${n} / ${game.levelDef.target}` : '');
      const pd = game.plotDef, rr = game.run;
      setText('hReq', !pd ? '' : [pd.require.maxLivesLost != null ? `LOSE AT MOST ${pd.require.maxLivesLost}: LOST ${rr.diff.lives - rr.lives}` : '',
        pd.require.minPerfectShare != null ? `${Math.round(pd.require.minPerfectShare * 100)} % PERFECT: ${rr.landings ? Math.round(100 * rr.perfects / rr.landings) : 0} %` : ''].filter(Boolean).join(' · ') || 'NO EXTRA REQUIREMENT');
      $('#hReq').classList.toggle('bad', !!pd && ((pd.require.maxLivesLost != null && rr.diff.lives - rr.lives > pd.require.maxLivesLost) || (pd.require.minPerfectShare != null && rr.landings >= 4 && rr.perfects / rr.landings < pd.require.minPerfectShare)));
      setText('hScore', String(game.score));
      setText('hPop', String(game.pop));
      setText('floorBig', String(n));
      setText('hMeters', `${Math.round(n * CFG.METERS_PER_FLOOR)} M`);
      const pipsOn = game.goldenNext ? 5 : game.combo % CFG.goldenEvery;
      setHTML('pips', Array.from({ length: 5 }, (_, i) => `<i class="${i < pipsOn ? 'on' : ''}"></i>`).join(''));
      $('#pips').classList.toggle('gold', !!game.goldenNext);
      setText('hCombo', game.combo > 0 ? `COMBO ×${Math.min(5, 1 + 0.5 * game.combo)}` : game.goldenNext ? 'GOLDEN NEXT' : '');
      setHTML('hLives', Array.from({ length: game.diff.lives }, (_, i) => HEART(i < game.lives)).join(''));
      setText('hWind', `${w.speed.toFixed(1)} m/s`);
      setText('hTrend', w.trend > 0.08 ? 'GUSTING ▲' : w.trend < -0.08 ? 'EASING ▼' : 'STEADY');
      $('#arrow').setAttribute('transform', `rotate(${((w.angle - camAz + Math.PI / 2) * 180 / Math.PI).toFixed(1)})`);
      setText('hWeather', ph.name);
      setHTML('wxIcon', WX_ICONS[ph.name]);
      const nx = game.run ? game.run.nextWeather() : null;
      setText('hNextWeather', nx ? `${nx.wx.name.toUpperCase()} IN ${nx.left} FL` : '');
      const stab = T ? Math.max(0, Math.min(1, 1 - T.dyn.r)) : 1;
      stabFill.style.width = `${(stab * 100).toFixed(0)}%`;
      stabFill.style.background = stab > 0.6 ? 'var(--ok)' : stab > 0.3 ? 'var(--warn)' : 'var(--bad)';
      $('#stabBar').classList.toggle('danger', stab < 0.3);
      focusFill.style.width = `${(game.focus * 100).toFixed(0)}%`;
      $('#focusBar').classList.toggle('active', game.focusActive());
      setText('hAnchor', T && T.anchor > 0 ? `${T.anchor.toFixed(1)}s` : String(game.anchors));
      $('#anchorBtn').disabled = !(game.anchors > 0) || !!(T && T.anchor > 0);
      const nt = BTYPES[game.goldenNext ? 'golden' : specialFor(n + (game.block ? 2 : 1))];
      setHTML('hNext', `<span class="swatch" style="background:${hex(nt.color)}"></span><span class="mid">${nt.label}</span>`);
      const cb = game.block ? BTYPES[game.block.type] : null;
      const bty = game.run && BUILDING_TYPES[game.run.buildingType];
      setText('hType', bty ? bty.label.toUpperCase() : '');
      $('#hType').title = bty ? bty.hint : '';
      setText('nextHint', !settings.hints ? '' : cb && cb.hint ? `NOW: ${cb.hint}` : nt.hint ? `NEXT: ${nt.hint}` : bty && game.drops < 6 ? `${bty.label.toUpperCase()}: ${bty.hint}` : '');
      $('#hint').hidden = !(settings.hints && game.state === 'play' && game.drops < 3 && game.block && game.block.state === 'hang');
    },
  };
  show('sTitle');
  return ui;
}
