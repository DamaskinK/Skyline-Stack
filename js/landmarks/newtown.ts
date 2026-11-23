// Newtown landmarks: two invented designs of our own (no real or copied building). Built from plain geometry in the city frame
// (origin = the plaza); level-scene.js moves the group to the plot being played.
//   Meridian Clock Tower: a slim, tapering concrete shaft with glass bands, a cantilevered clock crown and a spire.
//   Lantern Bridge: a footbridge on ramps with a steel arch over the east ring road, hung with warm lanterns.
import * as THREE from 'three';
import { mergeColored, glowMats } from '../world.js';
import { NEWTOWN } from '../levels.js';
import type { Landmark } from '../types.js';

export const hide = null;            // procedural city: nothing to hide
export const clearance = [];
// Position of a Newtown landmark (grid metres); the entries are objects, never plain ids.
const site = (id: string): Landmark => {
  const l = (NEWTOWN.landmarks ?? []).find((e) => typeof e !== 'string' && e.id === id);
  if (!l || typeof l === 'string') throw new Error(`Newtown landmark ${id} missing`);
  return l;
};

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
// a box rotated about z (ramps) around its own centre, then placed
const slope = (w: number, h: number, d: number, x: number, y: number, z: number, rz: number) => new THREE.BoxGeometry(w, h, d).rotateZ(rz).translate(x, y, z);
const CONCRETE = 0xd8d4cb, DARK = 0x3a4a52, TEAL = 0x2f6f7d, BRASS = 0xd9a441, GLASS = 0x4c7c8a;

function clockTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#2b3a40'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r0 = i % 3 ? 100 : 88; g.lineWidth = i % 3 ? 4 : 8; g.beginPath(); g.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); g.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108); g.stroke(); }
  g.lineCap = 'round'; g.lineWidth = 10; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(-1.05) * 62, 128 - Math.cos(-1.05) * 62); g.stroke();   // hour hand
  g.lineWidth = 6; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(0.5) * 88, 128 - Math.cos(0.5) * 88); g.stroke();                          // minute hand
  g.fillStyle = '#d9a441'; g.beginPath(); g.arc(128, 128, 9, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function clockTower() {
  const g = new THREE.Group(); g.name = 'meridian-clock-tower';
  const P: [THREE.BufferGeometry, number][] = [];
  P.push([box(15, 0.6, 15, 0, 0.3, 0), 0xb9b5ac]);                                     // low stepped plinth
  P.push([box(12, 0.5, 12, 0, 0.85, 0), CONCRETE]);
  P.push([box(9, 4.4, 9, 0, 3.3, 0), GLASS], [box(10.4, 0.7, 10.4, 0, 5.75, 0), CONCRETE]);   // glass lobby with a flat canopy
  const H0 = 6.1, H1 = 41;                                                                // shaft: tapering core
  P.push([box(5.2, H1 - H0, 5.2, 0, (H0 + H1) / 2, 0), CONCRETE]);                       // square shaft
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push([box(1.1, H1 - H0, 1.1, sx * 2.65, (H0 + H1) / 2, sz * 2.65), 0xeeeae0]);   // four corner piers
  for (let y = H0 + 2; y < H1 - 1; y += 3.4) P.push([box(5.8, 0.45, 5.8, 0, y, 0), DARK]);   // dark floor bands
  const crown = new THREE.Group();
  const CP: [THREE.BufferGeometry, number][] = [[box(10.4, 1.0, 10.4, 0, 41.5, 0), TEAL], [box(9.2, 6.2, 9.2, 0, 45.1, 0), CONCRETE], [box(11, 0.7, 11, 0, 48.55, 0), TEAL],
    [new THREE.ConeGeometry(5.6, 4, 4, 1).rotateY(Math.PI / 4).translate(0, 51, 0), TEAL], [new THREE.CylinderGeometry(0.12, 0.2, 7, 6).translate(0, 55.5, 0), BRASS],
    [new THREE.SphereGeometry(0.45, 10, 8).translate(0, 59, 0), BRASS]];
  for (const [geo, c] of CP) P.push([geo, c]);
  const body = new THREE.Mesh(mergeColored(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }));
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  // lit window strips on the shaft, glowing at night like the city blocks
  const win = new THREE.MeshStandardMaterial({ color: 0x25424c, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4 }); glowMats.push(win);
  const strips: THREE.BufferGeometry[] = [];
  for (let y = H0 + 3.7; y < H1 - 2; y += 3.4) for (let i = 0; i < 4; i++) {
    const m = new THREE.BoxGeometry(i % 2 ? 0.1 : 3, 1.2, i % 2 ? 3 : 0.1);
    m.translate(i === 1 ? 2.62 : i === 3 ? -2.62 : 0, y, i === 0 ? 2.62 : i === 2 ? -2.62 : 0); strips.push(m);
  }
  const lit = new THREE.Mesh(mergeColored(strips.map((m) => [m, 0xffffff])), win); g.add(lit);
  // four clock faces under the cantilever, lit at night
  const tex = clockTexture(), faceMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 }); glowMats.push(faceMat);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), faceMat); const a = i * Math.PI / 2;
    f.position.set(Math.sin(a) * 4.65, 45.1, Math.cos(a) * 4.65); f.rotation.y = a; g.add(f);
  }
  g.add(crown);
  return g;
}

