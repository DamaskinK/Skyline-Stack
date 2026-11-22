// Meshes the game creates and moves: floor blocks, the lobby, roofs and the tower crane.
import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, blockMats, glowMats } from './world.js';
import { BUILDING_TYPES } from './building-types.js';
import { facade, roofTex, lobbyTexture, latticeTex } from './textures.js';

const boxGeo = new THREE.BoxGeometry(CFG.W * 0.985, CFG.H * 0.985, CFG.D * 0.985);
const warnGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(CFG.W * 1.04, CFG.H * 1.02, CFG.D * 1.04));
const warnMat = new THREE.LineBasicMaterial({ color: 0xff3344 });
const topMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1 });

// materials are shared per colour and facade variant
function blockMaterial(hex, variant, gold, style) {
  const key = `${hex}-${variant}-${gold}-${style}`;
  if (blockMats.has(key)) return blockMats.get(key);
  const fa = facade(hex, variant, { gold, style });
  const side = new THREE.MeshStandardMaterial({ map: fa.map, emissiveMap: fa.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: gold ? 0.3 : 0.75, metalness: gold ? 0.6 : 0 });
  side.userData.gold = gold;
  const arr = [side, side, topMat, topMat, side, side];
  blockMats.set(key, arr); return arr;
}
export function makeBlockMesh(hex, golden, variant = 0, style = '') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(boxGeo, blockMaterial(hex, variant, !!golden, style)); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const warn = new THREE.LineSegments(warnGeo, warnMat); warn.visible = false; g.add(warn);
  g.userData.warn = warn;
  scene.add(g); return g;
}
const lobbyMats = new Map();
function lobbyMaterial(style, sign) {
  const key = `${style}-${sign}`;
  if (lobbyMats.has(key)) return lobbyMats.get(key);
  const t = lobbyTexture(style, sign);
  const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 });
  glowMats.push(m); lobbyMats.set(key, m); return m;
}
const stepMat = new THREE.MeshStandardMaterial({ color: 0x9a968c }), planterMat = new THREE.MeshStandardMaterial({ color: 0x7b6a58 }), bushMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, flatShading: true });
const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f6f5e, roughness: 0.6 }), canopyTrim = new THREE.MeshStandardMaterial({ color: 0xeee9dc });
// bx, bz: position; typeId: building type; city: city name for the sign when the type has none
export function makeFoundation(bx, bz, typeId = 'panel', city = '') {
  const bt = BUILDING_TYPES[typeId] || BUILDING_TYPES.panel;
  const g = new THREE.Group();
  const side = lobbyMaterial(bt.facade, bt.sign || (city || 'CITY').toUpperCase());
  const m = new THREE.Mesh(new THREE.BoxGeometry(CFG.W * 1.3, CFG.FOUND_H, CFG.D * 1.3), [side, side, topMat, topMat, side, side]);
  m.castShadow = true; m.receiveShadow = true; m.position.y = CFG.FOUND_H / 2; g.add(m);
  const step = new THREE.Mesh(new THREE.BoxGeometry(CFG.W * 1.7, 0.25, CFG.D * 1.7), stepMat); step.position.y = 0.12; step.receiveShadow = true; g.add(step);
  // entrance canopy over the door
  const front = CFG.D * 0.65;
  const can = new THREE.Mesh(new THREE.BoxGeometry(CFG.W * 0.5, 0.12, 0.9), canopyMat); can.position.set(0, 1.45, front + 0.4); can.castShadow = true;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(CFG.W * 0.5 + 0.1, 0.1, 0.08), canopyTrim); rim.position.set(0, 1.38, front + 0.85);
  g.add(can, rim);
  for (const s of [-1, 1]) {   // planters by the door
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), planterMat); p.position.set(s * 1.6, 0.55, CFG.D * 0.65 + 0.7);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), bushMat); b.position.set(s * 1.6, 1.15, CFG.D * 0.65 + 0.7);
    g.add(p, b);
  }
  g.position.set(bx, 0, bz); scene.add(g); return g;
}

