// Stylised vegetation: full trees (several canopy lumps, light tops, per-tree tint, slight wind sway), hedge lumps, flower beds.
// All instanced; the sway runs in the vertex shader from one shared clock, so it costs no CPU and no extra draw calls.
import * as THREE from 'three';
import { settings } from './settings.js';

const windTime = { value: 0 };
export function swayMaterial(mat, amp = 0.02) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windTime;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float sw = max(transformed.y - 1.6, 0.0);
        float ph = uWind * 1.35 + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.53;
        transformed.x += (sin(ph) + 0.4 * sin(ph * 2.3)) * ${amp.toFixed(3)} * sw;
        transformed.z += sin(ph * 1.1 + 1.7) * ${(amp * 0.6).toFixed(3)} * sw;
      #endif`);
  };
  return mat;
}
export const windClock = { frozen: null };   // the flicker check freezes the sway so two renders of one pose differ only by the camera move
const tick = () => { windTime.value = windClock.frozen ?? performance.now() / 1000; };

function merge(parts) {   // [geometry, colour, tint(top lighter) ]
  const pos = [], nor = [], col = [];
  for (const [g0, c, shade] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0, base = new THREE.Color(c), p = g.attributes.position;
    g.computeBoundingBox(); const bb = g.boundingBox, hgt = Math.max(1e-3, bb.max.y - bb.min.y);
    pos.push(...p.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < p.count; i++) {
      const k = shade ? 0.78 + 0.4 * (p.getY(i) - bb.min.y) / hgt : 1;
      col.push(Math.min(1, base.r * k), Math.min(1, base.g * k), Math.min(1, base.b * k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const LUMPS = [[0, 3.3, 0, 1.7], [1.05, 3.85, 0.45, 1.25], [-0.95, 3.7, -0.5, 1.3], [0.15, 4.75, -0.15, 1.1], [-0.35, 3.0, 1.0, 1.15], [0.7, 3.05, -1.0, 1.1]];
const GREENS = [0x3f8f3a, 0x4fa548, 0x2f7a3a], TINTS = [0xffffff, 0xf2ffd8, 0xe4f4c8, 0xffeec8, 0xdfeedf];   // tints multiply: yellower, cooler, autumn hints
export function treeGeometry(v) {
  const det = settings.quality === 'low' ? 0 : 1, rot = v * 2.1;
  const parts = [[new THREE.CylinderGeometry(0.22, 0.38, 2.6, 6).translate(0, 1.3, 0), 0x7a5230, false]];
  LUMPS.forEach(([x, y, z, r], i) => {
    const c = Math.cos(rot), s = Math.sin(rot), k = 1 + 0.12 * Math.sin(i * 2.7 + v);
    parts.push([new THREE.IcosahedronGeometry(r * k, det).scale(1, 0.88, 1).translate(x * c - z * s, y + (v - 1) * 0.12, x * s + z * c), GREENS[v], true]);
  });
  return merge(parts);
}
// Trees are [x, z, scale, variant]; returns the instanced meshes added to `group`.
export function addTrees(group, trees, baseY) {
  const mat = swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (let t = 0; t < 3; t++) {
    const list = trees.filter((q) => q[3] === t); if (!list.length) continue;
    const im = new THREE.InstancedMesh(treeGeometry(t), mat, list.length);
    list.forEach(([x, z, s], i) => {
      const h = Math.abs(Math.sin(x * 12.9 + z * 78.2) * 43758.5) % 1;
      o.position.set(x, baseY, z); o.scale.set(s * (0.9 + h * 0.25), s * (0.85 + ((h * 7) % 1) * 0.4), s * (0.9 + h * 0.25)); o.rotation.y = x; o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      im.setColorAt(i, c.setHex(TINTS[Math.floor(h * 997) % TINTS.length]));
    });
    im.castShadow = true; im.receiveShadow = true; im.onBeforeRender = tick; im.userData.tree = true; group.add(im);
  }
}
// Hedge lumps [x, z, rotation, scale]: dark-green rounded blobs in rows.
export function addHedges(group, list, baseY) {
  if (!list.length) return;
  const g = merge([[new THREE.IcosahedronGeometry(0.62, 1).scale(1.35, 0.95, 1), 0x2f7a3a, true]]);
  const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), list.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach(([x, z, r, s], i) => {
    o.position.set(x, baseY + 0.45 * s, z); o.rotation.y = r; o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    im.setColorAt(i, c.setHex([0xffffff, 0xe8f6d0, 0xd6ecc6][i % 3]));
  });
  im.castShadow = true; im.receiveShadow = true; group.add(im);
}
// Flower beds [x, z, rotation, length, width]: a soil bed with a scatter of coloured blooms, one instanced mesh each for soil and blooms.
export function addFlowerBeds(group, beds, baseY) {
  if (!beds.length) return;
  const soil = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.22, 1).translate(0, 0.11, 0), new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 1 }), beds.length);
  const PER = 26, bloom = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), beds.length * PER);
  const o = new THREE.Object3D(), c = new THREE.Color(), COLS = [0xe8453c, 0xf2c230, 0xf5f0e6, 0xd85fa8, 0x8f6fd8, 0xf08a30];
  const rnd = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7 + 7.3) * 43758.5453; return v - Math.floor(v); };
  beds.forEach(([x, z, r, l, w], i) => {
    o.position.set(x, baseY, z); o.rotation.set(0, r, 0); o.scale.set(l, 1, w); o.updateMatrix(); soil.setMatrixAt(i, o.matrix);
    const cs = Math.cos(r), sn = Math.sin(r), main = COLS[i % COLS.length], alt = COLS[(i * 3 + 2) % COLS.length];
    for (let k = 0; k < PER; k++) {
      const u = (rnd(i, k) - 0.5) * (l - 0.3), v = (rnd(k, i + 5) - 0.5) * (w - 0.3);
      o.position.set(x + u * cs + v * sn, baseY + 0.3 + rnd(i + 9, k) * 0.1, z - u * sn + v * cs); o.rotation.set(0, 0, 0); o.scale.setScalar(0.8 + rnd(k, i) * 0.7); o.updateMatrix();
      bloom.setMatrixAt(i * PER + k, o.matrix); bloom.setColorAt(i * PER + k, c.setHex(rnd(k * 3, i) > 0.35 ? main : alt));
    }
  });
  soil.receiveShadow = true; bloom.castShadow = false; bloom.receiveShadow = true; group.add(soil, bloom);
}