function lanternBridge() {
  const g = new THREE.Group(); g.name = 'lantern-bridge';
  const P: [THREE.BufferGeometry, number][] = [], DECK = 6.2, HALF = 1.9;   // deck height above the road, half width (z)
  P.push([box(30, 0.5, 2 * HALF, 0, DECK, 0), CONCRETE]);                                                                    // main span over the road and its two footways
  for (const s of [-1, 1]) {
    const L = 22, rise = DECK, ang = Math.atan2(rise, L), len = Math.hypot(L, rise);                                         // ramps down to the ground at both ends
    P.push([slope(len, 0.5, 2 * HALF, s * (15 + L / 2), DECK / 2, 0, -s * ang), 0xc8c4ba]);
    P.push([box(1.6, DECK, 2 * HALF + 0.6, s * 14.2, DECK / 2, 0), 0xb9b5ac]);                                              // abutment
    for (const z of [-HALF, HALF]) P.push([slope(len, 0.9, 0.12, s * (15 + L / 2), DECK / 2 + 0.55, z, -s * ang), TEAL]);   // ramp railings
  }
  for (const z of [-HALF, HALF]) P.push([box(30, 0.9, 0.12, 0, DECK + 0.7, z), TEAL]);                                        // deck railings
  // steel arch: two ribs rising 8.5 m above the deck over the road, hangers every 2 m
  const RISE = 8.5, SPAN = 22;
  for (const z of [-HALF + 0.1, HALF - 0.1]) {
    const pts: THREE.Vector3[] = []; for (let i = 0; i <= 24; i++) { const u = i / 24 * 2 - 1; pts.push(new THREE.Vector3(u * SPAN / 2, DECK + 0.3 + RISE * (1 - u * u), z)); }
    P.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.22, 6), TEAL]);
    for (let x = -SPAN / 2 + 2; x < SPAN / 2 - 1; x += 2) { const u = x / (SPAN / 2), h = RISE * (1 - u * u); P.push([box(0.06, h, 0.06, x, DECK + 0.3 + h / 2, z), 0xc9d4d8]); }
  }
  P.push([box(0.3, 0.3, 2 * HALF, 0, DECK + RISE + 0.45, 0), TEAL]);                                                          // crown tie
  for (let x = -SPAN / 2 + 3; x < SPAN / 2; x += 6) P.push([box(0.2, 0.2, 2 * HALF, x, DECK + (RISE * (1 - (x / (SPAN / 2)) ** 2)) + 0.3, 0), TEAL]);   // cross braces
  const m = new THREE.Mesh(mergeColored(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 }));
  m.castShadow = true; m.receiveShadow = true; g.add(m);
  // lanterns on the deck: little warm lamps that light up at dusk
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe3b0, emissive: 0xffc16a, emissiveIntensity: 0, roughness: 0.5 }); glowMats.push(lampMat);
  const ls: [THREE.BufferGeometry, number][] = []; for (let x = -14; x <= 14; x += 3.5) for (const z of [-HALF, HALF]) ls.push([new THREE.SphereGeometry(0.28, 8, 6).translate(x, DECK + 1.55, z), 0xffffff]);
  const lamps = new THREE.Mesh(mergeColored(ls), lampMat); g.add(lamps);
  return g;
}

// A Group in the city frame holding both landmarks.
export function build() {
  const g = new THREE.Group(); g.name = 'newtown-landmarks';
  const ct = clockTower(), cs = site('clock-tower'); ct.position.set(cs.x, 0.06, cs.z); ct.rotation.y = 0.35; g.add(ct);
  const lb = lanternBridge(), bs = site('lantern-bridge'); lb.position.set(bs.x, 0, bs.z); lb.rotation.y = Math.PI / 2; g.add(lb);   // spans across the road that runs along z
  // a small paved square round the clock tower
  const sq = new THREE.Mesh(new THREE.BoxGeometry(26, 0.06, 26), new THREE.MeshStandardMaterial({ color: 0xcfc7b6, roughness: 0.95 })); sq.position.set(cs.x, 0.03, cs.z); sq.receiveShadow = true; g.add(sq);
  return g;
}
