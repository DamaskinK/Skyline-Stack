// Street furniture and bike lanes for an OpenStreetMap near ring: benches, bins, bike racks, bollards, planters, kiosks,
// bus stops and street signs (own low-poly, instanced), red bike lanes with white markings, and the spots where people
// sit, stand and cyclists ride. Returns data for People (js/fx.js): { sit, stand, bikeRoutes, basins }.
import * as THREE from 'three';
import { glowMats } from './world.js';
import { Builder, LAYER, PLAZA_HALF, polyArea, insideRing, hash, layerMat, mergeParts, mesh, instanceKit } from './near-ring.js';
import type { Vec } from './near-ring.js';
import type { LevelAssets, OsmExtract } from './types.js';

const Y = 0.05;                       // ground height of the footways
const BIKE_COLOR = 0xa8483c, MARK = 0xf2efe6;
const BASIN_MAX = 1500;               // same limit as near-ring.js: smaller water is a basin
type Part = [THREE.BufferGeometry, number];     // geometry, colour
const cyl = (r0: number, r1: number, h: number, y: number, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(0, y, 0);
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// ── furniture shapes: merged and vertex-coloured, one InstancedMesh each ──
const SHAPES: Record<string, () => Part[]> = {
  bin: () => [[cyl(0.26, 0.22, 0.75, 0.4), 0x3d5a45], [cyl(0.28, 0.28, 0.06, 0.8), 0x2b2f2c], [box(0.1, 0.04, 0.02, 0, 0.62, 0.27), 0xd8d2c0]],
  bollard: () => [[cyl(0.09, 0.09, 0.8, 0.4, 6), 0x4a4d52], [cyl(0.092, 0.092, 0.08, 0.66, 6), 0xe8e4d8]],
  rack: () => [-0.55, 0, 0.55].map((x) => [new THREE.TorusGeometry(0.3, 0.025, 4, 10, Math.PI).translate(x, 0.02, 0), 0x6b7078]),
  planter: () => [[box(1.1, 0.55, 1.1, 0, 0.275, 0), 0xb4ac9a], [box(1.0, 0.04, 1.0, 0, 0.56, 0), 0x5a4330], [new THREE.IcosahedronGeometry(0.46, 0).scale(1, 0.8, 1).translate(0, 0.88, 0), 0x4f9a48], [new THREE.IcosahedronGeometry(0.28, 0).translate(0.22, 1.1, 0.1), 0xe86a8a]],
  kiosk: () => [[box(2.2, 2.2, 2.2, 0, 1.1, 0), 0xdfd8c6], [box(2.5, 0.16, 2.5, 0, 2.3, 0), 0x3a5f7a], [box(1.4, 0.7, 0.04, 0, 1.3, 1.12), 0x1d2a33], [box(2.2, 0.12, 0.7, 0, 1.75, 1.4), 0xc6483c], [box(1.4, 0.08, 0.5, 0, 0.95, 1.35), 0x8a7a62]],
  stop: () => [[box(0.1, 2.9, 0.1, -1.4, 1.45, 0), 0x55606b], [box(0.1, 2.9, 0.1, 1.4, 1.45, 0), 0x55606b], [box(3.2, 0.14, 1.3, 0, 2.95, 0), 0x3c4a58], [box(2.9, 1.7, 0.05, 0, 1.6, -0.55), 0x9ec9d8], [box(1.8, 0.05, 0.45, 0, 0.5, -0.3), 0x7a5a3a], [box(0.7, 0.9, 0.06, 1.8, 2.3, 0.2), 0xf0c02a], [box(0.08, 2.4, 0.08, 1.8, 1.2, 0.2), 0x55606b]],
  sign: () => [[box(0.07, 2.6, 0.07, 0, 1.3, 0), 0x4a4d52], [box(0.9, 0.28, 0.05, 0, 2.5, 0.04), 0x2f6fb0], [box(0.8, 0.04, 0.06, 0, 2.5, 0.04), 0xf2efe6]],
};
// ── life that grows with the district (S0002 06): shopfronts, market stalls, a street musician ──
const SHOP_FRAME = (): Part[] => [[box(0.22, 3.3, 0.3, -1.85, 1.65, 0.1), 0x4a4d52], [box(0.22, 3.3, 0.3, 1.85, 1.65, 0.1), 0x4a4d52], [box(4.0, 0.5, 0.22, 0, 3.05, 0.12), 0x2b2f36], [box(3.5, 0.12, 0.34, -0.6, 0.45, 0.16), 0x8a8478], [box(1.2, 2.3, 0.1, 1.1, 1.15, 0.04), 0x3a3d44]];
const SHOP_AWNING = (): Part[] => [[new THREE.BoxGeometry(3.8, 0.08, 1.2).rotateX(0.28).translate(0, 2.6, 0.62), 0xffffff], [box(3.8, 0.3, 0.06, 0, 2.38, 1.17), 0xffffff]];
const SHOP_GLASS = (): Part[] => [[box(2.2, 1.6, 0.05, -0.6, 1.4, 0.12), 0xffffff], [box(0.9, 1.95, 0.05, 1.1, 1.08, 0.12), 0xffffff]];
const STALL_BODY = (): Part[] => [[box(2.4, 0.08, 1.2, 0, 0.9, 0), 0x8a6a45], [box(2.3, 0.78, 0.06, 0, 0.5, 0.55), 0xa98a5e],
  ...[[-1.2, -0.55], [1.2, -0.55], [-1.2, 0.55], [1.2, 0.55]].map(([x, z]): Part => [box(0.07, 2.4, 0.07, x, 1.2, z), 0x6b4f32]),
  [box(0.55, 0.2, 0.4, -0.8, 1.04, 0.1), 0xd84a3a], [box(0.55, 0.2, 0.4, -0.15, 1.04, 0.1), 0x5aa347], [box(0.55, 0.2, 0.4, 0.5, 1.04, 0.1), 0xe8b93a], [box(0.4, 0.3, 0.4, 0.95, 1.1, -0.2), 0xb88a52]];
const STALL_CANOPY = (): Part[] => [[new THREE.BoxGeometry(2.9, 0.06, 1.9).rotateX(0.14).translate(0, 2.42, 0), 0xffffff], [box(2.9, 0.22, 0.05, 0, 2.2, 0.93), 0xffffff]];
const BUSK_CASE = (): Part[] => [[box(0.9, 0.14, 0.38, 0, 0.07, 0), 0x1b1b1d], [box(0.8, 0.02, 0.28, 0, 0.145, 0), 0x7a2030], [box(0.12, 0.02, 0.1, 0.1, 0.16, 0), 0xe0b84a], [box(0.42, 0.5, 0.28, 1.0, 0.25, -0.1), 0x2a2a2a]];
const AWNING_COLORS = [0xc6483c, 0x2f6fb0, 0x3f8f4a, 0xe0a52a, 0x8a4aa8, 0xe8e4d8];
const glassMat = new THREE.MeshStandardMaterial({ color: 0x6f8ea0, emissive: 0xffc468, emissiveIntensity: 0, roughness: 0.25, metalness: 0.1 });
glowMats.push(glassMat);               // world.js lights these windows as night falls, like the shop windows of the procedural city
// What is out at each count of finished plots (index = plots, 0..5), as shares of what the scene could hold
export const LIFE_STEPS = { shops: [0, 3, 6, 10, 13, 16], stalls: [0, 0, 2, 4, 6, 8], musicians: [0, 0, 0, 1, 1, 2] };
const furnitureMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

function offsetLine(p: number[], off: number): number[] {         // polyline moved sideways by off metres (left of travel direction for off > 0)
  const out: number[] = [], n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = p[2 * b] - p[2 * a], dz = p[2 * b + 1] - p[2 * a + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    out.push(p[2 * i] - dz * off, p[2 * i + 1] + dx * off);
  }
  return out;
}
function lengthOf(p: number[]): number { let l = 0; for (let i = 2; i < p.length; i += 2) l += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return l; }
function dashes(b: Builder, p: number[], y: number, every = 3, len = 1.3, w = 0.12): void {
  let carry = 0;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = p[i], z0 = p[i + 1], dx = p[i + 2] - x0, dz = p[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 0.01) continue;
    const ux = dx / l, uz = dz / l, nx = -uz * w / 2, nz = ux * w / 2;
    for (let s = carry; s < l - len; s += every) {
      const a = [x0 + ux * s, z0 + uz * s], c = [x0 + ux * (s + len), z0 + uz * (s + len)];
      const A = [a[0] + nx, y, a[1] + nz], B = [a[0] - nx, y, a[1] - nz], C = [c[0] - nx, y, c[1] - nz], D = [c[0] + nx, y, c[1] + nz];
      b.tri(A, B, C, [0, 1, 0], () => [0, 0], new THREE.Color(MARK)); b.tri(A, C, D, [0, 1, 0], () => [0, 0], new THREE.Color(MARK));
    }
    carry = ((carry - l) % every + every) % every;
  }
}
function strip(b: Builder, p: number[], w: number, y: number, color: number): void {   // flat ribbon, vertex-coloured, no joints (lanes are gentle)
  const h = w / 2;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = p[i], z0 = p[i + 1], x1 = p[i + 2], z1 = p[i + 3], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz); if (l < 1e-3) continue;
    const nx = -dz / l * h, nz = dx / l * h, c = new THREE.Color(color);
    const A = [x0 + nx, y, z0 + nz], B = [x0 - nx, y, z0 - nz], C = [x1 - nx, y, z1 - nz], D = [x1 + nx, y, z1 + nz];
    b.tri(A, B, C, [0, 1, 0], () => [0, 0], c); b.tri(A, C, D, [0, 1, 0], () => [0, 0], c);
  }
}

