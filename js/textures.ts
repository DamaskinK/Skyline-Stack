// Procedural canvas textures, so the game ships without image files.
import * as THREE from 'three';
import { CFG } from './config.js';

export function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];   // a fresh 2d canvas always has a context
}
export function css(hex: number, f = 1) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
  return '#' + c.getHexString();
}
export function toTex(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;   // sharper ground and facades at grazing angles, less shimmer
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// One storey: wall, slab bands, four framed windows, balconies on some variants.
// A second canvas holds only the lit windows and becomes the emissive map at night.
// A colour canvas texture and its lit-window (emissive) twin.
export interface TexPair { map: THREE.CanvasTexture; emis: THREE.CanvasTexture }
export interface FacadeOpts { gold?: boolean; style?: string }
const facadeCache = new Map<string, TexPair>();
const FACADE_H = Math.round(256 * CFG.H / CFG.W);   // canvas aspect = storey aspect (W x H), so windows are not stretched
export function facade(hex: number, variant: number, opts: FacadeOpts = {}): TexPair {
  const key = `${hex}-${variant}-${opts.gold ? 1 : 0}-${opts.style || ''}`;
  const hit = facadeCache.get(key); if (hit) return hit;
  if (opts.style === 'panel' && !opts.gold) { const res = panelFacade(variant); facadeCache.set(key, res); return res; }
  if (opts.style && TYPE_FACADES[opts.style] && !opts.gold) { const res = typeFacade(opts.style, variant); facadeCache.set(key, res); return res; }
  const [c, x] = canvas2d(256, FACADE_H), [ce, xe] = canvas2d(256, FACADE_H);
  x.scale(1, FACADE_H / 128); xe.scale(1, FACADE_H / 128);   // layout is drawn on a 256x128 grid, stretched to the storey's aspect
  x.fillStyle = css(hex); x.fillRect(0, 0, 256, 128);
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(0,0,0,.2)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${0.03 + ((i * 37) % 7) * 0.006})`; x.fillRect((i * 97) % 256, (i * 53) % 128, 2, 2); }
  x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(0, 0, 256, 7);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 121, 256, 7);
  for (let i = 0; i <= 4; i++) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(i * 64 - 3, 7, 6, 114); }
  xe.fillStyle = '#000'; xe.fillRect(0, 0, 256, 128);
  const lit = [[1, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 1]][variant % 3];
  for (let i = 0; i < 4; i++) {
    const wx = i * 64 + 13, wy = 24, ww = 38, wh = 62;
    x.fillStyle = opts.gold ? '#fff2c0' : '#f6f2e6'; x.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
    const gl = x.createLinearGradient(wx, wy, wx + ww, wy + wh);
    gl.addColorStop(0, '#bfe4ff'); gl.addColorStop(0.55, '#5d8fc4'); gl.addColorStop(1, '#2c4f80');
    x.fillStyle = gl; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.beginPath(); x.moveTo(wx, wy + 26); x.lineTo(wx + 22, wy); x.lineTo(wx + 32, wy); x.lineTo(wx, wy + 38); x.fill();
    if ((i + variant) % 4 === 1) { x.fillStyle = ['#e85d5d', '#5db8e8', '#e8c85d'][variant % 3]; x.fillRect(wx, wy, 9, wh); x.fillRect(wx + ww - 9, wy, 9, wh); } // curtains
    x.fillStyle = '#f6f2e6'; x.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); x.fillRect(wx, wy + 24, ww, 3);
    if (lit[i]) {
      xe.fillStyle = (i + variant) % 2 ? '#ffcf6e' : '#ffe2a0'; xe.fillRect(wx, wy, ww, wh);
      xe.fillStyle = '#000'; xe.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); xe.fillRect(wx, wy + 24, ww, 3);
      if ((i + variant) % 3 === 0) { xe.fillStyle = '#5a3c18'; xe.fillRect(wx + 4, wy + 34, 12, 28); } // someone at the window
    }
    if (variant % 3 !== 1 && i % 2 === variant % 2) {
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(wx - 9, wy + wh + 5, ww + 18, 4);
      x.fillStyle = '#e8e8e8'; x.fillRect(wx - 9, wy + wh - 12, ww + 18, 3);
      for (let k = 0; k <= 8; k++) x.fillRect(wx - 9 + k * (ww + 18) / 8, wy + wh - 12, 2, 18);
    } else { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(wx - 6, wy + wh + 4, ww + 12, 4); }
    if (variant % 3 === 2 && i === 1) { x.fillStyle = '#3fae5a'; x.beginPath(); x.arc(wx + 8, wy + wh + 2, 7, 0, 7); x.arc(wx + 18, wy + wh, 6, 0, 7); x.fill(); }
  }
  const res = { map: toTex(c, true), emis: toTex(ce, true) };
  facadeCache.set(key, res);
  return res;
}

// Slovak / Czechoslovak prefab panel house (panelak): light concrete panels, visible joints, regular windows,
// a coloured loggia band under the windows. Drawn on the same 256x128 storey grid as the default facade.
const PANEL_ACCENTS = ['#d9772b', '#2f8f9d', '#c9a227'];
function panelFacade(variant: number): TexPair {
  const [c, x] = canvas2d(256, FACADE_H), [ce, xe] = canvas2d(256, FACADE_H);
  x.scale(1, FACADE_H / 128); xe.scale(1, FACADE_H / 128);
  const accent = PANEL_ACCENTS[variant % 3];
  x.fillStyle = '#d4cfc4'; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${i % 3 ? '0,0,0' : '255,255,255'},${0.035 + ((i * 37) % 7) * 0.006})`; x.fillRect((i * 97) % 256, (i * 53) % 128, 2, 2); }
  for (let i = 0; i < 4; i++) { x.fillStyle = (i + variant) % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)'; x.fillRect(i * 64, 0, 64, 128); }   // each panel a slightly different tone
  x.fillStyle = accent; x.fillRect(0, 88, 256, 20);   // loggia / spandrel band
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 88, 256, 3); x.fillRect(0, 105, 256, 3);
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(i * 32 + 4, 93, 24, 2); }   // railing hint
  x.fillStyle = '#6f6b63'; x.fillRect(0, 0, 256, 4); x.fillRect(0, 124, 256, 4);          // horizontal slab joints
  x.fillStyle = 'rgba(40,38,34,.55)'; for (let i = 0; i < 4; i++) x.fillRect(i * 64 - 1.5, 4, 3, 120);   // vertical panel joints
  x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(0, 4, 256, 2);
  xe.fillStyle = '#000'; xe.fillRect(0, 0, 256, 128);
  const lit = [[1, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 1]][variant % 3];
  for (let i = 0; i < 4; i++) {
    const wx = i * 64 + 14, wy = 16, ww = 36, wh = 60;
    x.fillStyle = '#f4f1e8'; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
    const gl = x.createLinearGradient(wx, wy, wx + ww, wy + wh);
    gl.addColorStop(0, '#b4d6ee'); gl.addColorStop(0.6, '#5f8db8'); gl.addColorStop(1, '#2f4f78');
    x.fillStyle = gl; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.moveTo(wx, wy + 24); x.lineTo(wx + 20, wy); x.lineTo(wx + 30, wy); x.lineTo(wx, wy + 36); x.fill();
    if ((i + variant) % 3 === 1) { x.fillStyle = 'rgba(235,225,200,.85)'; x.fillRect(wx, wy, 10, wh); x.fillRect(wx + ww - 10, wy, 10, wh); }   // curtains
    x.fillStyle = '#f4f1e8'; x.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); x.fillRect(wx, wy + 20, ww, 3);
    if (lit[i]) {
      xe.fillStyle = (i + variant) % 2 ? '#ffcf6e' : '#ffe2a0'; xe.fillRect(wx, wy, ww, wh);
      xe.fillStyle = '#000'; xe.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); xe.fillRect(wx, wy + 20, ww, 3);
    }
  }
  return { map: toTex(c, true), emis: toTex(ce, true) };
}