// The top of a finished tower, one per building type. Built around y = 0 at the roof, x/z centred; not added to the scene.
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const crownMats = { concrete: mat(0xb9b5ab), dark: mat(0x3b3f52), slate: mat(0x4a4f5e), terracotta: mat(0xa3472e), glass: mat(0x7fc4e0, { roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.8 }), steel: mat(0xd0d4da, { metalness: 0.7, roughness: 0.3 }), stone: mat(0xcdb98e), gold: mat(0xe7c75a, { metalness: 0.6, roughness: 0.3 }), neon: new THREE.MeshBasicMaterial({ color: 0xff5fd2 }) };
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = true; return o; };
const CROWNS = {
  // flat roof with a parapet and a small lift house
  panel(g) {
    const W = CFG.W, D = CFG.D, p = 0.14, h = 0.45, c = crownMats.concrete;
    g.add(box(W * 1.04, 0.12, D * 1.04, crownMats.dark, 0, 0, 0));
    g.add(box(W * 1.04, h, p, c, 0, 0.12, D * 0.51), box(W * 1.04, h, p, c, 0, 0.12, -D * 0.51), box(p, h, D * 1.04, c, W * 0.51, 0.12, 0), box(p, h, D * 1.04, c, -W * 0.51, 0.12, 0));
    g.add(box(1.4, 1.0, 1.2, c, -0.8, 0.12, -0.6), box(1.5, 0.12, 1.3, crownMats.dark, -0.8, 1.12, -0.6));
    g.add(box(0.5, 0.35, 0.5, crownMats.slate, 1.0, 0.12, 0.7));
  },
  // mansard roof with dormers
  hotel(g) {
    g.add(box(CFG.W * 1.04, 0.15, CFG.D * 1.04, crownMats.stone, 0, 0, 0));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(CFG.W * 0.42, CFG.W * 0.74, 1.3, 4, 1), crownMats.slate);
    m.rotation.y = Math.PI / 4; m.position.y = 0.15 + 0.65; m.castShadow = true; g.add(m);
    for (const [x, z, r] of [[-0.9, 1.35, 0], [0.9, 1.35, 0], [-0.9, -1.35, Math.PI], [0.9, -1.35, Math.PI], [1.35, 0, Math.PI / 2], [-1.35, 0, -Math.PI / 2]]) {
      const d = new THREE.Group();
      d.add(box(0.6, 0.5, 0.45, crownMats.stone, 0, 0, 0), box(0.4, 0.3, 0.05, crownMats.glass, 0, 0.1, 0.23));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.35, 4), crownMats.terracotta); roof.rotation.y = Math.PI / 4; roof.position.y = 0.67; d.add(roof);
      d.position.set(x * 0.9, 0.35, z * 0.78); d.rotation.y = r; g.add(d);
    }
    g.add(box(0.35, 0.8, 0.35, crownMats.terracotta, 0.6, 1.2, -0.4));
  },
  // glass crown
  office(g) {
    g.add(box(CFG.W * 1.04, 0.2, CFG.D * 1.04, crownMats.concrete, 0, 0, 0));
    g.add(box(CFG.W * 0.8, 1.3, CFG.D * 0.8, crownMats.glass, 0, 0.2, 0));
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.12, 1.3, 0.12, crownMats.steel, x * CFG.W * 0.4, 0.2, z * CFG.D * 0.4));
    g.add(box(CFG.W * 0.86, 0.12, CFG.D * 0.86, crownMats.steel, 0, 1.5, 0));
  },
  // spire
  glass(g) {
    g.add(box(CFG.W * 1.0, 0.2, CFG.D * 1.0, crownMats.steel, 0, 0, 0));
    const s = new THREE.Mesh(new THREE.ConeGeometry(CFG.W * 0.38, 4.6, 4), crownMats.glass); s.rotation.y = Math.PI / 4; s.position.y = 0.2 + 2.3; s.castShadow = true; g.add(s);
  },
  // stepped crown
  deco(g) {
    const S = [[1.04, 0.35], [0.82, 0.7], [0.6, 0.8], [0.38, 0.9]]; let y = 0;
    for (const [k, h] of S) { g.add(box(CFG.W * k, h, CFG.D * k, y === 0 ? crownMats.stone : crownMats.stone, 0, y, 0)); g.add(box(CFG.W * k + 0.08, 0.08, CFG.D * k + 0.08, crownMats.gold, 0, y + h, 0)); y += h + 0.08; }
    g.add(box(0.12, 1.2, 0.12, crownMats.gold, 0, y, 0));
  },
  // lit sign frame
  neon(g) {
    g.add(box(CFG.W * 1.04, 0.2, CFG.D * 1.04, crownMats.dark, 0, 0, 0));
    const W = CFG.W * 0.96, t = 0.1;
    g.add(box(W, t, t, crownMats.neon, 0, 0.2, 0), box(W, t, t, crownMats.neon, 0, 1.6, 0), box(t, 1.5, t, crownMats.neon, -W / 2, 0.2, 0), box(t, 1.5, t, crownMats.neon, W / 2, 0.2, 0));
    g.add(box(W * 0.6, 0.12, 0.12, crownMats.neon, 0, 0.9, 0));
  },
};
export function makeCrown(typeId = 'panel') {
  const bt = BUILDING_TYPES[typeId] || BUILDING_TYPES.panel;
  const g = new THREE.Group(); (CROWNS[bt.crown] || CROWNS.panel)(g); return g;
}
// A crown standing in the scene (menu demo tower).
export function makeRoof(pos, typeId = 'panel') {
  const g = makeCrown(typeId); g.position.copy(pos); scene.add(g); return g;
}

