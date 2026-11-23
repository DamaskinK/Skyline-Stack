// Menus, settings, scores and the in-game HUD. Screens are <section class="screen"> elements shown one at a time.
import { BUILDING_TYPES, buildingTypeById } from './building-types.js';
import { CFG, DIFFICULTY, BTYPES, WEATHER, specialFor } from './config.js';
import { NAME_KEY, settings, setSetting, loadScores, addScore, resetScores, loadProgress, loadLastCity, saveLastCity } from './settings.js';
import { levelById, cityById, DISTRICT_CITIES, LEVELS } from './levels.js';
import { landmarkSpots } from './level-scene.js';
import { introKeys, introDuration } from './core/intro-path.js';
import { showDistrictTowers, clearDistrictTowers } from './district-towers.js';
import { loadDistrictProgress } from './settings.js';
import { cityProgress } from './core/district-progress.js';
import { requirementText } from './district-map.js';
import { createDistrictMap } from './district-map.js';
import { Sfx } from './audio.js';
import { S, UI, applyStrings } from './strings.js';
import { People } from './fx.js';
import { buildDemo, clearDemo } from './game.js';
import type { Game, GameUi, GameMode } from './game.js';
import type { AssetError } from './assets.js';
import type { Run } from './core/run.js';
import type { Level, DifficultyId, District, Plot, Settings } from './types.js';

