// Shared look and builder helpers for the hand-built landmarks of every city: one low-poly material set, a few canvas
// textures (stone, glazed tiles, plaster), and a Parts collector that merges everything into one mesh per material.
// Frame as in the rings: 1 unit = 1 m, y up. A landmark is built in its own local frame and placed by the city module.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas2d } from '../textures.js';
import { glowMats } from '../world.js';      // materials pushed here get emissiveIntensity = the scenery's night glow

// ── geometry helpers ──
export const lathe = (profile, seg = 8) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);              // base on y = 0
export const cyl = (r0, r1, h, seg = 8) => new THREE.CylinderGeometry(r1, r0, h, seg).translate(0, h / 2, 0);

export function extrude(pts, depth, curve) {                                                      // outline in x/y, thickness along z (centred)
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: curve || 4 }); g.translate(0, 0, -depth / 2); return g;
}
export function archShape(w, h, rise, depth) {                                                    // pointed arch (gothic): straight sides, two curves meeting at the apex
  const s = new THREE.Shape(), hw = w / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, h); s.quadraticCurveTo(hw * 0.9, h + rise * 0.8, 0, h + rise); s.quadraticCurveTo(-hw * 0.9, h + rise * 0.8, -hw, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -depth / 2); return g;
}
export function roundArch(w, h, depth) {                                                          // round-headed opening
  const s = new THREE.Shape(), hw = w / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, h); s.absarc(0, h, hw, 0, Math.PI, false); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 }); g.translate(0, 0, -depth / 2); return g;
}
// swap two vertices of every triangle so the first face normal points up
function faceUp(g) {
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) >= 0) return g;
  for (const name of ['position', 'uv']) {
    const a = g.attributes[name], n = a.itemSize;
    for (let i = 0; i + 2 < a.count; i += 3) for (let k = 0; k < n; k++) { const t = a.array[(i + 1) * n + k]; a.array[(i + 1) * n + k] = a.array[(i + 2) * n + k]; a.array[(i + 2) * n + k] = t; }
  }
  g.computeVertexNormals(); return g;
}
function slope(p, uv) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return faceUp(g);
}
// gabled roof along local x: ridge at y = rise, eaves at y = 0, half width hw. Returns the two tile slopes and the two stone gable triangles.
export function gableRoof(len, hw, rise, tile = 5) {
  const sl = Math.hypot(hw, rise), L = len / 2, slopes = [];
  for (const s of [-1, 1]) {
    slopes.push(slope([-L, 0, s * hw, L, 0, s * hw, L, rise, 0, -L, 0, s * hw, L, rise, 0, -L, rise, 0],
      [0, 0, len / tile, 0, len / tile, sl / tile, 0, 0, len / tile, sl / tile, 0, sl / tile]));
  }
  const ends = [];
  for (const s of [-1, 1]) { const g = extrude([[-hw, 0], [hw, 0], [0, rise]], 0.5); g.rotateY(Math.PI / 2).translate(s * (L - 0.25), 0, 0); ends.push(g); }
  return { slopes, ends };
}
export function shedRoof(len, w, rise, tile = 5) {                                                  // one slope: y = rise at z = 0 down to y = 0 at z = w
  const sl = Math.hypot(w, rise), L = len / 2;
  return slope([-L, rise, 0, L, 0, w, L, rise, 0, -L, rise, 0, -L, 0, w, L, 0, w],
    [0, 0, len / tile, sl / tile, len / tile, 0, 0, 0, 0, sl / tile, len / tile, sl / tile]);
}
export const stretchUV = (g, su, sv) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; };

// Wall UVs from the geometry's own box: whole bays of ~`bay` metres per wall; v is 0..1 over the wall height when `vs` is 0, else metres / vs.
function wallUV(g, bay, vs) {
  g.computeBoundingBox(); const bb = g.boundingBox, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const ex = bb.max.x - bb.min.x, ez = bb.max.z - bb.min.z, eh = bb.max.y - bb.min.y;
  const nx = Math.max(1, Math.round(ex / bay)), nz = Math.max(1, Math.round(ez / bay));
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i)), x = pos.getX(i) - bb.min.x, z = pos.getZ(i) - bb.min.z, y = pos.getY(i) - bb.min.y;
    const v = vs ? y / vs : y / Math.max(eh, 1e-3);
    if (ay > 0.7) uv.setXY(i, x / bay, z / bay);
    else if (ax > az) uv.setXY(i, z / ez * nz, v); else uv.setXY(i, x / ex * nx, v);
  }
}