// Facades of the other building types, drawn on the same 256x128 storey grid. Placeholders in spirit (only panel is final)
// but each type already reads differently: wall colour, window shape and the way the lights come on at night.
type TypeFacade = { wall: string; band: string; glass: string[]; lit: string; cols: number };
const TYPE_FACADES: Record<string, TypeFacade> = {
  hotel:  { wall: '#e8dcc2', band: '#b9a47c', glass: ['#cfe3f2', '#6d94b8', '#34517a'], lit: '#ffd58a', cols: 4 },
  office: { wall: '#a9adb3', band: '#7c8189', glass: ['#9fd3e6', '#4d8fb0', '#25506f'], lit: '#fff0c0', cols: 1 },
  glass:  { wall: '#2d4a66', band: '#1d3248', glass: ['#b8e6f7', '#5fb0d6', '#2a6a96'], lit: '#e8f6ff', cols: 8 },
  deco:   { wall: '#d6c39a', band: '#a07d34', glass: ['#c8dcea', '#6a8fae', '#2f4a68'], lit: '#ffdf8a', cols: 5 },
  neon:   { wall: '#181a2c', band: '#2a2d4a', glass: ['#3a3f80', '#222659', '#12143a'], lit: '#ff5fd2', cols: 6 },
};
function typeFacade(style: string, variant: number): TexPair {
  const t = TYPE_FACADES[style];
  const [c, x] = canvas2d(256, FACADE_H), [ce, xe] = canvas2d(256, FACADE_H);
  x.scale(1, FACADE_H / 128); xe.scale(1, FACADE_H / 128);
  x.fillStyle = t.wall; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${i % 3 ? '0,0,0' : '255,255,255'},${0.03 + ((i * 37) % 7) * 0.005})`; x.fillRect((i * 97) % 256, (i * 53) % 128, 2, 2); }
  xe.fillStyle = '#000'; xe.fillRect(0, 0, 256, 128);
  x.fillStyle = t.band; x.fillRect(0, 0, 256, 6); x.fillRect(0, 122, 256, 6);
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 6, 256, 2);
  const n = t.cols, cw = 256 / n;
  // office: one ribbon window; the others: n windows. Glass tower: windows nearly fill the bay.
  const ribbon = style === 'office', fill = style === 'glass';
  const wy = fill ? 10 : ribbon ? 26 : 18, wh = fill ? 108 : ribbon ? 56 : 66;
  for (let i = 0; i < (ribbon ? 1 : n); i++) {
    const ww = ribbon ? 244 : fill ? cw - 4 : cw * (style === 'deco' ? 0.4 : 0.52);
    const wx = ribbon ? 6 : i * cw + (cw - ww) / 2;
    if (!fill && !ribbon) { x.fillStyle = style === 'neon' ? t.band : '#f4efe2'; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6); }
    const gl = x.createLinearGradient(wx, wy, wx + ww, wy + wh);
    gl.addColorStop(0, t.glass[0]); gl.addColorStop(0.55, t.glass[1]); gl.addColorStop(1, t.glass[2]);
    x.fillStyle = gl; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.moveTo(wx, wy + wh * 0.4); x.lineTo(wx + ww * 0.55, wy); x.lineTo(wx + ww * 0.8, wy); x.lineTo(wx, wy + wh * 0.65); x.fill();
    const lit = ((i * 7 + variant * 3) % 5) < 3;
    if (lit) { xe.fillStyle = t.lit; xe.fillRect(wx, wy, ww, wh); }
    x.fillStyle = style === 'neon' ? t.lit : '#e9e5da';
    if (style === 'hotel') { x.fillStyle = '#5a4630'; x.fillRect(wx - 7, wy, 6, wh); x.fillRect(wx + ww + 1, wy, 6, wh); x.fillStyle = '#e9e5da'; }   // shutters
    if (!ribbon && !fill) x.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
    if (style === 'neon') { x.fillStyle = t.lit; x.fillRect(wx - 3, wy + wh + 4, ww + 6, 3); xe.fillStyle = t.lit; xe.fillRect(wx - 3, wy + wh + 4, ww + 6, 3); }
  }
  if (ribbon) { x.fillStyle = '#d8dbe0'; for (let i = 1; i < 8; i++) x.fillRect(i * 32 - 1.5, 26, 3, 56); }
  if (style === 'deco') { x.fillStyle = t.band; for (let i = 0; i <= n; i++) x.fillRect(i * cw - 4, 6, 8, 116); x.fillStyle = '#e7c75a'; for (let i = 0; i < n; i++) x.fillRect(i * cw + cw * 0.3, 92, cw * 0.4, 8); }
  if (fill) { x.fillStyle = t.band; for (let i = 0; i <= n; i++) x.fillRect(i * cw - 1.5, 6, 3, 116); x.fillRect(0, 62, 256, 3); }
  return { map: toTex(c, true), emis: toTex(ce, true) };
}

export const roofTex = (() => {
  const [c, x] = canvas2d(128, 128);
  x.fillStyle = '#8d919c'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(0,0,0,${0.05 + (i % 5) * 0.02})`; x.fillRect((i * 71) % 128, (i * 29) % 128, 3, 3); }
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2;
  for (let i = 0; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
  x.fillStyle = '#c9ccd3'; x.fillRect(0, 0, 128, 6); x.fillRect(0, 122, 128, 6); x.fillRect(0, 0, 6, 128); x.fillRect(122, 0, 6, 128);
  x.fillStyle = '#5b5f6a'; x.fillRect(84, 20, 22, 16); x.fillStyle = '#444'; x.fillRect(24, 80, 10, 10);
  return toTex(c);
})();

