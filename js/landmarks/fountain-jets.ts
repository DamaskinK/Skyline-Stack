// Water of the Singing Fountain (S0004 08): translucent animated jets and spray arcs instead of the grey baked cones the first model had.
// Frame of scripts/blender/monuments.py (--which fountain): origin = centre of the basin, z along its long axis, nozzle plates at y 0.40.
// The nozzles are the same as that script's: three clusters (centre jet, ring of 6, ring of 12), two single jets between them and a row of small arcs along each long side.
import * as THREE from 'three';
import { glowMats } from '../world.js';

const WL = 0.40;
interface Jet { x: number; z: number; h: number; r: number; ph: number }
const jets: Jet[] = [], arcs: (Jet & { dir: number; len: number })[] = [];
const ring = (cx: number, cz: number, r: number, n: number, rot = 0): [number, number][] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rot + 2 * Math.PI * i / n), cz + r * Math.sin(rot + 2 * Math.PI * i / n)]);
for (const zc of [-7.5, 0, 7.5]) {
  jets.push({ x: 0, z: zc, h: 3.4, r: 1.2, ph: zc });
  ring(0, zc, 1.1, 6).forEach(([x, z], i) => jets.push({ x, z, h: 2.1, r: 0.9, ph: i * 1.1 + zc }));
  ring(0, zc, 2.0, 12, Math.PI / 12).forEach(([x, z], i) => jets.push({ x, z, h: 1.1, r: 0.7, ph: i * 0.7 + zc }));
}
for (const z of [-3.75, 3.75]) jets.push({ x: 0, z, h: 2.6, r: 1.0, ph: z });
for (const sx of [-1, 1]) for (let i = -5; i <= 5; i++) arcs.push({ x: sx * 4.2, z: i * 2.0, h: 1.0 + 0.15 * (((i % 3) + 3) % 3), r: 1, ph: i * 0.9 + sx, dir: sx > 0 ? Math.PI : 0, len: 2.6 });

/** The jets and arcs as a Group to add to the fountain model; they move with the clock of the page (a look only: nothing in the simulation reads them). */
export function fountainJets(): THREE.Group {
  const g = new THREE.Group(); g.name = 'fountain-jets';
  const mat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.58, roughness: 0.12, metalness: 0, emissive: 0x7e98a8, emissiveIntensity: 0, depthWrite: false, side: THREE.DoubleSide });
  glowMats.push(mat);                                                // the floodlit water follows the scenery glow at night
  // column: a thin stem that widens into a feathery head, unit height
  const col = new THREE.LatheGeometry([[0.05, 0], [0.045, 0.5], [0.05, 0.78], [0.11, 0.93], [0.13, 0.99], [0.06, 1.04], [0, 1.06]].map(([r, y]) => new THREE.Vector2(r, y)), 7);
  // arc: parabola of unit height over `len`, a thin tube whose end splashes down
  const pts = Array.from({ length: 9 }, (_, i) => { const s = i / 8; return new THREE.Vector3(s, 4 * s * (1 - s), 0); });
  const arc = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.035, 5, false);
  const cm = new THREE.InstancedMesh(col, mat, jets.length), am = new THREE.InstancedMesh(arc, mat, arcs.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const im of [cm, am]) { im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; im.renderOrder = 3; g.add(im); }
  const update = (t: number): void => {
    jets.forEach((j, i) => { const k = 0.8 + 0.2 * Math.sin(t * 2.3 + j.ph) * Math.cos(t * 0.7 + j.ph * 0.5); m.compose(p.set(j.x, WL, j.z), q.identity(), s.set(j.r, j.h * k, j.r)); cm.setMatrixAt(i, m); });
    arcs.forEach((a, i) => { const k = 0.82 + 0.18 * Math.sin(t * 2.9 + a.ph); q.setFromAxisAngle(up, a.dir); m.compose(p.set(a.x, WL + 0.1, a.z), q, s.set(a.len * (0.9 + 0.1 * k), a.h * 1.4 * k, 1)); am.setMatrixAt(i, m); });
    cm.instanceMatrix.needsUpdate = true; am.instanceMatrix.needsUpdate = true;
  };
  update(0);
  cm.onBeforeRender = () => update(performance.now() / 1000);       // before the first draw of each frame; idempotent for a given time
  return g;
}