// Collects transformed geometry per material key, then merges each key into one mesh.
export class Parts {
  constructor() { this.map = new Map(); this.tris = 0; }
  add(geo, key, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0)),
      new THREE.Vector3(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    g.applyMatrix4(m);
    if (o.wall) wallUV(g, o.wall, o.vs || 0);
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push(g); this.tris += g.attributes.position.count / 3; return this;
  }
  build(mats, group, shadow = true) {
    for (const [key, list] of this.map) {
      const mesh = new THREE.Mesh(mergeGeometries(list), mats[key]); mesh.castShadow = shadow && !mats[key].transparent; mesh.receiveShadow = true; mesh.name = key; group.add(mesh);
    }
    group.userData.tris = this.tris; return group;
  }
}

// ── textures: a pair (colour, emissive) per wall type so lit windows follow the scenery's night factor ──
function pair(w, h, draw) {
  const [c, g] = canvas2d(w, h), [ce, ge] = canvas2d(w, h);
  draw(g, ge, w, h);
  const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  return { map: mk(c), emis: mk(ce) };
}
function arch(g, cx, y0, w, h, rise) {                                                            // pointed arch path, y0 = sill (canvas y grows down)
  g.beginPath(); g.moveTo(cx - w / 2, y0); g.lineTo(cx - w / 2, y0 - h); g.quadraticCurveTo(cx - w * 0.45, y0 - h - rise * 0.8, cx, y0 - h - rise); g.quadraticCurveTo(cx + w * 0.45, y0 - h - rise * 0.8, cx + w / 2, y0 - h); g.lineTo(cx + w / 2, y0); g.closePath();
}
function archR(g, cx, y0, w, h) { g.beginPath(); g.moveTo(cx - w / 2, y0); g.lineTo(cx - w / 2, y0 - h); g.arc(cx, y0 - h, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, y0); g.closePath(); }
function ashlar(g, w, h, base, line, step) {
  g.fillStyle = base; g.fillRect(0, 0, w, h); g.strokeStyle = line; g.lineWidth = 1;
  for (let y = 0; y < h; y += step) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); for (let x = ((y / step) % 2) * step * 1.5; x < w; x += step * 3) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + step); g.stroke(); } }
}
const WARM = '#ffc477', FLOOD = '#2a2216';

