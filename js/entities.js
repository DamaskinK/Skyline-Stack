// Meshes the game creates and moves: floor blocks, the lobby, roofs and the tower crane.
import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, blockMats, glowMats } from './world.js';
import { facade, roofTex, lobbyTex, latticeTex } from './textures.js';

const boxGeo = new THREE.BoxGeometry(CFG.W * 0.985, CFG.H * 0.985, CFG.D * 0.985);
const warnGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(CFG.W * 1.04, CFG.H * 1.02, CFG.D * 1.04));
const warnMat = new THREE.LineBasicMaterial({ color: 0xff3344 });
const topMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1 });

// materials are shared per colour and facade variant
function blockMaterial(hex, variant, gold) {
  const key = `${hex}-${variant}-${gold}`;
  if (blockMats.has(key)) return blockMats.get(key);
  const fa = facade(hex, variant, { gold });
  const side = new THREE.MeshStandardMaterial({ map: fa.map, emissiveMap: fa.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: gold ? 0.3 : 0.75, metalness: gold ? 0.6 : 0 });
  side.userData.gold = gold;
  const arr = [side, side, topMat, topMat, side, side];
  blockMats.set(key, arr); return arr;
}
export function makeBlockMesh(hex, golden, variant = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(boxGeo, blockMaterial(hex, variant, !!golden)); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const warn = new THREE.LineSegments(warnGeo, warnMat); warn.visible = false; g.add(warn);
  g.userData.warn = warn;
  scene.add(g); return g;
}
const lobbyMat = new THREE.MeshStandardMaterial({ map: lobbyTex.map, emissiveMap: lobbyTex.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 });
glowMats.push(lobbyMat);
const stepMat = new THREE.MeshStandardMaterial({ color: 0x9a968c }), planterMat = new THREE.MeshStandardMaterial({ color: 0x7b6a58 }), bushMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, flatShading: true });
export function makeFoundation(bx, bz) {
  const g = new THREE.Group();
  const side = lobbyMat;
  const m = new THREE.Mesh(new THREE.BoxGeometry(CFG.W * 1.3, CFG.FOUND_H, CFG.D * 1.3), [side, side, topMat, topMat, side, side]);
  m.castShadow = true; m.receiveShadow = true; m.position.y = CFG.FOUND_H / 2; g.add(m);
  const step = new THREE.Mesh(new THREE.BoxGeometry(CFG.W * 1.7, 0.25, CFG.D * 1.7), stepMat); step.position.y = 0.12; step.receiveShadow = true; g.add(step);
  for (const s of [-1, 1]) {   // planters by the door
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), planterMat); p.position.set(s * 1.6, 0.55, CFG.D * 0.65 + 0.7);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), bushMat); b.position.set(s * 1.6, 1.15, CFG.D * 0.65 + 0.7);
    g.add(p, b);
  }
  g.position.set(bx, 0, bz); scene.add(g); return g;
}
export function makeRoof(pos) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(CFG.W * 1.06, 0.4, CFG.D * 1.06), new THREE.MeshStandardMaterial({ color: 0x3b3f52 })); slab.position.y = 0.2;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a3a })); tank.position.set(-0.9, 1.1, -0.8);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5), new THREE.MeshStandardMaterial({ color: 0xcccccc })); ant.position.set(1, 2.1, 0.8);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0xff3030 })); tip.position.set(1, 3.9, 0.8);
  for (const m of [slab, tank, ant]) m.castShadow = true;
  g.add(slab, tank, ant, tip); g.position.copy(pos); scene.add(g); return g;
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

// cx, cz: tower base; jibY: jib height; hook: {x,z}; hy: hook height; block: hanging block or null
export function updateCrane(cx, cz, jibY, hx, hy, hz, block, clock) {
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
      _v.set(sx * CFG.W * 0.45, CFG.H / 2, sz * CFG.D * 0.45).applyEuler(block.mesh.rotation).multiplyScalar(block.mesh.scale.x);
      cablePos.set([hx, hy - 0.7, hz, block.x + _v.x, block.y + _v.y, block.z + _v.z], 12 + i * 6);
    });
  } else for (let i = 12; i < 36; i++) cablePos[i] = cablePos[i % 3 + 3];
  cables.geometry.attributes.position.needsUpdate = true;
}
export function updateMarker(visible, x, y, z, opacity) {
  marker.visible = visible;
  if (visible) { marker.position.set(x, y, z); marker.material.opacity = opacity; }
}