// Ground floor of the player's tower: one texture per building type and sign text (the sign is a city or shop name).
const lobbyCache = new Map<string, TexPair>();
const LOBBY_WALL: Record<string, string> = { panel: '#cfc9bb', hotel: '#e6d8bd', office: '#8f949b', glass: '#2d4a66', deco: '#cdb98e', neon: '#181a2c' };
export function lobbyTexture(style: string, sign: string): TexPair {
  const key = `${style}-${sign}`;
  const hit = lobbyCache.get(key); if (hit) return hit;
  const [c, x] = canvas2d(256, 128), [ce, xe] = canvas2d(256, 128);
  const dark = style === 'glass' || style === 'neon';
  x.fillStyle = LOBBY_WALL[style] || LOBBY_WALL.panel; x.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 16) { x.fillStyle = 'rgba(0,0,0,.07)'; x.fillRect(0, y, 256, 2); }
  xe.fillStyle = '#000'; xe.fillRect(0, 0, 256, 128);
  x.fillStyle = dark ? '#0f1a28' : '#4a4640'; x.fillRect(0, 0, 256, 6);
  // shop window with sign fascia, left and right; central glass entrance under the canopy
  const fascia = style === 'panel' ? '#2f6f5e' : dark ? '#10131f' : '#5a4630';
  x.fillStyle = fascia; x.fillRect(8, 22, 240, 20);
  x.fillStyle = '#fff'; x.font = 'bold 15px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sign, 128, 33);
  xe.fillStyle = '#ffe9b0'; xe.font = 'bold 15px sans-serif'; xe.textAlign = 'center'; xe.textBaseline = 'middle'; xe.fillText(sign, 128, 33);
  for (const wx of [14, 176]) {
    x.fillStyle = '#eee9dc'; x.fillRect(wx - 3, 50, 72, 70);
    const gl = x.createLinearGradient(wx, 53, wx + 66, 120); gl.addColorStop(0, '#b4d6ee'); gl.addColorStop(1, '#3a6a98');
    x.fillStyle = gl; x.fillRect(wx, 53, 66, 64);
    x.fillStyle = '#eee9dc'; x.fillRect(wx + 32, 53, 3, 64);
    xe.fillStyle = '#ffd890'; xe.fillRect(wx, 53, 66, 64);
    xe.fillStyle = '#000'; xe.fillRect(wx + 32, 53, 3, 64);
  }
  x.fillStyle = '#2b2b2b'; x.fillRect(94, 52, 68, 76); x.fillStyle = '#8fc0ea'; x.fillRect(98, 56, 28, 72); x.fillRect(130, 56, 28, 72);
  xe.fillStyle = '#fff1c4'; xe.fillRect(98, 56, 28, 72); xe.fillRect(130, 56, 28, 72);
  const res = { map: toTex(c), emis: toTex(ce) };
  lobbyCache.set(key, res); return res;
}