// ── tower crane: lattice mast, jib, counter-jib, cab, trolley, cable, hook and slings ──
const latMat = (t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
const crane = new THREE.Group(); scene.add(crane);
const mastTex = latticeTex(), jibTex = latticeTex();
const mast = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4).translate(0, 0.5, 0), latMat(mastTex)); crane.add(mast);
const JIB_L = 30;
const jib = new THREE.Mesh(new THREE.BoxGeometry(JIB_L, 1.2, 1.2), latMat(jibTex)); jibTex.repeat.set(JIB_L / 1.2, 1); crane.add(jib);
const cjibTex = latticeTex(); cjibTex.repeat.set(10, 1);
const cjib = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1), latMat(cjibTex)); crane.add(cjib);
const weight = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.8), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 1 })); crane.add(weight);
const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 1.8), new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.5 })); crane.add(cab);
const apex = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 4), latMat(latticeTex())); crane.add(apex);
const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); crane.add(beacon);
const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x333333 })); crane.add(trolley);
const hookBlock = new THREE.Group();
const hb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.5), new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.4 }));
const hk = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 12, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7, roughness: 0.3 }));
hk.position.y = -0.7; hk.rotation.z = Math.PI * 0.8; hookBlock.add(hb, hk); scene.add(hookBlock);
for (const m of [mast, jib, cjib, weight, cab, hb]) m.castShadow = true;
const cablePos = new Float32Array(3 * 2 * 6);
const cables = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(cablePos, 3)), new THREE.LineBasicMaterial({ color: 0x1a1a1a }));
cables.frustumCulled = false; scene.add(cables);
const marker = new THREE.Mesh(new THREE.PlaneGeometry(CFG.W, CFG.D), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; scene.add(marker);
const _v = new THREE.Vector3();

// cx, cz: tower base; jibY: jib height; hook: {x,z}; hy: hook height; block: hanging block {x,y,z} or null; mesh: its mesh
export function updateCrane(cx, cz, jibY, hx, hy, hz, block, mesh, clock) {
  crane.position.set(cx - 14, 0, cz - 3);
  mast.scale.y = jibY; mastTex.repeat.set(1, jibY / 1.4);
  jib.position.set(16, jibY + 0.6, 3); cjib.position.set(-5, jibY + 0.5, 3);
  weight.position.set(-8.5, jibY - 0.3, 3); cab.position.set(1.4, jibY - 0.9, 3); apex.position.set(0, jibY + 3.6, 0);
  beacon.position.set(0, jibY + 6.2, 0); beacon.visible = Math.sin(clock * 4) > 0;
  trolley.position.set(14, jibY - 0.1, 3);
  hookBlock.position.set(hx, hy, hz);
  hookBlock.rotation.z = Math.atan2(hx - cx, jibY - hy) * 0.8;
  const ty = jibY - 0.3;
  cablePos.set([cx - 0.3, ty, cz, hx - 0.2, hy + 0.4, hz, cx + 0.3, ty, cz, hx + 0.2, hy + 0.4, hz], 0);
  if (block) {
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => {
      _v.set(sx * CFG.W * 0.45, CFG.H / 2, sz * CFG.D * 0.45).applyEuler(mesh.rotation).multiplyScalar(mesh.scale.x);
      cablePos.set([hx, hy - 0.7, hz, block.x + _v.x, block.y + _v.y, block.z + _v.z], 12 + i * 6);
    });
  } else for (let i = 12; i < 36; i++) cablePos[i] = cablePos[i % 3 + 3];
  cables.geometry.attributes.position.needsUpdate = true;
}
export function updateMarker(visible, x, y, z, opacity) {
  marker.visible = visible;
  if (visible) { marker.position.set(x, y, z); marker.material.opacity = opacity; }
}