// What the near ring hands to the street life: where to add, and the placement tests (inside a building, on the plaza, inside the extract minus a margin).
export interface LifeHost { group: THREE.Group; inBuilding: (x: number, z: number) => boolean; clearPlaza: (x: number, z: number) => boolean; bbIn: (x: number, z: number, m?: number) => boolean }
export interface Spot { x: number; z: number; rot: number; y?: number; mate?: boolean }
export interface LifeRoute { p: number[]; len: number; d: number }
export function buildStreetLife(osm: OsmExtract, kit: LevelAssets, { group, inBuilding, clearPlaza, bbIn }: LifeHost) {
  const basins = osm.water.filter((g) => Math.abs(polyArea(g.p)) < BASIN_MAX).map((g) => g.p);
  const nearBasin = (x: number, z: number, m: number): boolean => {
    for (const p of basins) {
      if (insideRing(p, x, z)) return true;
      for (let i = 0, n = p.length / 2; i < n; i++) {   // distance to each edge
        const j = (i + 1) % n, x0 = p[2 * i], z0 = p[2 * i + 1], dx = p[2 * j] - x0, dz = p[2 * j + 1] - z0, l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / l2));
        if (Math.hypot(x - x0 - dx * t, z - z0 - dz * t) < m) return true;
      }
    }
    return false;
  };
  const bikeLines: [number[], number][] = [];                 // [polyline, half width] of every bike lane: no furniture on them
  const onBike = (x: number, z: number): boolean => {
    for (const [p, h] of bikeLines) for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = p[i], z0 = p[i + 1], dx = p[i + 2] - x0, dz = p[i + 3] - z0, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / l2));
      if (Math.hypot(x - x0 - dx * t, z - z0 - dz * t) < h) return true;
    }
    return false;
  };
  const free = (x: number, z: number): boolean => bbIn(x, z, 10) && !clearPlaza(x, z) && !inBuilding(x, z) && !nearBasin(x, z, 2.5) && !onBike(x, z);

  // ── bike lanes ──
  const bikeB = new Builder(), markB = new Builder(), bikeRoutes: LifeRoute[] = [];
  const dOf = (p: number[]): number => { let d = 1e9; for (let i = 0; i < p.length; i += 2) d = Math.min(d, Math.hypot(p[i], p[i + 1])); return d; };
  for (const r of osm.roads) {
    if (r.bike !== 2 || lengthOf(r.p) < 20) continue;               // own cycle paths: red surface, dashed centre line
    bikeLines.push([r.p, r.w / 2 + 1.2]); strip(bikeB, r.p, r.w, LAYER.bike, BIKE_COLOR); dashes(markB, r.p, LAYER.mark);
    bikeRoutes.push({ p: r.p, len: lengthOf(r.p), d: dOf(r.p) });
  }
  // lanes on streets: tagged ones, else the main streets close to the square (the data has few cycle tags)
  let lanes = osm.roads.filter((r) => r.k === 'street' && r.bike === 1 && lengthOf(r.p) > 40);
  if (lanes.length < 5) {
    const extra = osm.roads.filter((r) => r.k === 'street' && !r.bike && r.w >= 7 && lengthOf(r.p) > 70).map((r) => ({ r, d: dOf(r.p) })).filter((o) => o.d > 22 && o.d < 190).sort((a, b) => a.d - b.d);
    lanes = lanes.concat(extra.slice(0, 5 - lanes.length).map((o) => o.r));
  }
  lanes.forEach((r, k) => {
    for (const side of [1, -1]) {
      const p0 = offsetLine(r.p, side * (r.w / 2 - 0.95)), p = side > 0 ? p0 : (() => { const q: number[] = []; for (let i = p0.length - 2; i >= 0; i -= 2) q.push(p0[i], p0[i + 1]); return q; })();   // travel with the traffic on each side
      bikeLines.push([p, 2]); strip(bikeB, p, 1.5, LAYER.bike, BIKE_COLOR);
      strip(markB, offsetLine(p, 0.8), 0.1, LAYER.mark, MARK);
      if (k < 4) bikeRoutes.push({ p, len: lengthOf(p), d: dOf(p) });
    }
  });
  if (!bikeB.empty) { const m = mesh(bikeB, layerMat(null, 'bike', { vertexColors: true, roughness: 0.95 }), group); (m as THREE.Mesh).name = 'bike-lanes'; }
  if (!markB.empty) mesh(markB, layerMat(null, 'mark', { vertexColors: true, roughness: 0.9 }), group);

  // ── furniture along the footways ──
  const items: Record<string, number[][]> = { bin: [], bollard: [], rack: [], planter: [], kiosk: [], stop: [], sign: [] }, benches: number[][] = [], sit: Spot[] = [], stand: Spot[] = [];
  const walks = osm.roads.filter((r) => (r.k === 'walk' || r.k === 'path') && !r.bike).map((r) => ({ r, d: dOf(r.p), len: lengthOf(r.p) })).filter((o) => o.len > 25 && o.d < 200).sort((a, b) => a.d - b.d);
  const KINDS = ['bench', 'bin', 'planter', 'bench', 'rack', 'bollard', 'bin', 'bench', 'planter'];
  let idx = 0, kiosks = 0;
  for (const { r } of walks) {
    if (items.bin.length + benches.length > 150) break;
    let acc = 8 + hash(r.p[0], r.p[1]) * 10;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 1) continue;
      const tx = dx / l, tz = dz / l, nx = -tz, nz = tx;
      for (let s = acc; s < l; s += 17 + hash(s, idx) * 8) {
        const kind = KINDS[idx++ % KINDS.length], side = (idx & 1) ? 1 : -1, off = r.w / 2 + 0.9;
        const x = x0 + tx * s + nx * off * side, z = z0 + tz * s + nz * off * side;
        if (!free(x, z)) continue;
        const faceRoad = Math.atan2(nx * side, nz * side);                   // direction towards the path
        if (kind === 'bench') {
          const th = Math.atan2(-tz, tx) + (side > 0 ? Math.PI : 0);          // long axis along the path, seat facing it
          benches.push([x, Y, z, th]);
          if (hash(x, z) < 0.6) sit.push({ x: x + tx * 0.4, z: z + tz * 0.4, rot: th, y: Y });
          if (hash(z, x) < 0.35) sit.push({ x: x - tx * 0.45, z: z - tz * 0.45, rot: th, y: Y });
        } else if (kind === 'rack') items.rack.push([x, Y, z, Math.atan2(-tz, tx)]);
        else items[kind].push([x, Y, z, faceRoad]);
        if (kind === 'planter' && hash(x, z) < 0.5) stand.push({ x: x + nx * -side * 1.6, z: z + nz * -side * 1.6, rot: faceRoad + Math.PI, mate: true });
        if (kiosks < 4 && hash(z, x) < 0.06 && Math.hypot(x, z) > 20) { items.kiosk.push([x + nx * side * 1.6, Y, z + nz * side * 1.6, faceRoad + Math.PI]); stand.push({ x: x + nx * side * 0.2, z: z + nz * side * 0.2, rot: faceRoad + Math.PI, mate: true }); kiosks++; }
      }
      acc = ((acc - l) % 20 + 20) % 20;
    }
  }
  // bollards around the basins, a few
  for (const p of basins) { for (let i = 0, n = p.length / 2; i < n; i += 3) { const x = p[2 * i], z = p[2 * i + 1], d = Math.hypot(x, z) || 1; const bx = x + (x / d) * 0.8, bz = z + (z / d) * 0.8; if (!clearPlaza(bx, bz) && bbIn(bx, bz, 10) && !inBuilding(bx, bz) && items.bollard.length < 80) items.bollard.push([bx, Y, bz, 0]); } }
  // bus stops and street signs on streets
  let stops = 0, signs = 0;
  for (const r of osm.roads.filter((q) => q.k === 'street' && q.w >= 6)) {
    const d = dOf(r.p); if (d < 25 || d > 190) continue;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 30) continue;
      const tx = dx / l, tz = dz / l, nx = -tz, nz = tx, side = hash(x0, z0) < 0.5 ? 1 : -1, off = r.w / 2 + 2.2;
      const x = x0 + tx * l * 0.5 + nx * off * side, z = z0 + tz * l * 0.5 + nz * off * side;
      if (!free(x, z)) continue;
      if (stops < 3 && l > 45) { items.stop.push([x, Y, z, Math.atan2(nx * side, nz * side) + Math.PI]); stops++; stand.push({ x: x + 0.2, z: z + 0.4, rot: Math.atan2(-nx * side, -nz * side), mate: false }); }
      else if (signs < 10) { items.sign.push([x0 + tx * 3 + nx * (r.w / 2 + 0.6) * side, Y, z0 + tz * 3 + nz * (r.w / 2 + 0.6) * side, Math.atan2(tx, tz)]); signs++; }
    }
  }
  // ── shopfronts on the walls beside the streets, market stalls and street musicians, nearest to the square first ──
  const taken = [...Object.values(items).flat(), ...benches].map((q) => [q[0], q[2]]);
  const clearOf = (x: number, z: number, m: number): boolean => taken.every(([a, b]) => Math.hypot(a - x, b - z) > m);
  const shopSpots: (Spot & { d: number })[] = [], spotRoads = osm.roads.filter((r) => r.k !== 'main' && r.k !== 'rail' && lengthOf(r.p) > 20).map((r) => ({ r, d: dOf(r.p) })).filter((q) => q.d < 170).sort((a, b) => a.d - b.d);
  for (const { r } of spotRoads) {
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 8) continue;
      const tx = dx / l, tz = dz / l;
      for (let s = 4 + hash(x0, z0) * 6; s < l - 3; s += 11 + hash(s, z0) * 5) for (const side of [1, -1]) {
        const nx = -tz * side, nz = tx * side, px = x0 + tx * s, pz = z0 + tz * s;
        for (let t = r.w / 2 + 1.2; t < r.w / 2 + 9; t += 0.6) {
          const wx = px + nx * t, wz = pz + nz * t; if (!bbIn(wx, wz, 12)) break;
          if (clearPlaza(wx, wz)) break;
          if (inBuilding(wx, wz)) {
            const fx = px + nx * (t - 0.35), fz = pz + nz * (t - 0.35);
            if (t > r.w / 2 + 1.8 && !onBike(fx, fz) && !nearBasin(fx, fz, 3) && shopSpots.every((q) => Math.hypot(q.x - fx, q.z - fz) > 9)) shopSpots.push({ x: fx, z: fz, rot: Math.atan2(-nx, -nz), d: Math.hypot(fx, fz) });
            break;
          }
        }
      }
    }
  }
  shopSpots.sort((a, b) => a.d - b.d); shopSpots.length = Math.min(shopSpots.length, 16);
  const cand: (Spot & { d: number })[] = [];
  for (const { r } of walks) {
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 6) continue;
      const tx = dx / l, tz = dz / l;
      for (let s = 3 + hash(z0, x0) * 5; s < l - 2; s += 13) {
        const side: number = ((cand.length + i) & 1) ? 1 : -1, off = r.w / 2 + 2.6, x: number = x0 + tx * s - tz * side * off, z = z0 + tz * s + tx * side * off;
        if (free(x, z) && clearOf(x, z, 3.5) && Math.hypot(x, z) > 13 && cand.every((q) => Math.hypot(q.x - x, q.z - z) > 7)) cand.push({ x, z, rot: Math.atan2(tz * side, -tx * side) + Math.PI, d: Math.hypot(x, z) });
      }
    }
  }
  cand.sort((a, b) => a.d - b.d);
  const roomy = (q: Spot): boolean => { let k = 0; for (let a = 0; a < 8; a++) if (free(q.x + Math.cos(a * 0.785) * 3.6, q.z + Math.sin(a * 0.785) * 3.6)) k++; return k >= 7; };   // room for an audience
  const roomyList = cand.filter((q) => roomy(q)), musicians = [roomyList[1] || roomyList[0], roomyList[4]].filter((q, i, a) => q && a.indexOf(q) === i), stalls = cand.filter((q) => !musicians.includes(q)).slice(0, 8);
  const batch = (name: string, parts: () => Part[], list: Spot[], tint: boolean, shadow = false): THREE.InstancedMesh | null => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(mergeParts(parts()), name.includes('glass') ? glassMat : furnitureMat, list.length), c = new THREE.Color();
    list.forEach((q, i) => { o.position.set(q.x, Y, q.z); o.rotation.set(0, q.rot, 0); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (tint) im.setColorAt(i, c.setHex(AWNING_COLORS[(i * 5 + 1) % AWNING_COLORS.length])); });
    im.castShadow = shadow; im.receiveShadow = true; im.name = name; im.frustumCulled = false; group.add(im); return im;
  };
  const o = new THREE.Object3D();
  const shopIm = [batch('shop-frame', SHOP_FRAME, shopSpots, false), batch('shop-awning', SHOP_AWNING, shopSpots, true), batch('shop-glass', SHOP_GLASS, shopSpots, false)].filter((m): m is THREE.InstancedMesh => !!m);
  const stallIm = [batch('stall-body', STALL_BODY, stalls, false, true), batch('stall-canopy', STALL_CANOPY, stalls, true)].filter((m): m is THREE.InstancedMesh => !!m);
  const buskIm = [batch('busker-props', BUSK_CASE, musicians, false)].filter((m): m is THREE.InstancedMesh => !!m);
  const life = {
    shown: { shops: 0, stalls: 0, musicians: 0 }, stalls, musicians,
    // n = finished plots of the district (0-5): what is out in the street
    setProgress(this: { shown: { shops: number; stalls: number; musicians: number } }, n: number) {
      const k = Math.max(0, Math.min(5, Math.round(n)));
      const set = (ims: THREE.InstancedMesh[], want: number, have: number): number => { const c = Math.min(want, have); for (const im of ims) im.count = c; return c; };
      this.shown.shops = set(shopIm, LIFE_STEPS.shops[k], shopSpots.length); this.shown.stalls = set(stallIm, LIFE_STEPS.stalls[k], stalls.length); this.shown.musicians = set(buskIm, LIFE_STEPS.musicians[k], musicians.length);
      return this.shown;
    },
  };
  for (const [name, list] of Object.entries(items)) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(mergeParts(SHAPES[name]()), furnitureMat, list.length);
    list.forEach(([x, y, z, r], i) => { o.position.set(x, y, z); o.rotation.set(0, r, 0); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = true; im.receiveShadow = true; im.name = 'furniture-' + name; group.add(im);
  }
  instanceKit(kit.bench, benches, 0, group, { lengthFit: 2.0 });
  return { sit, stand, bikeRoutes, basins, events: life, counts: { benches: benches.length, ...Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.length])), lanes: lanes.length, shops: shopSpots.length, stalls: stalls.length, musicians: musicians.length } };
}
