// Menus, settings, scores and the in-game HUD. Screens are <section class="screen"> elements shown one at a time.
import { CFG, DIFFICULTY, BTYPES, PHASES, PHASE_LEN, phaseAt, specialFor } from './config.js';
import { settings, setSetting, loadScores, addScore, resetScores } from './settings.js';
import { Sfx, Music } from './audio.js';
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
  Fog: '<svg viewBox="0 0 32 32"><g stroke="#f2c0a0" stroke-width="3" stroke-linecap="round"><path d="M4 10h20M8 16h20M4 22h18M10 28h14"/></g></svg>',
};
const HEART = (on) => `<svg viewBox="0 0 24 22" class="${on ? '' : 'off'}"><path d="M12 21 L3 12 A5 5 0 0 1 12 5 A5 5 0 0 1 21 12 Z" fill="#ff4d5e" stroke="#000" stroke-width="2"/></svg>`;
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
    if (id === 'sScores') renderScores($('#hsTable'), scoreTab);
    if (id === 'sTitle') renderTitleBest();
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
    const e = loadScores().endless?.[0];
    $('#titleBest').innerHTML = e ? `BEST TOWER <b>${e.score}</b> · ${e.floors} FL` : 'NO RECORDS YET. BE THE FIRST.';
  }

  // ── navigation ──
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]'); if (go) { Sfx.init(); Sfx.uiOk(); show(go.dataset.go); return; }
    if (e.target.closest('[data-back]')) back();
  });
  for (const b of $$('.mi, .card-opt, .seg button, .tabs button')) b.addEventListener('pointerenter', () => { if (document.activeElement !== b) { b.focus({ preventScroll: true }); Sfx.ui(); } });

  // ── new game ──
  let pickDiff = settings.difficulty;
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
  }
  syncNew();
  $('#btnStart').onclick = () => startGame('endless', pickDiff);
  function startGame(mode, diff) {
    Sfx.init(); Sfx.uiOk(); clearDemo(); hideScreens(); stack = [];
    Music.setMood('game');
    game.start(mode, diff);
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
  const scoreTab = 'endless';
  function renderScores(el, mode) {
    const list = (loadScores()[mode] || []).slice(0, 10);
    el.innerHTML = list.length
      ? list.map((s, i) => `<tr><td class="rk">${i + 1}</td><td>${esc(s.name)}<span class="d ${esc(s.diff || 'normal')}">${esc((s.diff || 'normal').toUpperCase())}</span></td><td>${s.floors} fl</td><td class="sc">${s.score}</td></tr>`).join('')
      : '<tr><td class="empty">No scores yet. Your first tower goes here.</td></tr>';
  }

  // ── help ──
  $('#helpBlocks').innerHTML = Object.values(BTYPES).filter((b) => b.hint).map((b) => `<li><span class="swatch" style="background:${hex(b.color)}"></span><b>${b.label.toUpperCase()}</b>${b.hint}</li>`).join('');
  $('#helpWeather').innerHTML = PHASES.map((p) => `<li>${WX_ICONS[p.name]}<b>${p.name.toUpperCase()}</b>${p.text}</li>`).join('') + `<li>Weather changes every ${PHASE_LEN} floors. Earthquakes hit every ${CFG.quakeEvery}.</li>`;

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
  $('#btnRestart').onclick = () => { game.paused = false; startGame(game.mode, game.diffKey); };
  function syncMute() { $('#muteX').hidden = !settings.muted; $('#muteWave').hidden = settings.muted; $('#btnMute').setAttribute('aria-label', settings.muted ? 'Unmute sound' : 'Mute sound'); }
  function toggleMute() { setSetting('muted', !settings.muted); syncMute(); }
  function cycleCam() { game.camMode = (game.camMode + 1) % 3; setSetting('camera', game.camMode); }
  $('#btnMute').onclick = toggleMute; $('#btnCam').onclick = cycleCam;
  syncMute();

  function toMenu() {
    game.clear(); game.state = 'menu'; game.paused = false;
    $('#hud').hidden = true; $('#wxCard').hidden = true;
    stack = []; show('sTitle'); buildDemo(); People.setWalkers(9); Music.setMood('menu');
  }
  $('#btnQuit').onclick = () => { Sfx.uiBack(); toMenu(); };
  $('#btnMenu').onclick = () => { Sfx.uiBack(); toMenu(); };
  $('#btnAgain').onclick = () => startGame(game.mode, game.diffKey);

  // ── game over ──
  $('#saveForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (game.saved || !game.lastResult) return;
    const r = game.lastResult;
    addScore(game.mode, { name: ($('#name').value || 'PLAYER').toUpperCase().slice(0, 12), score: r.score, floors: r.floors, diff: r.diff, date: Date.now() });
    try { localStorage.setItem('tb3d_name', $('#name').value); } catch { /* storage blocked */ }
    game.saved = true; $('#btnSave').disabled = true; $('#btnSave').textContent = 'SAVED'; Sfx.uiOk();
    renderScores($('#overHs'), game.mode);
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
    gameOver(r, record) {
      $('#hud').hidden = true;
      $('#overTitle').textContent = 'GAME OVER';
      $('#newRecord').hidden = !record;
      $('#overStats').innerHTML = `<div><span class="lbl">SCORE</span><b>${r.score}</b></div><div><span class="lbl">HEIGHT</span><b>${r.floors} FL</b></div><div><span class="lbl">RESIDENTS</span><b>${r.pop}</b></div>`;
      $('#btnSave').disabled = false; $('#btnSave').textContent = 'SAVE';
      try { $('#name').value = localStorage.getItem('tb3d_name') || 'PLAYER'; } catch { /* storage blocked */ }
      renderScores($('#overHs'), game.mode);
      stack = []; show('sOver');
      if (record) Sfx.fanfare();
    },
    update(rdt, camAz) {
      if (wxTimer > 0) { wxTimer -= rdt; if (wxTimer <= 0) $('#wxCard').hidden = true; }
      if (bannerT > 0) { bannerT -= rdt; setText('banner', bannerText); } else setText('banner', '');
      if ($('#hud').hidden) return;
      const T = game.tower, n = T ? T.n : 0, ph = phaseAt(n), w = game.wind;
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
      const left = PHASE_LEN - (n % PHASE_LEN);
      setText('hNextWeather', `${phaseAt(n + left).name.toUpperCase()} IN ${left} FL`);
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
      setText('nextHint', !settings.hints ? '' : cb && cb.hint ? `NOW: ${cb.hint}` : nt.hint ? `NEXT: ${nt.hint}` : '');
      $('#hint').hidden = !(settings.hints && game.state === 'play' && game.drops < 3 && game.block && game.block.state === 'hang');
    },
  };
  show('sTitle');
  return ui;
}