// Ground floor shops for the background buildings.
const SHOPS = [['CAFE', '#c0392b'], ['PIZZA', '#e67e22'], ['BANK', '#2c3e50'], ['BOOKS', '#16a085'], ['HOTEL', '#8e44ad'], ['MARKET', '#27ae60'], ['BAKERY', '#d35400'], ['CINEMA', '#c0392b']];
export function shopTex(i: number) {
  const [name, col] = SHOPS[i % SHOPS.length];
  const [c, x] = canvas2d(256, 128), [ce, xe] = canvas2d(256, 128);
  x.fillStyle = '#e4dccb'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = col; x.fillRect(0, 8, 256, 26);
  x.fillStyle = '#fff'; x.font = 'bold 20px monospace'; x.textAlign = 'center'; x.fillText(name, 128, 29);
  for (let k = 0; k < 16; k++) { x.fillStyle = k % 2 ? '#fff' : col; x.beginPath(); x.moveTo(k * 16, 34); x.lineTo(k * 16 + 16, 34); x.lineTo(k * 16 + 8, 46); x.fill(); }
  x.fillStyle = '#2a3a4f'; x.fillRect(12, 52, 150, 70); x.fillStyle = '#7fb6e6'; x.fillRect(16, 56, 142, 62);
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(30, 56, 20, 62);
  x.fillStyle = '#3b2a1a'; x.fillRect(184, 52, 52, 76); x.fillStyle = '#c9a36a'; x.fillRect(190, 58, 40, 70);
  xe.fillStyle = '#000'; xe.fillRect(0, 0, 256, 128);
  xe.fillStyle = '#ffd890'; xe.fillRect(16, 56, 142, 62);
  xe.fillStyle = '#fff'; xe.font = 'bold 20px monospace'; xe.textAlign = 'center'; xe.fillText(name, 128, 29);
  return { map: toTex(c), emis: toTex(ce) };
}

