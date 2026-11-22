// Procedural canvas textures, so the game ships without image files.
import * as THREE from 'three';
import { CFG } from './config.js';

export function canvas2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function css(hex, f = 1) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
  return '#' + c.getHexString();
}
export function toTex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;   // sharper ground and facades at grazing angles, less shimmer
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// One storey: wall, slab bands, four framed windows, balconies on some variants.
// A second canvas holds only the lit windows and becomes the emissive map at night.
const facadeCache = new Map();
const FACADE_H = Math.round(256 * CFG.H / CFG.W);   // canvas aspect = storey aspect (W x H), so windows are not stretched
export function facade(hex, variant, opts = {}) {
  const key = `${hex}-${variant}-${opts.gold ? 1 : 0}`;
  if (facadeCache.has(key)) return facadeCache.get(key);
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

export const lobbyTex = (() => {
  const [c, x] = canvas2d(256, 128), [ce, xe] = canvas2d(256, 128);
  x.fillStyle = '#d9d2c3'; x.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 16) { x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, y, 256, 2); }
  x.fillStyle = '#c0392b'; x.fillRect(0, 18, 256, 16);
  x.fillStyle = '#fff'; x.font = 'bold 13px monospace'; x.textAlign = 'center'; x.fillText('B L O X X   T O W E R', 128, 31);
  xe.fillStyle = '#000'; xe.fillRect(0, 0, 256, 128);
  xe.fillStyle = '#ffe9b0'; xe.font = 'bold 13px monospace'; xe.textAlign = 'center'; xe.fillText('B L O X X   T O W E R', 128, 31);
  for (const [wx, wy, ww] of [[14, 52, 60], [182, 52, 60]]) {
    x.fillStyle = '#3a5f8f'; x.fillRect(wx, wy, ww, 60); x.fillStyle = '#eee'; x.fillRect(wx + ww / 2 - 1, wy, 2, 60);
    xe.fillStyle = '#ffd890'; xe.fillRect(wx, wy, ww, 60);
  }
  x.fillStyle = '#2b2b2b'; x.fillRect(96, 46, 64, 82); x.fillStyle = '#7fb4e8'; x.fillRect(100, 50, 26, 78); x.fillRect(130, 50, 26, 78);
  xe.fillStyle = '#fff1c4'; xe.fillRect(100, 50, 26, 78); xe.fillRect(130, 50, 26, 78);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fff' : '#e74c3c'; x.fillRect(86 + i * 11, 38, 11, 8); }
  return { map: toTex(c), emis: toTex(ce) };
})();

// Ground floor shops for the background buildings.
const SHOPS = [['CAFE', '#c0392b'], ['PIZZA', '#e67e22'], ['BANK', '#2c3e50'], ['BOOKS', '#16a085'], ['HOTEL', '#8e44ad'], ['MARKET', '#27ae60'], ['BAKERY', '#d35400'], ['CINEMA', '#c0392b']];
export function shopTex(i) {
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
export function billboardTex(i) {
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
export function storeyUV(geo, w, h, d) {
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    if (f === 2 || f === 3) continue;
    const across = f < 2 ? d : w;
    for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * across / CFG.W, uv.getY(i) * h / CFG.H); }
  }
  return geo;
}