// Gothic nave wall, one bay: a tall pointed-arch window with a mullion, framed in dressed stone. v runs over the whole wall.
function gothicBay() {
  return pair(128, 256, (g, e, w, h) => {
    ashlar(g, w, h, '#d6cdb6', 'rgba(120,108,88,0.35)', 16);
    e.fillStyle = FLOOD; e.fillRect(0, 0, w, h);
    arch(g, w / 2, h * 0.8, w * 0.46, h * 0.46, w * 0.3); g.fillStyle = '#9d927c'; g.fill(); g.save(); g.translate(0, 0);
    arch(g, w / 2, h * 0.8 - 3, w * 0.36, h * 0.46 - 3, w * 0.26); g.fillStyle = '#26323f'; g.fill(); e.save();
    arch(e, w / 2, h * 0.8 - 3, w * 0.36, h * 0.46 - 3, w * 0.26); e.fillStyle = WARM; e.fill(); e.restore(); g.restore();
    for (const gg of [g, e]) { gg.fillStyle = gg === g ? '#9d927c' : '#000'; gg.fillRect(w / 2 - 1.5, h * 0.8 - h * 0.46 - w * 0.2, 3, h * 0.46 + w * 0.2 - 3); }
  });
}
// Tower shaft: dressed stone with a narrow slit pair; tile is 5 m by 9 m.
function towerStone() {
  return pair(64, 128, (g, e, w, h) => {
    ashlar(g, w, h, '#cfc6ae', 'rgba(110,98,80,0.4)', 8);
    e.fillStyle = FLOOD; e.fillRect(0, 0, w, h);
    for (const cx of [w * 0.3, w * 0.7]) { arch(g, cx, h * 0.72, w * 0.16, h * 0.34, w * 0.1); g.fillStyle = '#26323f'; g.fill(); arch(e, cx, h * 0.72, w * 0.16, h * 0.34, w * 0.1); e.fillStyle = WARM; e.fill(); }
  });
}
// Glazed roof tiles of the cathedral: diamonds in yellow, green, red and blue, 4 m per repeat.
function glazedTiles() {
  const [c, g] = canvas2d(128, 128), pal = ['#e0b43a', '#3d8a52', '#c4412f', '#2f5f9e'];
  g.fillStyle = '#e9c14a'; g.fillRect(0, 0, 128, 128);
  for (let j = -1; j < 5; j++) for (let i = -1; i < 5; i++) {
    const x = i * 32 + (j & 1 ? 16 : 0), y = j * 32 + 16, col = pal[(i + 2 * (j & 1) + 4) % 4 === 0 ? 1 : (i + j + 8) % 4];
    g.fillStyle = col; g.beginPath(); g.moveTo(x, y - 15); g.lineTo(x + 15, y); g.lineTo(x, y + 15); g.lineTo(x - 15, y); g.closePath(); g.fill();
    g.fillStyle = pal[0]; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
// Neo-baroque theatre front, one bay (5.5 m): rusticated base, arched ground-floor window, tall round-headed upper window, cream plaster.
function creamFacade() {
  return pair(128, 256, (g, e, w, h) => {
    g.fillStyle = '#f0dea6'; g.fillRect(0, 0, w, h); e.fillStyle = '#35291a'; e.fillRect(0, 0, w, h);
    g.fillStyle = '#e4cf93'; g.fillRect(0, h * 0.78, w, h * 0.22);                                // rustication
    g.strokeStyle = 'rgba(150,125,70,0.5)'; for (let y = h * 0.78; y < h; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#fff6dc'; g.fillRect(0, h * 0.05, w, 5); g.fillRect(0, h * 0.5, w, 4); g.fillRect(0, h * 0.77, w, 4); g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
    for (const [y0, hh] of [[h * 0.74, h * 0.2], [h * 0.46, h * 0.3]]) {
      archR(g, w / 2, y0, w * 0.46, hh); g.fillStyle = '#fff3d2'; g.fill();
      archR(g, w / 2, y0 - 3, w * 0.36, hh - 3); g.fillStyle = '#2b3a46'; g.fill(); archR(e, w / 2, y0 - 3, w * 0.36, hh - 3); e.fillStyle = WARM; e.fill();
      g.fillStyle = '#fff3d2'; g.fillRect(w / 2 - 1.5, y0 - hh - w * 0.2, 3, hh + w * 0.2 - 3);
    }
  });
}
// Window grid of the plain cream wings and the stage house.
function plainCream() {
  return pair(64, 128, (g, e, w, h) => {
    g.fillStyle = '#ead69a'; g.fillRect(0, 0, w, h); e.fillStyle = '#30261a'; e.fillRect(0, 0, w, h);
    for (const y0 of [h * 0.4, h * 0.82]) { g.fillStyle = '#fff3d2'; g.fillRect(w * 0.22, y0 - h * 0.28, w * 0.56, h * 0.3); g.fillStyle = '#2b3a46'; g.fillRect(w * 0.28, y0 - h * 0.25, w * 0.44, h * 0.25); e.fillStyle = WARM; e.fillRect(w * 0.28, y0 - h * 0.25, w * 0.44, h * 0.25); }
  });
}
const plainTex = (hex) => { const [c, g] = canvas2d(32, 32); g.fillStyle = hex; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * 32, Math.random() * 32, 4, 2); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

let set = null;
// The shared material set. Keys are used by every city module; `lit` ones glow at night with the scenery's glow value.
export function landmarkMaterials() {
  if (set) return set;
  const lit = (p, o = {}) => { const m = new THREE.MeshStandardMaterial({ map: p.map, emissiveMap: p.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9, ...o }); glowMats.push(m); return m; };
  const flat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });
  const flood = (color, emissive, o = {}) => { const m = flat(color, { emissive, emissiveIntensity: 0, ...o }); glowMats.push(m); return m; };   // floodlit parts: warm self-light at night
  const tiles = glazedTiles();
  const gothic = lit(gothicBay()), tower = lit(towerStone()), cream = lit(creamFacade()), wing = lit(plainCream());
  set = {
    gothic, tower, cream, wing,
    tiles: (() => { const m = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.55, metalness: 0.05, emissive: 0x3a2e12, emissiveIntensity: 0 }); glowMats.push(m); return m; })(),
    stone: flood(0xcfc6ae, 0x2a2418),
    cream_flat: flood(0xf0dea6, 0x3a2f18),
    copper: flood(0x4f9a82, 0x1d4a3c, { roughness: 0.5, metalness: 0.25 }),
    copperDark: flood(0x3f7f6f, 0x153a30, { roughness: 0.5, metalness: 0.25 }),
    gold: flood(0xe3b34a, 0x7a5a14, { roughness: 0.35, metalness: 0.6 }),
    redTile: flat(0xa9482e), dark: flat(0x23272c), glass: flood(0x2d4458, 0x6b4a20),
    water: flood(0x6fb1d6, 0x2a5a8a, { roughness: 0.2 }), column: flood(0xf6ecd0, 0x3a3020),
    stoneGrey: flood(0xa9a395, 0x25221a), bronze: flat(0x47594d),
  };
  return set;
}