const BILL = [['BLOXX COLA', '#e74c3c', '#fff'], ['FLY AIR', '#2980b9', '#fff'], ['BUILD HIGH', '#f1c40f', '#222'], ['RETRO FM', '#8e44ad', '#fff']];
export function billboardTex(i: number) {
  const [t, bg, fg] = BILL[i % BILL.length];
  const [c, x] = canvas2d(256, 96);
  x.fillStyle = bg; x.fillRect(0, 0, 256, 96); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 90);
  x.fillStyle = fg; x.font = 'bold 30px monospace'; x.textAlign = 'center'; x.fillText(t, 128, 60);
  return toTex(c);
}

export function latticeTex() {
  const [c, x] = canvas2d(64, 64);
  x.strokeStyle = '#f5b400'; x.lineWidth = 6;
  x.strokeRect(3, 3, 58, 58); x.lineWidth = 4; x.beginPath(); x.moveTo(3, 3); x.lineTo(61, 61); x.moveTo(61, 3); x.lineTo(3, 61); x.stroke();
  return toTex(c, true);
}
export const puffTex = (() => {
  const [c, x] = canvas2d(64, 64); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return toTex(c);
})();
export const starTex = (() => {
  const [c, x] = canvas2d(64, 64); x.translate(32, 32); x.fillStyle = '#fff';
  x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 30, a = i * Math.PI / 4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill();
  return toTex(c);
})();
export const pavingTex = (() => {
  const [c, x] = canvas2d(128, 128); x.fillStyle = '#b9b4aa'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#c4bfb4' : '#ada89e'; x.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); }
  const t = toTex(c, true); t.repeat.set(10, 10); return t;
})();
export const grassTex = (() => {
  const [c, x] = canvas2d(128, 128); x.fillStyle = '#5e9a48'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { x.fillStyle = i % 3 ? 'rgba(30,70,20,.25)' : 'rgba(170,220,120,.25)'; x.fillRect((i * 37) % 128, (i * 91) % 128, 2, 3); }
  const t = toTex(c, true); t.repeat.set(160, 160); return t;
})();
export const sidewalkTex = (() => {
  const [c, x] = canvas2d(64, 64); x.fillStyle = '#c9c4ba'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; x.strokeRect(0, 0, 64, 64); x.beginPath(); x.moveTo(32, 0); x.lineTo(32, 64); x.stroke();
  return toTex(c, true);
})();

// UVs scaled per face so a facade keeps the size of one storey on any box.
export function storeyUV(geo: THREE.BufferGeometry, w: number, h: number, d: number): THREE.BufferGeometry {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let f = 0; f < 6; f++) {
    if (f === 2 || f === 3) continue;
    const across = f < 2 ? d : w;
    for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * across / CFG.W, uv.getY(i) * h / CFG.H); }
  }
  return geo;
}