// The page (index.html) always has the elements the code asks for, so a missing one is a bug and fails loudly later.
const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string): T[] => [...document.querySelectorAll<T>(s)];
const esc = (s: unknown): string => String(s).replace(/[<>&"]/g, '');

export const WX_ICONS: Record<string, string> = {
  Clear: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7" fill="#ffd34d" stroke="#000" stroke-width="2"/><g stroke="#ffd34d" stroke-width="3"><path d="M16 2v5M16 25v5M2 16h5M25 16h5M6 6l3 3M23 23l3 3M26 6l-3 3M6 26l3-3"/></g></svg>',
  Rain: '<svg viewBox="0 0 32 32"><path d="M8 18a6 6 0 0 1 1-12 8 8 0 0 1 15 3 5 5 0 0 1 0 9z" fill="#c8d2e2" stroke="#000" stroke-width="2"/><path d="M10 22l-2 6M16 22l-2 6M22 22l-2 6" stroke="#52d9ff" stroke-width="2.5"/></svg>',
  Snow: '<svg viewBox="0 0 32 32"><path d="M8 18a6 6 0 0 1 1-12 8 8 0 0 1 15 3 5 5 0 0 1 0 9z" fill="#eef3fa" stroke="#000" stroke-width="2"/><g fill="#fff" stroke="#000"><circle cx="10" cy="25" r="2"/><circle cx="17" cy="27" r="2"/><circle cx="23" cy="24" r="2"/></g></svg>',
  Storm: '<svg viewBox="0 0 32 32"><path d="M8 17a6 6 0 0 1 1-12 8 8 0 0 1 15 3 5 5 0 0 1 0 9z" fill="#5a6378" stroke="#000" stroke-width="2"/><path d="M17 15l-5 8h5l-3 7 8-10h-5l3-5z" fill="#ffd34d" stroke="#000" stroke-width="1.5"/></svg>',
  'Heat haze': '<svg viewBox="0 0 32 32"><circle cx="16" cy="12" r="6" fill="#ffd34d" stroke="#000" stroke-width="2"/><g stroke="#ff9a4d" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M3 22q3-3 6 0t6 0 6 0 6 0M3 28q3-3 6 0t6 0 6 0 6 0"/></g></svg>',
  Sandstorm: '<svg viewBox="0 0 32 32"><g stroke="#d8a468" stroke-width="3" stroke-linecap="round" fill="none"><path d="M4 10h16a3 3 0 1 0-3-3M4 17h22a3 3 0 1 1-3 3M4 24h12"/></g></svg>',
  Typhoon: '<svg viewBox="0 0 32 32"><path d="M8 17a6 6 0 0 1 1-12 8 8 0 0 1 15 3 5 5 0 0 1 0 9z" fill="#3a4258" stroke="#000" stroke-width="2"/><path d="M10 21l-3 8M16 21l-3 8M22 21l-3 8" stroke="#52d9ff" stroke-width="3"/></svg>',
  Fog: '<svg viewBox="0 0 32 32"><g stroke="#f2c0a0" stroke-width="3" stroke-linecap="round"><path d="M4 10h20M8 16h20M4 22h18M10 28h14"/></g></svg>',
};
const HEART = (on: boolean): string => `<svg viewBox="0 0 24 22" class="${on ? '' : 'off'}"><path d="M12 21 L3 12 A5 5 0 0 1 12 5 A5 5 0 0 1 21 12 Z" fill="#ff4d5e" stroke="#000" stroke-width="2"/></svg>`;
const STAR = (on: boolean): string => `<svg viewBox="0 0 24 24" class="${on ? '' : 'off'}"><path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.6 5.8 21.2l1.4-7L2 9.4l7-.9z" fill="#ffd34d" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

export function createUI(game: Game): GameUi {
  applyStrings();
  // ── screen stack ──
  let stack: string[] = [];
  const screens = $$('.screen');
  function show(id: string, push = true): void {
    for (const s of screens) s.hidden = s.id !== id;
    if (push) stack.push(id);
    const s = $('#' + id);
    s.style.animation = 'none'; void s.offsetWidth; s.style.animation = '';
    if (id === 'sScores') renderScores($('#hsTable'), 'kosice');
    if (id === 'sTitle') renderTitleBest();
    if (id === 'sNew') renderModes();
    if (id === 'sSettings') syncSettings();
    setTimeout(() => ((s.querySelector('[aria-pressed="true"].card-opt, .mi, .btn, button') as HTMLElement | null) || s).focus({ preventScroll: true }), 30);
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
  [...'SKYLINE'].forEach((ch, i) => { const d = document.createElement('div'); d.className = 'lt'; d.textContent = ch; d.style.background = tileCols[i % 5]; d.style.animationDelay = `${i * 0.07}s, ${i * 0.15}s`; $('#logoTop').appendChild(d); });
  [...'STACK'].forEach((ch, i) => { const d = document.createElement('div'); d.className = 'lt'; d.textContent = ch; d.style.background = tileCols[(i + 2) % 5]; d.style.animationDelay = `${0.5 + i * 0.07}s, ${0.8 + i * 0.15}s`; $('#logoBot').appendChild(d); });
  function renderTitleBest() {
    const e = loadScores('kosice')[0];
    $('#titleBest').innerHTML = e ? S.bestTower(e.score, e.floors ?? 0) : S.noRecords;
  }

  // ── navigation ──
  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    const go = target.closest<HTMLElement>('[data-go]'); if (go) { Sfx.init(); Sfx.uiOk(); show(go.dataset.go as string); return; }
    if (target.closest('[data-back]')) back();
  });
  for (const b of $$('.mi, .card-opt, .seg button, .tabs button')) b.addEventListener('pointerenter', () => { if (document.activeElement !== b) { b.focus({ preventScroll: true }); Sfx.ui(); } });

  // ── new game ──
  let pickDiff = settings.difficulty, pickMode: GameMode = 'endless', pickCity = 'kosice';
  const dc = $('#diffCards');
  for (const [k, d] of Object.entries(DIFFICULTY)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `card-opt d-${k}`; b.dataset.diff = k;
    const m = d.meters, bar = (v: number): string => `<span class="meter"><i style="width:${v * 100}%"></i></span>`;
    b.innerHTML = `<b>${d.label}</b><span>${d.desc}</span><span class="meters"><span>${S.meterLbl.crane}</span>${bar(m.crane)}<span>${S.meterLbl.wind}</span>${bar(m.wind)}<span>${S.meterLbl.precision}</span>${bar(m.precision)}<span>${S.meterLbl.lives}</span><span>${'♥'.repeat(d.lives)}</span></span>`;
    b.onclick = () => { pickDiff = k as DifficultyId; Sfx.ui(); syncNew(); };
    dc.appendChild(b);
  }
  function syncNew() {
    for (const b of $$('[data-diff]')) b.setAttribute('aria-pressed', String(b.dataset.diff === pickDiff));
    for (const b of $$('[data-endless]')) b.setAttribute('aria-pressed', String(b.dataset.endless === pickCity));
    $('#modeNote').textContent = S.endlessNote(pickCity === 'newtown');
  }
  syncNew();
  // Mode cards: Kosice level (with its best stars) and Endless. The world map (ticket 20) will replace this.
  function renderModes() {
    $('#modeCards').innerHTML =
      `<button type="button" class="card-opt" data-mode="endless" data-endless="kosice"><b>${S.endlessKosice[0]}</b><span class="sub">${S.endlessKosice[1]}</span></button>`
      + `<button type="button" class="card-opt" data-mode="endless" data-endless="newtown"><b>${S.endlessNewtown[0]}</b><span class="sub">${S.endlessNewtown[1]}</span></button>`;
    for (const b of $$('[data-endless]')) b.onclick = () => { pickMode = 'endless'; pickCity = b.dataset.endless as string; Sfx.ui(); syncNew(); };
    syncNew();
    $('#districtCards').innerHTML = DISTRICT_CITIES.filter((c) => c.built).map((c) =>
      `<button type="button" class="card-opt" data-district="${c.id}"><b>${c.city}</b><span class="sub">${S.districtCard(!!c.fictional, c.country, (c.district as District).goal)}</span></button>`).join('');
    // a city that the goal of the one before opened, but that is not built yet (shown, not playable)
    const opened = loadDistrictProgress().cities;
    $('#districtCards').innerHTML += LEVELS.filter((c) => !c.built && opened[c.id]?.opened).map((c) =>
      `<button type="button" class="card-opt" disabled><b>${c.city}</b><span class="sub">${S.districtClosed(c.country)}</span></button>`).join('');
    for (const b of $$('[data-district]')) b.onclick = () => { Sfx.init(); Sfx.uiOk(); districtMap.render(b.dataset.district); show('sMap'); };
  }
  // District map (S0002 05). Play loads the scene of the plot and runs it with the plot's rules.
  const districtMap = createDistrictMap({
    onPlay: (cityId, plotId) => startGame('plot', pickDiff, cityId, plotId),
    onBack: back,
  });
  // Back to the district map after a plot: the finished towers stand on their sites, the next open plot is selected.
  function toMap(cityId: string) {
    const plotId = game.plotId;
    game.clear(); game.state = 'menu'; game.paused = false;
    $('#hud').hidden = true; $('#wxCard').hidden = true;
    const info = districtMap.render(cityId, { focusNext: true });
    const plots = cityProgress(loadDistrictProgress(), cityId).plots;
    const shown = plotId ? showDistrictTowers(cityId, plotId, plots, { withCurrent: true }) : null;
    if (!shown || !plots[plotId as string] || !plots[plotId as string].counted) buildDemo();
    People.setWalkers(9);
    stack = ['sTitle', 'sNew']; show('sMap');
    return info;
  }
  $('#btnStart').onclick = () => startGame(pickMode, pickDiff, pickCity);
  let starting = false;
  // ── menu scene and transitions ──
  // The veil is a black layer between the 3D scene and the screens: a scene swap happens while it is opaque.
  const $veil = $('#veil'), $menuLoad = $('#menuLoad');
  const veilOn = (): Promise<void> => { $veil.classList.add('on'); return new Promise((r) => setTimeout(r, 300)); };
  const veilOff = (): void => { $veil.classList.remove('on'); };
  // The main menu flies over the real scene of the last played city (first city: Kosice), on its centre (last) plot.
  let menuLoading: Promise<void> = Promise.resolve();
  function menuTarget(): { city: Level; pid: string } {
    const last = loadLastCity(), city = DISTRICT_CITIES.find((c) => c.id === last && c.built) || DISTRICT_CITIES.find((c) => c.built) as Level;
    const plots = (city.district as District).plots;
    return { city, pid: plots[plots.length - 1].id };
  }
  function loadMenuScene(): Promise<void> {
    const { city, pid } = menuTarget();
    buildDemo(city.id);
    if (game.levelId === city.id && game.loadedPlotId === pid) { showDistrictTowers(city.id, pid, cityProgress(loadDistrictProgress(), city.id).plots); return menuLoading; }
    menuLoading = menuLoading.then(async () => {
      $menuLoad.textContent = S.menuLoading(city.city); $menuLoad.hidden = false;
      let swapped = false;
      try {
        await game.loadPlot(city.id, pid, undefined, async () => { if (game.state === 'menu' && !starting) { swapped = true; await veilOn(); } });
      } catch (e) { console.warn('menu scene', e); }   // the procedural demo stays
      $menuLoad.hidden = true;
      if (swapped) { buildDemo(city.id); People.setWalkers(9); veilOff(); }
    });
    return menuLoading;
  }
  // The camera pass before a plot: place card over a fly-by of the landmarks in view; Space, Enter, Esc or a click skips it.
  function runIntro(cityId: string, plot: Plot): Promise<void> {
    const city = cityById(cityId) as Level, plots = (city.district as District).plots;
    $('#introKicker').textContent = S.introPlot(city.fictional ? S.madeUpCity : city.country, plots.indexOf(plot) + 1, plots.length);
    $('#introCity').textContent = city.city; $('#introPlot').textContent = plot.name;
    const spots = landmarkSpots(plot.landmarksInView), c = (game.camera as THREE.PerspectiveCamera).position;
    const keys = introKeys({ p: [c.x, c.y, c.z], l: [0, 15, 0] }, spots, { p: [30, 42, 44], l: [0, 2, 0] });
    return new Promise((resolve) => {
      const done = (): void => { if (!game.intro) return; game.intro = null; resolve(); };
      game.intro = { t: 0, dur: introDuration(spots.length), keys, done };
      $('#sIntro').onclick = done;
      stack = []; show('sIntro', false);
    });
  }
  // plot mode: a district plot of `level` (a city id). Endless and the other modes run on the city centre plot (Kosice: the cathedral).
  async function startGame(mode: GameMode, diff: DifficultyId, level = 'kosice', plotId: string | null = null): Promise<void> {
    if (starting) return; starting = true;
    Sfx.init(); Sfx.uiOk(); stack = [];
    await menuLoading;
    const plots = (DISTRICT_CITIES.find((c) => c.id === level) || {}).district?.plots;
    const pid = plotId || (plots ? plots[plots.length - 1].id : null);
    await veilOn();
    if (pid && (game.levelId !== level || game.loadedPlotId !== pid || mode === 'plot')) await loadPlot(level, pid);
    else if (!pid && game.levelId !== level) await loadLevel(level);
    // the plot being played stands on its own site: the district towers around it are rebuilt without it (the map showed it too)
    if (pid) showDistrictTowers(level, pid, cityProgress(loadDistrictProgress(), level).plots); else clearDistrictTowers();
    clearDemo(); saveLastCity(level);
    if (mode === 'plot') { hideScreens(); await new Promise((r) => requestAnimationFrame(r)); veilOff(); await runIntro(level, (plots as Plot[]).find((p) => p.id === pid) as Plot); }
    else veilOff();
    hideScreens();
    if (mode === 'plot') game.startPlot(level, pid as string, diff); else game.start(mode, diff, level);
    starting = false;
  }
  const restart = () => (game.mode === 'plot' ? startGame('plot', game.diffKey, game.cityId ?? undefined, game.plotId) : startGame(game.mode, game.diffKey, game.cityId ?? undefined));
  // Loading screen with progress. A failed asset is named on screen and the game goes on with what it has.
  const loadLevel = (level: string) => loadWith((setP) => game.loadLevel(level, setP));
  const loadPlot = (level: string, pid: string) => loadWith((setP) => game.loadPlot(level, pid, setP));
  async function loadWith(load: (setP: (p: number) => void) => Promise<AssetError[]>): Promise<void> {
    const bar = $('#loadBar'), fill = bar.querySelector('i') as HTMLElement, text = $('#loadText');
    const setP = (p: number): void => { fill.style.width = `${(p * 100).toFixed(0)}%`; bar.setAttribute('aria-valuenow', String(Math.round(p * 100))); };
    setP(0); text.classList.remove('err'); text.textContent = S.fetching;
    show('sLoading', false);
    try {
      const errors = await load(setP);
      if (errors.length) {
        text.classList.add('err');
        text.textContent = S.filesFailed(errors.map((e: AssetError) => e.url.split('/').pop()).join(', '));
        await new Promise((r) => setTimeout(r, 1800));
      }
    } catch (e) {
      text.classList.add('err');
      text.textContent = S.loadFailed(e instanceof Error ? e.message : String(e));
      await new Promise((r) => setTimeout(r, 2200));
    }
  }

  // ── settings ──
  for (const seg of $$('.seg')) {
    const key = seg.dataset.set as keyof Settings;
    for (const b of seg.querySelectorAll('button')) b.onclick = () => {
      let v: string | number | boolean = b.dataset.v as string; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
      setSetting(key, v as never); Sfx.ui();   // the buttons of a segment carry valid values for its own setting
      syncSettings();
      if (key === 'difficulty') { pickDiff = v as DifficultyId; syncNew(); }
      if (key === 'camera') game.camMode = v as number;
    };
  }
  const bindVol = (id: string, key: 'music' | 'sfx'): void => {
    const el = $<HTMLInputElement>(id), out = $(id + 'V');
    el.oninput = () => { setSetting(key, Number(el.value) / 100); out.textContent = el.value; };
    el.onchange = () => { Sfx.init(); if (key === 'sfx') Sfx.uiOk(); };
  };
  bindVol('#volMusic', 'music'); bindVol('#volSfx', 'sfx');
  let resetArm = 0;
  $('#btnReset').onclick = () => {
    if (Date.now() - resetArm < 3000) { resetScores(); $('#btnReset').textContent = S.resetDone; resetArm = 0; return; }
    resetArm = Date.now(); $('#btnReset').textContent = S.resetConfirm;
    setTimeout(() => { $('#btnReset').textContent = UI['set.reset']; }, 3000);
  };
  function syncSettings() {
    for (const seg of $$('.seg')) for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(String(settings[seg.dataset.set as keyof Settings]) === b.dataset.v));
    const volMusic = $<HTMLInputElement>('#volMusic'), volSfx = $<HTMLInputElement>('#volSfx');
    volMusic.value = String(Math.round(settings.music * 100)); $('#volMusicV').textContent = volMusic.value;
    volSfx.value = String(Math.round(settings.sfx * 100)); $('#volSfxV').textContent = volSfx.value;
    syncMute();
  }
  game.camMode = settings.camera;

  // ── scores ──
  function renderScores(el: HTMLElement, cityId: string): void {
    const list = loadScores(cityId).slice(0, 10);
    el.innerHTML = list.length
      ? list.map((s, i) => `<tr><td class="rk">${i + 1}</td><td>${esc(s.name)}<span class="d ${esc(s.diff || 'normal')}">${esc(UI['diff.' + (s.diff || 'normal')] || s.diff)}</span></td><td>${S.floorsShort(s.floors ?? 0)}</td><td class="sc">${s.score}</td></tr>`).join('')
      : `<tr><td class="empty">${S.noScores}</td></tr>`;
  }

  // ── help ──
  $('#helpBlocks').innerHTML = Object.values(BTYPES).filter((b) => b.hint).map((b) => `<li><span class="swatch" style="background:${hex(b.color)}"></span><b>${b.label}</b>${b.hint}</li>`).join('');
  $('#helpTypes').innerHTML = Object.values(BUILDING_TYPES).map((t) => `<li><b>${t.label}</b>${t.hint}</li>`).join('');
  $('#helpWeather').innerHTML = Object.values(WEATHER).map((p) => `<li>${WX_ICONS[p.name]}<b>${p.name}</b>${p.text}</li>`).join('') + `<li>${UI['help.weatherNote']}</li>`;

  // ── keyboard ──
  window.addEventListener('keydown', (e) => {
    const tgt = e.target as HTMLInputElement;
    if (tgt.tagName === 'INPUT' && tgt.type === 'text') { if (e.key === 'Escape') tgt.blur(); return; }
    Sfx.init();
    const scr = current();
    if (scr) {
      if (scr.id === 'sIntro') { if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); game.intro?.done(); } return; }
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (scr.id === 'sPause') { togglePause(); e.preventDefault(); return; }
        back(); e.preventDefault(); return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && tgt.type !== 'range') {
        const items = [...scr.querySelectorAll<HTMLElement>('button:not([disabled]), input')].filter((x) => x.offsetParent);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const d = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
        const nx = items[(i + d + items.length) % items.length]; if (nx) { nx.focus(); Sfx.ui(); }
        e.preventDefault(); return;
      }
      if (e.key === 'Enter' && scr.id === 'sTitle' && !scr.contains(document.activeElement)) { (scr.querySelector('.mi') as HTMLElement).click(); return; }
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
  function syncMute() { $('#muteX').hidden = !settings.muted; $('#muteWave').hidden = settings.muted; $('#btnMute').setAttribute('aria-label', settings.muted ? S.muteOff : S.muteOn); }
  function toggleMute() { setSetting('muted', !settings.muted); syncMute(); }
  function cycleCam() { game.camMode = (game.camMode + 1) % 3; setSetting('camera', game.camMode); }
  $('#btnMute').onclick = toggleMute; $('#btnCam').onclick = cycleCam;
  syncMute();

  function toMenu() {
    game.clear(); game.state = 'menu'; game.paused = false;
    $('#hud').hidden = true; $('#wxCard').hidden = true;
    clearDistrictTowers();                    // the menu tower stands at the origin: no finished tower on that spot (loadMenuScene shows the others)
    stack = []; show('sTitle'); People.setWalkers(9); void loadMenuScene();
  }
  $('#btnQuit').onclick = () => { Sfx.uiBack(); toMenu(); };
  $('#btnMenu').onclick = () => { Sfx.uiBack(); toMenu(); };
  $('#btnAgain').onclick = restart;
  $('#btnPlotRetry').onclick = restart;
  $('#btnPlotMap').onclick = () => { Sfx.uiOk(); toMap(game.cityId as string); };

  // ── game over ──
  $('#saveForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (game.saved || !game.lastResult || game.levelDef) return;
    const r = game.lastResult;
    addScore(game.cityId as string, { name: ($<HTMLInputElement>('#name').value || S.defaultName).slice(0, 12), score: r.score, floors: r.floors, diff: r.diff, date: Date.now() });
    try { localStorage.setItem(NAME_KEY, $<HTMLInputElement>('#name').value); } catch { /* storage blocked */ }
    game.saved = true; $<HTMLButtonElement>('#btnSave').disabled = true; $('#btnSave').textContent = S.saved; Sfx.uiOk();
    renderScores($('#overHs'), game.cityId as string);
  });

  // ── HUD ──
  const hudCache: Record<string, string> = {};
  const setText = (id: string, v: string): void => { if (hudCache[id] !== v) { hudCache[id] = v; (document.getElementById(id) as HTMLElement).textContent = v; } };
  const setHTML = (id: string, v: string): void => { if (hudCache['h' + id] !== v) { hudCache['h' + id] = v; (document.getElementById(id) as HTMLElement).innerHTML = v; } };
  const stabFill = $('#stabBar i'), focusFill = $('#focusBar i');
  let wxTimer = 0, bannerText = '', bannerT = 0;

  const ui: GameUi = {
    show, toMenu,
    showHud() { hideScreens(); $('#hud').hidden = false; const d = DIFFICULTY[game.diffKey]; $('#hDiff').textContent = d.label; $('#hDiff').className = 'tag ' + game.diffKey; },
    popup(text, color, small) {
      const el = document.createElement('div'); el.className = 'pop' + (small ? ' small' : ''); el.textContent = text; el.style.color = color;
      el.style.marginTop = `${$('#popups').childElementCount * 36}px`;
      $('#popups').appendChild(el); setTimeout(() => el.remove(), 1100);
    },
    banner(text, sec) { bannerText = text; bannerT = sec; },
    weather(ph) {
      $('#wxCardIcon').innerHTML = WX_ICONS[ph.name]; $('#wxCardName').textContent = ph.name; $('#wxCardText').textContent = settings.hints ? ph.text : '';
      const c = $('#wxCard'); c.hidden = true; void c.offsetWidth; c.hidden = false; wxTimer = 3.2;
    },
    bumpFloor() { const el = $('#floorBig'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); },
    // Result of a district plot: counted or not (and why), stars, residents, district progress, next city.
    plotDone(r, plot, city) {
      $('#hud').hidden = true;
      const q = plot.require || {}, p = r.plot, share = p.landings ? Math.round(100 * p.perfects / p.landings) : 0, why = [];
      if (!p.reached) why.push(S.whyShort(plot.target, r.floors));
      if (p.reached && q.maxLivesLost != null && p.livesLost > q.maxLivesLost) why.push(S.whyLives(p.livesLost, q.maxLivesLost));
      if (p.reached && q.minPerfectShare != null && !(p.landings > 0 && p.perfects / p.landings >= q.minPerfectShare)) why.push(S.whyPerfect(share, Math.round(q.minPerfectShare * 100)));
      $('#plotTitle').textContent = r.counts ? S.plotBuilt(plot.name) : S.plotNotCounted(plot.name);
      $('#plotCount').className = `verdict ${r.counts ? 'ok' : 'bad'}`;
      $('#plotCount').innerHTML = r.counts
        ? `<b>${S.counted}</b> ${esc(S.metRequirement(requirementText(plot)))}`
        : `<b>${S.notCounted}</b> ${esc(S.neededRequirement(why.join('; '), requirementText(plot)))}`;
      $('#plotStars').innerHTML = [1, 2, 3].map((i) => STAR(i <= r.stars)).join('');
      $('#plotStars').setAttribute('aria-label', S.starsOf(r.stars));
      const bon = [r.bonuses.view ? S.bonusView : '', r.bonuses.skyline ? S.bonusSkyline : ''].filter(Boolean).join(' · ');
      const st = (label: string, v: string): string => `<div><span class="lbl">${label}</span><b>${v}</b></div>`;
      $('#plotStats').innerHTML = st(S.stat.height, S.floorsShort(r.floors)) + st(S.stat.perfects, `${p.perfects}/${p.landings}`) + st(S.stat.livesLost, String(p.livesLost))
        + (r.counts ? st(S.stat.residents, String(r.residents)) + st(S.stat.bonus, bon || S.none) : st(S.stat.bestHere, S.floorsShort(r.best)));
      const t = r.totals, pct = Math.min(100, Math.round(t.residents / t.goal * 100));
      $('#plotDistrict').innerHTML = `<div class="lbl">${S.districtLine(esc(city.city), t.residents, t.goal)}</div>`
        + `<div class="bar res" role="progressbar" aria-label="${S.residentsProgress}" aria-valuemin="0" aria-valuemax="${t.goal}" aria-valuenow="${t.residents}"><i style="width:${pct}%"></i></div>`
        + `<div class="lbl">${S.plotsBuilt(t.counted, t.plots, t.stars, t.maxStars)}</div>`
        + (r.goalReached ? `<div class="verdict ok"><b>${r.goalNew ? S.goalReached : S.goalReachedEarlier}</b> ${r.nextCity ? S.nextCityOpened(esc(r.nextCity.city)) : city.fictional ? S.noNextCity : S.nextCityOpenedPlain}</div>` : '');
      stack = []; show('sPlot');
    },
    gameOver(r, record) {
      $('#hud').hidden = true;
      const lv = !!game.levelDef;   // a failed level run: result screen, no high-score form
      $('#overTitle').textContent = lv ? S.levelFailed((game.levelDef as Level).city) : S.gameOver;
      $('#newRecord').hidden = lv || !record;
      $('#saveForm').hidden = lv; $('#overHs').hidden = lv;
      $('#btnAgain').textContent = lv ? S.retry : S.playAgain;
      const st = (label: string, v: string): string => `<div><span class="lbl">${label}</span><b>${v}</b></div>`;
      $('#overStats').innerHTML = lv ? st(S.stat.height, S.floorsShort(r.floors)) + st(S.stat.stars, '0 / 3')
        : st(S.stat.score, String(r.score)) + st(S.stat.height, S.floorsShort(r.floors)) + st(S.stat.residents, String(r.pop));
      $<HTMLButtonElement>('#btnSave').disabled = false; $('#btnSave').textContent = UI['over.save'];
      try { $<HTMLInputElement>('#name').value = localStorage.getItem(NAME_KEY) || S.defaultName; } catch { /* storage blocked */ }
      if (!lv) renderScores($('#overHs'), game.cityId as string);
      stack = []; show('sOver');
      if (record) Sfx.fanfare();
    },
    update(rdt, camAz) {
      if (wxTimer > 0) { wxTimer -= rdt; if (wxTimer <= 0) $('#wxCard').hidden = true; }
      if (bannerT > 0) { bannerT -= rdt; setText('banner', bannerText); } else setText('banner', '');
      if ($('#hud').hidden) return;
      const T = game.tower, n = T ? T.n : 0, ph = game.weather, w = game.wind;
      setText('hTarget', game.levelDef ? S.hudTarget(n, game.levelDef.target) : '');
      const pd = game.plotDef, rr = game.run as Run;   // a plot run always has its run
      setText('hReq', !pd ? '' : [pd.require.maxLivesLost != null ? S.hudLivesMax(pd.require.maxLivesLost, rr.diff.lives - rr.lives) : '',
        pd.require.minPerfectShare != null ? S.hudPerfect(Math.round(pd.require.minPerfectShare * 100), rr.landings ? Math.round(100 * rr.perfects / rr.landings) : 0) : ''].filter(Boolean).join(' · ') || S.hudNoReq);
      $('#hReq').classList.toggle('bad', !!pd && ((pd.require.maxLivesLost != null && rr.diff.lives - rr.lives > pd.require.maxLivesLost) || (pd.require.minPerfectShare != null && rr.landings >= 4 && rr.perfects / rr.landings < pd.require.minPerfectShare)));
      setText('hScore', String(game.score));
      setText('hPop', String(game.pop));
      setText('floorBig', String(n));
      setText('hMeters', S.meters(Math.round(n * CFG.METERS_PER_FLOOR)));
      const pipsOn = game.goldenNext ? 5 : game.combo % CFG.goldenEvery;
      setHTML('pips', Array.from({ length: 5 }, (_, i) => `<i class="${i < pipsOn ? 'on' : ''}"></i>`).join(''));
      $('#pips').classList.toggle('gold', !!game.goldenNext);
      setText('hCombo', game.combo > 0 ? S.combo(Math.min(5, 1 + 0.5 * game.combo)) : game.goldenNext ? S.goldenNext : '');
      setHTML('hLives', Array.from({ length: game.diff.lives }, (_, i) => HEART(i < game.lives)).join(''));
      setText('hWind', `${w.speed.toFixed(1)} m/s`);
      setText('hTrend', w.trend > 0.08 ? S.trendUp : w.trend < -0.08 ? S.trendDown : S.trendSteady);
      $('#arrow').setAttribute('transform', `rotate(${((w.angle - camAz + Math.PI / 2) * 180 / Math.PI).toFixed(1)})`);
      setText('hWeather', ph.name);
      setHTML('wxIcon', WX_ICONS[ph.name]);
      const nx = game.run ? game.run.nextWeather() : null;
      setText('hNextWeather', nx ? S.nextWeather(nx.wx.name, nx.left) : '');
      const stab = T ? Math.max(0, Math.min(1, 1 - T.dyn.r)) : 1;
      stabFill.style.width = `${(stab * 100).toFixed(0)}%`;
      stabFill.style.background = stab > 0.6 ? 'var(--ok)' : stab > 0.3 ? 'var(--warn)' : 'var(--bad)';
      $('#stabBar').classList.toggle('danger', stab < 0.3);
      focusFill.style.width = `${(game.focus * 100).toFixed(0)}%`;
      $('#focusBar').classList.toggle('active', game.focusActive());
      setText('hAnchor', T && T.anchor > 0 ? `${T.anchor.toFixed(1)}s` : String(game.anchors));
      $<HTMLButtonElement>('#anchorBtn').disabled = !(game.anchors > 0) || !!(T && T.anchor > 0);
      const nt = BTYPES[game.goldenNext ? 'golden' : specialFor(n + (game.block ? 2 : 1))];
      setHTML('hNext', `<span class="swatch" style="background:${hex(nt.color)}"></span><span class="mid">${nt.label}</span>`);
      const cb = game.block ? BTYPES[game.block.type] : null;
      const bty = game.run && buildingTypeById(game.run.buildingType);
      setText('hType', bty ? bty.label : '');
      $('#hType').title = bty ? bty.hint : '';
      setText('nextHint', !settings.hints ? '' : cb && cb.hint ? S.hintNow(cb.hint) : nt.hint ? S.hintNext(nt.hint) : bty && game.drops < 6 ? `${bty.label}: ${bty.hint}` : '');
      $('#hint').hidden = !(settings.hints && game.state === 'play' && game.drops < 3 && game.block && game.block.state === 'hang');
    },
  };
  show('sTitle');
  void loadMenuScene();
  return ui;
}
