// Street furniture and bike lanes for an OpenStreetMap near ring: benches, bins, bike racks, bollards, planters, kiosks,
// bus stops and street signs (own low-poly, instanced), red bike lanes with white markings, and the spots where people
// sit, stand and cyclists ride. Returns data for People (js/fx.js): { sit, stand, bikeRoutes, basins }.
import * as THREE from 'three';
import { glowMats } from './world.js';
import { Builder, LAYER, layerMat, mergeParts, mesh, instanceKit } from './near-ring.js';
import type { Plan } from './core/placement.js';
import type { LevelAssets, OsmExtract } from './types.js';

const Y = 0.05;                       // ground height of the footways
const BIKE_COLOR = 0xa8483c, MARK = 0xf2efe6;
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
  sign: () => [[box(0.07, 2.6, 0.07, 0, 1.3, 0), 0x4a4d52]]   // the name plate is drawn by js/street-detail.ts,
};
// ── life that grows with the district (S0002 06): shopfronts, cafe terraces, a street musician ──
const SHOP_FRAME = (): Part[] => [[box(0.22, 3.3, 0.3, -1.85, 1.65, 0.1), 0x4a4d52], [box(0.22, 3.3, 0.3, 1.85, 1.65, 0.1), 0x4a4d52], [box(4.0, 0.5, 0.22, 0, 3.05, 0.12), 0x2b2f36], [box(3.5, 0.12, 0.34, -0.6, 0.45, 0.16), 0x8a8478], [box(1.2, 2.3, 0.1, 1.1, 1.15, 0.04), 0x3a3d44]];
const SHOP_AWNING = (): Part[] => [[new THREE.BoxGeometry(3.8, 0.08, 1.2).rotateX(0.28).translate(0, 2.6, 0.62), 0xffffff], [box(3.8, 0.3, 0.06, 0, 2.38, 1.17), 0xffffff]];
const SHOP_GLASS = (): Part[] => [[box(2.2, 1.6, 0.05, -0.6, 1.4, 0.12), 0xffffff], [box(0.9, 1.95, 0.05, 1.1, 1.08, 0.12), 0xffffff]];
// A cafe terrace as on Hlavna in summer: two round tables, four chairs (seat 0.5 m) and one big parasol; local +z faces the street
const TERRACE_SET = (): Part[] => [[cyl(0.04, 0.04, 2.45, 1.22, 6), 0xd8d2c0],
  ...[-0.8, 0.8].flatMap((x): Part[] => [[cyl(0.36, 0.36, 0.04, 0.74, 10), 0x3a3d44], [cyl(0.04, 0.04, 0.72, 0.37, 6), 0x2b2f36],
    ...[-0.62, 0.62].flatMap((z): Part[] => [[box(0.4, 0.05, 0.4, x, 0.47, z), 0x6b4f32], [box(0.4, 0.45, 0.05, x, 0.72, z + Math.sign(z) * 0.18), 0x6b4f32],
      ...[[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].map(([dx, dz]): Part => [box(0.04, 0.45, 0.04, x + dx, 0.225, z + dz), 0x2b2f36])]),
    [cyl(0.07, 0.07, 0.12, 0.8, 6), 0xe8e4d8]])];
const TERRACE_PARASOL = (): Part[] => [[new THREE.ConeGeometry(1.5, 0.5, 8).translate(0, 2.7, 0), 0xffffff], [cyl(0.05, 0.05, 0.1, 2.98, 6), 0xd8d2c0]];
const BUSK_CASE = (): Part[] => [[box(0.9, 0.14, 0.38, 0, 0.07, 0), 0x1b1b1d], [box(0.8, 0.02, 0.28, 0, 0.145, 0), 0x7a2030], [box(0.12, 0.02, 0.1, 0.1, 0.16, 0), 0xe0b84a], [box(0.42, 0.5, 0.28, 1.0, 0.25, -0.1), 0x2a2a2a]];
const AWNING_COLORS = [0xc6483c, 0x2f6fb0, 0x3f8f4a, 0xe0a52a, 0x8a4aa8, 0xe8e4d8];
const glassMat = new THREE.MeshStandardMaterial({ color: 0x6f8ea0, emissive: 0xffc468, emissiveIntensity: 0, roughness: 0.25, metalness: 0.1 });
glowMats.push(glassMat);               // world.js lights these windows as night falls, like the shop windows of the procedural city
// What is out at each count of finished plots (index = plots, 0..5), as shares of what the scene could hold
export const LIFE_STEPS = { shops: [0, 3, 6, 10, 13, 16], terraces: [0, 0, 2, 4, 6, 8], musicians: [0, 0, 0, 0, 1, 1] };
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

// What the near ring hands to the street life: where to add, and the plan (js/core/placement.ts) that says where everything stands.
export interface LifeHost { group: THREE.Group; plan: Plan }
export interface Spot { x: number; z: number; rot: number; y?: number; mate?: boolean }
export interface LifeRoute { p: number[]; len: number; d: number }
export function buildStreetLife(osm: OsmExtract, kit: LevelAssets, { group, plan }: LifeHost) {
  const basins = plan.site.basins.map((b) => b.r);
  // ── bike lanes: the planned pieces, already cut at houses and water ──
  const bikeB = new Builder(), markB = new Builder();
  for (const l of plan.bikeLanes) {
    strip(bikeB, l.p, l.w, LAYER.bike, BIKE_COLOR);
    if (l.cycleway) dashes(markB, l.p, LAYER.mark); else strip(markB, offsetLine(l.p, 0.8), 0.1, LAYER.mark, MARK);
  }
  const bikeRoutes: LifeRoute[] = plan.bikeRoutes;
  if (!bikeB.empty) { const m = mesh(bikeB, layerMat(null, 'bike', { vertexColors: true, roughness: 0.95 }), group); (m as THREE.Mesh).name = 'bike-lanes'; }
  if (!markB.empty) mesh(markB, layerMat(null, 'mark', { vertexColors: true, roughness: 0.9 }), group);

  // ── furniture along the footways, seats and standing spots ──
  const { items, benches } = plan, sit: Spot[] = plan.sit.map((q) => ({ ...q, y: Y })), stand: Spot[] = plan.stand;
  const shopSpots = plan.shops, terraces: Spot[] = plan.terraces, musicians: Spot[] = plan.musicians;
  const batch = (name: string, parts: () => Part[], list: Spot[], tint: boolean, shadow = false): THREE.InstancedMesh | null => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(mergeParts(parts()), name.includes('glass') ? glassMat : furnitureMat, list.length), c = new THREE.Color();
    list.forEach((q, i) => { o.position.set(q.x, Y, q.z); o.rotation.set(0, q.rot, 0); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (tint) im.setColorAt(i, c.setHex(AWNING_COLORS[(i * 5 + 1) % AWNING_COLORS.length])); });
    im.castShadow = shadow; im.receiveShadow = true; im.name = name; im.frustumCulled = false; group.add(im); return im;
  };
  const o = new THREE.Object3D();
  const shopIm = [batch('shop-frame', SHOP_FRAME, shopSpots, false), batch('shop-awning', SHOP_AWNING, shopSpots, true), batch('shop-glass', SHOP_GLASS, shopSpots, false)].filter((m): m is THREE.InstancedMesh => !!m);
  const terraceIm = [batch('terrace-set', TERRACE_SET, terraces, false, true), batch('terrace-parasol', TERRACE_PARASOL, terraces, true, true)].filter((m): m is THREE.InstancedMesh => !!m);
  const buskIm = [batch('busker-props', BUSK_CASE, musicians, false)].filter((m): m is THREE.InstancedMesh => !!m);
  const life = {
    shown: { shops: 0, terraces: 0, musicians: 0 }, terraces, musicians,
    // n = finished plots of the district (0-5): what is out in the street
    setProgress(this: { shown: { shops: number; terraces: number; musicians: number } }, n: number) {
      const k = Math.max(0, Math.min(5, Math.round(n)));
      const set = (ims: THREE.InstancedMesh[], want: number, have: number): number => { const c = Math.min(want, have); for (const im of ims) im.count = c; return c; };
      this.shown.shops = set(shopIm, LIFE_STEPS.shops[k], shopSpots.length); this.shown.terraces = set(terraceIm, LIFE_STEPS.terraces[k], terraces.length); this.shown.musicians = set(buskIm, LIFE_STEPS.musicians[k], musicians.length);
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
  return { sit, stand, bikeRoutes, basins, events: life, counts: { benches: benches.length, ...Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.length])), lanes: plan.bikeLanes.filter((l) => !l.cycleway).length, shops: shopSpots.length, terraces: terraces.length, musicians: musicians.length } };
}