// ── calm facades for real-city buildings (near, middle ring) ──
// One tile = 6 m wide x 3.4 m storey with two windows, so a facade reads as a few big openings, not a grid of tiny ones.
// kind 'old': plaster with framed tall windows and a cornice (baroque / classicist houses); 'plain': wide windows, flat wall;
// 'panel': prefab concrete with a coloured loggia band. The second canvas is the lit-window map for night.
export const STOREY_W = 6, STOREY_H = 3.4;
const calmCache = new Map();
export function calmFacade(hex: number, kind: string, variant = 0): TexPair {
  const key = `${hex}-${kind}-${variant}`;
  if (calmCache.has(key)) return calmCache.get(key);
  const W = 256, H = 145, [c, x] = canvas2d(W, H), [ce, xe] = canvas2d(W, H);
  x.fillStyle = css(hex); x.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${i % 2 ? '0,0,0' : '255,255,255'},${0.025 + ((i * 37) % 5) * 0.004})`; x.fillRect((i * 97) % W, (i * 53) % H, 3, 2); }
  xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
  const glass = (wx: number, wy: number, ww: number, wh: number, lit: boolean) => {
    const g = x.createLinearGradient(wx, wy, wx + ww, wy + wh); g.addColorStop(0, '#9fc2dd'); g.addColorStop(0.6, '#56789f'); g.addColorStop(1, '#2f4a70');
    x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
    if (lit) { xe.fillStyle = (variant + wx) % 3 ? '#ffd27a' : '#ffe6a8'; xe.fillRect(wx, wy, ww, wh); }
  };
  if (kind === 'old') {
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, 0, W, 7); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 7, W, 4);    // cornice
    x.fillStyle = 'rgba(0,0,0,.10)'; x.fillRect(0, H - 6, W, 6);                                                           // storey band
    for (let i = 0; i < 2; i++) {
      const cx = 64 + i * 128, ww = 48, wh = 78, wx = cx - ww / 2, wy = 34;
      x.fillStyle = '#f3eee2'; x.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(wx - 6, wy + wh + 6, ww + 12, 4);
      if ((variant + i) % 2) { x.fillStyle = '#f3eee2'; x.beginPath(); x.moveTo(wx - 8, wy - 6); x.lineTo(cx, wy - 18); x.lineTo(wx + ww + 8, wy - 6); x.fill(); }   // small pediment
      glass(wx, wy, ww, wh, (variant + i) % 3 !== 1);
      x.fillStyle = '#f3eee2'; x.fillRect(cx - 1.5, wy, 3, wh); x.fillRect(wx, wy + 26, ww, 3);
      if (xe) { xe.fillStyle = '#000'; xe.fillRect(cx - 1.5, wy, 3, wh); }
    }
  } else if (kind === 'plain') {
    x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, H - 5, W, 5);
    for (let i = 0; i < 2; i++) {
      const cx = 64 + i * 128, ww = 80, wh = 66, wx = cx - ww / 2, wy = 40;
      x.fillStyle = '#e9e6de'; x.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
      glass(wx, wy, ww, wh, (variant + i) % 3 !== 0);
      x.fillStyle = '#e9e6de'; x.fillRect(cx - 1.5, wy, 3, wh);
      xe.fillStyle = '#000'; xe.fillRect(cx - 1.5, wy, 3, wh);
    }
  } else {   // panel
    const accents = ['#d9772b', '#2f8f9d', '#c9a227', '#b5503c'];
    x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, 0, 3, H); x.fillRect(W - 3, 0, 3, H); x.fillRect(0, H - 3, W, 3);           // panel joints
    x.fillStyle = accents[variant % 4]; x.fillRect(8, 96, W - 16, 38);                                                        // loggia band
    x.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 6; k++) x.fillRect(14 + k * 40, 100, 3, 30);
    for (let i = 0; i < 2; i++) {
      const cx = 64 + i * 128, ww = 58, wh = 58, wx = cx - ww / 2, wy = 24;
      x.fillStyle = '#f2efe8'; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      glass(wx, wy, ww, wh, (variant + i) % 3 !== 2);
      x.fillStyle = '#f2efe8'; x.fillRect(cx - 1.5, wy, 3, wh);
      xe.fillStyle = '#000'; xe.fillRect(cx - 1.5, wy, 3, wh);
    }
  }
  const res = { map: toTex(c, true), emis: toTex(ce, true) };
  calmCache.set(key, res);
  return res;
}
// pitched tile roof: greyscale tile courses, multiplied by a terracotta / brown / slate vertex colour
export const tileRoofTex = (() => {
  const [c, x] = canvas2d(64, 64); x.fillStyle = '#e8e8e8'; x.fillRect(0, 0, 64, 64);
  for (let r = 0; r < 8; r++) { x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, r * 8, 64, 2); for (let k = 0; k < 4; k++) { x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(k * 16 + (r % 2) * 8, r * 8 + 2, 2, 6); } }
  for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(0,0,0,${0.03 + (i % 4) * 0.01})`; x.fillRect((i * 29) % 64, (i * 47) % 64, 4, 3); }
  return toTex(c, true);
})();
