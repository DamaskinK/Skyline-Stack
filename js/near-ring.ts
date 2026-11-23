// The near ring of a level: real streets, building footprints, parks and water from OpenStreetMap (assets/levels/<id>/osm.json,
// made by scripts/build-osm-level.mjs), with CC0 kit props (street lights, bushes, parked cars) instanced.
// Frame: 1 unit = 1 m, x east, z south, origin = build site = tower. A small paved plaza stays clear around the tower.
// Draw calls: ground layers, one wall mesh per facade variant, one roof mesh, a few instanced props.
import * as THREE from 'three';
import { calmFacade, STOREY_W, STOREY_H, roofTex, tileRoofTex, sidewalkTex, canvas2d, toTex } from './textures.js';
import { glowMats, GROUND_Y } from './world.js';
import { buildStreetLife } from './street-life.js';
import { surface } from './surfaces.js';
import { addTrees, addHedges, addFlowerBeds } from './vegetation.js';
import { settings } from './settings.js';
import { cutPolyline } from './core/tram-route.js';
import { buildTramLine } from './trams.js';
import type { LevelAssets, OsmExtract, OsmPoly } from './types.js';

export const OLD_PALETTE = [0xefe2c4, 0xe8c9b4, 0xe9d89a, 0xc9ddc6, 0xc3d2de, 0xe4a99a, 0xf0ebe0];   // pastel plaster of the historic centre
export const PLAIN_PALETTE = [0xe6e1d6, 0xd6d9d2, 0xdcd3c1];
export const ROOF_COLORS = [0xb4573c, 0xa84c36, 0x9a5a44, 0x8a4a3a, 0xc0623f, 0x7d5a4c, 0xb0523a].map((c) => new THREE.Color(c));
export const PLAZA_HALF = 14;      // paved square around the tower
export const PAD_HALF = PLAZA_HALF + 2;   // nothing of the street network (roads, footways, rails, bike lanes, basins) enters this square: the foundation stands on bare plaza
const CLEAR = 24;                  // no buildings closer than this to the origin

// ground heights: every layer a real step above the one below, plus a depth bias for the far distance
export const LAYER = { urban: 0.005, park: 0.015, water: 0.02, road: 0.03, lot: 0.034, bed: 0.038, path: 0.045, bike: 0.055, mark: 0.065, plaza: GROUND_Y.walk };   // bike lanes and their paint sit above roads and footways, never in the same plane
const BIAS = { urban: 1, park: 2, water: 3, road: 4, lot: 4.5, bed: 5, path: 5.2, plaza: 7, basin: 9, bike: 6, mark: 8 };   // the plaza top always wins over the flat layers around it
// park grass: soft green with random specks (the shared grass texture has specks on a lattice that read as dashed lines)
const parkGrass = (() => {
  const [c, x] = canvas2d(128, 128); x.fillStyle = '#76a35e'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { x.fillStyle = hash(i, 3) > 0.5 ? 'rgba(40,90,30,.16)' : 'rgba(190,225,140,.16)'; x.fillRect(hash(i, 1) * 128, hash(i, 2) * 128, 2, 3); }
  return toTex(c, true);
})();
const BASIN_MAX = 1500;            // m2: water polygons smaller than this are fountains / pools (basin with a rim), larger ones are river
const CURB_COLOR = new THREE.Color(0xb9b4a8), RIM_COLOR = new THREE.Color(0xa8a498);

// ── tiny geometry builder (non-indexed, world-space uv) ──
export type Vec = number[];                                      // [x, y, z] (or [x, z]) in metres
export type UvFn = (p: Vec) => [number, number];
export class Builder {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = [];
  tri(a: Vec, b: Vec, c: Vec, n: Vec, uvf: UvFn, color?: THREE.Color): void {
    // flip the winding when the geometric normal points away from n
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    if (gx * n[0] + gy * n[1] + gz * n[2] < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); const t = uvf(p); this.uv.push(t[0], t[1]); if (color) this.col.push(color.r, color.g, color.b); }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
  get empty(): boolean { return this.pos.length === 0; }
}
const UP: Vec = [0, 1, 0];

export function polyArea(p: number[]): number { let a = 0; for (let i = 0, n = p.length / 2; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; }
export function fillPoly(b: Builder, p: number[], y: number, scale: number, n: Vec = UP, grow = 0): void {
  const pts: THREE.Vector2[] = []; for (let i = 0; i < p.length; i += 2) pts.push(new THREE.Vector2(p[i], p[i + 1]));
  if (pts.length < 3) return;
  const tris = THREE.ShapeUtils.triangulateShape(pts, []);
  const uvf: UvFn = (q) => [q[0] / scale, q[2] / scale];
  // grow: push every triangle outwards by a few cm so T-junction cracks between neighbours never show the layer below
  const gp = (a: THREE.Vector2, c: { x: number; y: number }): Vec => { if (!grow) return [a.x, y, a.y]; const dx = a.x - c.x, dz = a.y - c.y, d = Math.hypot(dx, dz) || 1; return [a.x + dx / d * grow, y, a.y + dz / d * grow]; };
  for (const [i, j, k] of tris) {
    const c = { x: (pts[i].x + pts[j].x + pts[k].x) / 3, y: (pts[i].y + pts[j].y + pts[k].y) / 3 };
    b.tri(gp(pts[i], c), gp(pts[j], c), gp(pts[k], c), n, uvf);
  }
}
// a polyline with a width, as a flat ribbon with round-ish joints; same height and material everywhere, so overlaps are invisible
export function ribbon(b: Builder, p: number[], w: number, y: number, scale: number): void {
  const uvf: UvFn = (q) => [q[0] / scale, q[2] / scale], h = w / 2;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = p[i], z0 = p[i + 1], x1 = p[i + 2], z1 = p[i + 3], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz);
    if (l < 1e-3) continue;
    const nx = -dz / l * h, nz = dx / l * h;
    const A = [x0 + nx, y, z0 + nz], B = [x0 - nx, y, z0 - nz], C = [x1 - nx, y, z1 - nz], D = [x1 + nx, y, z1 + nz];
    b.tri(A, B, C, UP, uvf); b.tri(A, C, D, UP, uvf);
  }
  for (let i = 2; i + 2 < p.length; i += 2) {                   // joint at real bends only: a hexagon hides the wedge gap on the outside
    const ax = p[i] - p[i - 2], az = p[i + 1] - p[i - 1], bx = p[i + 2] - p[i], bz = p[i + 3] - p[i + 1];
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    if (la < 1e-3 || lb < 1e-3 || (ax * bx + az * bz) / (la * lb) > 0.985) continue;
    const c = [p[i], y, p[i + 1]];
    for (let k = 0; k < 6; k++) {
      const a0 = k / 6 * Math.PI * 2, a1 = (k + 1) / 6 * Math.PI * 2;
      b.tri(c, [c[0] + Math.cos(a0) * h, y, c[2] + Math.sin(a0) * h], [c[0] + Math.cos(a1) * h, y, c[2] + Math.sin(a1) * h], UP, uvf);
    }
  }
}
// a straight upright prism along an edge (width w, from y0 to y1), extended by w/2 at both ends so corners close; vertex-coloured
export function stripe(b: Builder, x0: number, z0: number, x1: number, z1: number, w: number, y0: number, y1: number, color: THREE.Color): void {
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz); if (l < 1e-3) return;
  const ux = dx / l, uz = dz / l, nx = -uz * w / 2, nz = ux * w / 2, e = w / 2;
  const a = [x0 - ux * e, z0 - uz * e], c = [x1 + ux * e, z1 + uz * e], k: UvFn = () => [0, 0];
  const P = (q: number[], s: number, y: number): Vec => [q[0] + nx * s, y, q[1] + nz * s];
  const quad = (A: Vec, B: Vec, C: Vec, D: Vec, n: Vec) => { b.tri(A, B, C, n, k, color); b.tri(A, C, D, n, k, color); };
  quad(P(a, 1, y1), P(a, -1, y1), P(c, -1, y1), P(c, 1, y1), UP);
  quad(P(a, 1, y0), P(c, 1, y0), P(c, 1, y1), P(a, 1, y1), [-uz, 0, ux]);
  quad(P(a, -1, y0), P(a, -1, y1), P(c, -1, y1), P(c, -1, y0), [uz, 0, -ux]);
  quad(P(a, -1, y0), P(a, 1, y0), P(a, 1, y1), P(a, -1, y1), [-ux, 0, -uz]);
  quad(P(c, -1, y0), P(c, -1, y1), P(c, 1, y1), P(c, 1, y0), [ux, 0, uz]);
}
export function hash(x: number, z: number): number { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
export const insideRing = (p: number[], x: number, z: number): boolean => { let c = false; for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) { const xi = p[2 * i], zi = p[2 * i + 1], xj = p[2 * j], zj = p[2 * j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };

export function material(map: THREE.Texture | null, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial { const m = new THREE.MeshStandardMaterial({ map, roughness: 1, ...o }); return m; }
export function layerMat(map: THREE.Texture | null, key: keyof typeof BIAS, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const m = material(map, o); m.polygonOffset = true; m.polygonOffsetFactor = -BIAS[key]; m.polygonOffsetUnits = -BIAS[key]; return m;
}
export const tile = (t: THREE.Texture, rep = 1): THREE.Texture => { const c = t.clone(); c.repeat.set(rep, rep); c.needsUpdate = true; return c; };
export function mesh(b: Builder, mat: THREE.Material, group: THREE.Object3D, shadow = false): THREE.Mesh | null {
  if (b.empty) return null;
  const m = new THREE.Mesh(b.geometry(), mat); m.receiveShadow = true; m.castShadow = shadow; group.add(m); return m;
}

// ── kit props: one InstancedMesh per sub-mesh of the glTF, so a piece is a draw call or two however often it is placed ──
export function instanceKit(src: THREE.Object3D | null | undefined, list: number[][], targetHeight: number, group: THREE.Object3D, { shadow = true, lengthFit = 0 } = {}): THREE.InstancedMesh[] {
  const made: THREE.InstancedMesh[] = [];
  if (!src || !list.length) return made;
  const root = src.clone(true); root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const k = lengthFit ? lengthFit / Math.max(size.x, size.z, 1e-3) : targetHeight / Math.max(size.y, 1e-3);
  const base = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  root.traverse((o) => {
    const sm = o as THREE.Mesh;
    if (!sm.isMesh) return;
    const im = new THREE.InstancedMesh(sm.geometry, sm.material, list.length);
    base.copy(sm.matrixWorld);
    list.forEach(([x, y, z, r], i) => {
      place.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, r), new THREE.Vector3(k, k, k));
      im.setMatrixAt(i, place.clone().multiply(base));
    });
    im.castShadow = shadow; im.receiveShadow = true; group.add(im); made.push(im);
  });
  return made;
}

const calmMats = new Map<string, THREE.MeshStandardMaterial>();
// shared by the near and middle ring: one material per kind / colour / lit-window variant
export function calmMat(hex: number, kind: string, v = 0, vc = false): THREE.MeshStandardMaterial {
  const k = `${hex}-${kind}-${v}-${vc ? 1 : 0}`;
  if (!calmMats.has(k)) {
    const fa = calmFacade(hex, kind, v);
    // plaster relief from a CC0 normal map; vc: the mesh carries a small per-building tint in its vertex colours
    const m = new THREE.MeshStandardMaterial({ map: fa.map, emissiveMap: fa.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9, vertexColors: vc, ...surface('plaster', [3, 2], 0.7) });
    glowMats.push(m); calmMats.set(k, m);
  }
  return calmMats.get(k) as THREE.MeshStandardMaterial;
}
function hullArea(p: number[]): number {
  const pts: [number, number][] = []; for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const hull: [number, number][] = [];
  for (const q of pts) { while (hull.length >= 2 && cr(hull[hull.length - 2], hull[hull.length - 1], q) <= 0) hull.pop(); hull.push(q); }
  const lo = hull.length + 1;
  for (let i = pts.length - 2; i >= 0; i--) { const q = pts[i]; while (hull.length >= lo && cr(hull[hull.length - 2], hull[hull.length - 1], q) <= 0) hull.pop(); hull.push(q); }
  hull.pop();
  let a = 0; for (let i = 0; i < hull.length; i++) { const j = (i + 1) % hull.length; a += hull[i][0] * hull[j][1] - hull[j][0] * hull[i][1]; }
  return Math.abs(a) / 2;
}
const convexish = (p: number[], area: number): boolean => area > 12 && area / Math.max(1, hullArea(p)) > 0.86;
// hip roof over a roughly convex footprint: the ridge runs along the long axis, eave ring at height h
export function pitchedRoof(b: Builder, p: number[], h: number, color: THREE.Color, rhFixed = 0, eave = 0): void {
  const n = p.length / 2; let cx = 0, cz = 0, sxx = 0, szz = 0, sxz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; } cx /= n; cz /= n;
  for (let i = 0; i < n; i++) { const dx = p[2 * i] - cx, dz = p[2 * i + 1] - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), c = Math.cos(th), s = Math.sin(th);
  let hu = 0, hv = 0;
  for (let i = 0; i < n; i++) { const dx = p[2 * i] - cx, dz = p[2 * i + 1] - cz; hu = Math.max(hu, Math.abs(dx * c + dz * s)); hv = Math.max(hv, Math.abs(-dx * s + dz * c)); }
  let ax: [number, number] = [c, s]; if (hv > hu) { ax = [-s, c]; [hu, hv] = [hv, hu]; }
  const rh = rhFixed || Math.min(5.5, Math.max(1.6, hv * 0.7)), rl = Math.max(0, hu - hv);
  const E: Vec[] = [], T: Vec[] = [], sg = polyArea(p) >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const dx = p[2 * i] - cx, dz = p[2 * i + 1] - cz, u = Math.max(-rl, Math.min(rl, dx * ax[0] + dz * ax[1]));
    let ox = 0, oz = 0, oy = h;
    if (eave) {                                   // eaves: the eave ring is pushed out along the mitred edge normals and dips a little
      const q = (i + n - 1) % n, j = (i + 1) % n;
      for (const [a, c] of [[q, i], [i, j]]) { const ex = p[2 * c] - p[2 * a], ez = p[2 * c + 1] - p[2 * a + 1], l = Math.hypot(ex, ez) || 1; ox += ez / l * sg; oz += -ex / l * sg; }
      const ml = Math.hypot(ox, oz) || 1, k = eave / Math.max(0.55, ml / 2); ox = ox / ml * k; oz = oz / ml * k; oy = h - eave * 0.3;
    }
    E.push([p[2 * i] + ox, oy, p[2 * i + 1] + oz]); T.push([cx + ax[0] * u, h + rh, cz + ax[1] * u]);
  }
  const uvf: UvFn = (q) => [q[0] / 4, q[2] / 4];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ex = E[j][0] - E[i][0], ez = E[j][2] - E[i][2];
    for (const [A, B, C] of [[E[i], E[j], T[j]], [E[i], T[j], T[i]]]) {
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz); if (l < 1e-6) continue;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      b.tri(A, B, C, [nx / l, ny / l, nz / l], uvf, color);
    }
    if (eave) {                                   // fascia board under the eave edge, a shade darker
      const d = color.clone().multiplyScalar(0.72), ex = E[j][0] - E[i][0], ez = E[j][2] - E[i][2], l = Math.hypot(ex, ez) || 1, nn = [ez / l * sg, 0, -ex / l * sg];
      const lo = (q: Vec): Vec => [q[0], q[1] - 0.28, q[2]];
      b.tri(E[i], E[j], lo(E[j]), nn, uvf, d); b.tri(E[i], lo(E[j]), lo(E[i]), nn, uvf, d);
    }
  }
}

// A box that sticks out of a wall: `u0..u1` along the wall from its start (unit vector t), `y0..y1` up, `out` metres along the outward normal n.
// Five faces (the one against the wall is hidden), vertex-coloured; merged by the caller into one relief mesh.
const NO_UV: UvFn = () => [0, 0];
function wallBox(b: Builder, x0: number, z0: number, t: Vec, n: Vec, u0: number, u1: number, y0: number, y1: number, out: number, color: THREE.Color): void {
  const P = (u: number, y: number, o: number): Vec => [x0 + t[0] * u + n[0] * o, y, z0 + t[1] * u + n[2] * o];
  const quad = (A: Vec, B: Vec, C: Vec, D: Vec, nn: Vec) => { b.tri(A, B, C, nn, NO_UV, color); b.tri(A, C, D, nn, NO_UV, color); };
  quad(P(u0, y0, out), P(u1, y0, out), P(u1, y1, out), P(u0, y1, out), n);
  quad(P(u0, y1, 0), P(u0, y1, out), P(u1, y1, out), P(u1, y1, 0), UP);
  quad(P(u0, y0, 0), P(u1, y0, 0), P(u1, y0, out), P(u0, y0, out), [0, -1, 0]);
  quad(P(u0, y0, 0), P(u0, y0, out), P(u0, y1, out), P(u0, y1, 0), [-t[0], 0, -t[1]]);
  quad(P(u1, y0, 0), P(u1, y1, 0), P(u1, y1, out), P(u1, y0, out), [t[0], 0, t[1]]);
}
// Window frame layout of the two calm facade kinds (matches calmFacade in textures.js): sill and lintel boxes and side jambs.
// Fractions of one storey tile; two windows at 1/4 and 3/4 of the tile width.
const WIN = {
  old:   { w: 1.4, sillY: 0.62, sillH: 0.13, sillOut: 0.2, lintelY: 2.62, lintelH: 0.16, lintelOut: 0.16, jamb: 0.1, jambY0: 0.75, jambY1: 2.6, jambOut: 0.07 },
  plain: { w: 2.05, sillY: 0.8, sillH: 0.11, sillOut: 0.15, lintelY: 2.49, lintelH: 0.12, lintelOut: 0.1, jamb: 0.09, jambY0: 0.9, jambY1: 2.48, jambOut: 0.05 },
};

// The street network without the pad square around the tower (ticket S0002 10: no road, footway, rail or bike lane under the foundation);
// rails are also cut where the extract ends, so a line never floats over the middle ring.
function trimNetwork(osm: OsmExtract): OsmExtract {
  const pad: [number, number, number, number] = [-PAD_HALF, -PAD_HALF, PAD_HALF, PAD_HALF], edge: [number, number, number, number] = [-osm.half, -osm.half, osm.half, osm.half];
  const outPad = (x: number, z: number): boolean => !(Math.abs(x) < PAD_HALF && Math.abs(z) < PAD_HALF);
  const roads: OsmExtract['roads'] = [];
  for (const r of osm.roads) for (const p of cutPolyline(r.p, [pad], outPad)) roads.push(p.length === r.p.length ? r : { ...r, p });
  const rails: OsmPoly[] = [];
  for (const r of osm.rails || []) for (const p of cutPolyline(r.p, [pad, edge], (x, z) => outPad(x, z) && Math.abs(x) < osm.half && Math.abs(z) < osm.half)) rails.push({ p });
  const small = (g: OsmPoly) => Math.abs(polyArea(g.p)) < BASIN_MAX, touchesPad = (g: OsmPoly) => { for (let i = 0; i < g.p.length; i += 2) if (Math.abs(g.p[i]) < PAD_HALF + 2 && Math.abs(g.p[i + 1]) < PAD_HALF + 2) return true; return insideRing(g.p, 0, 0); };
  return { ...osm, roads, rails, water: osm.water.filter((g) => !(small(g) && touchesPad(g))) };
}

export function buildNearRing(osm0: OsmExtract, kit: LevelAssets = {}, hide: Set<string> | null = null): THREE.Group {
  const osm = trimNetwork(osm0);
  const group = new THREE.Group(); group.name = 'near-ring';
  const bbIn = (x: number, z: number, m = 0): boolean => Math.abs(x) < osm.half - m && Math.abs(z) < osm.half - m;

  // ── ground ──
  const urban = new Builder(), park = new Builder(), water = new Builder(), road = new Builder(), path = new Builder();
  const H = osm.half;
  fillPoly(urban, [-H, -H, H, -H, H, H, -H, H], LAYER.urban, 6);
  for (const g of osm.parks) { if (polyArea(g.p) !== 0) fillPoly(park, g.p, LAYER.park, 8, UP, 0.05); }
  const curbs = new Builder(), basinWater = new Builder();
  const inPlaza = (x: number, z: number) => Math.abs(x) < PLAZA_HALF + 0.6 && Math.abs(z) < PLAZA_HALF + 0.6;
  // water: river and big lakes stay a flat surface; small water (fountains, pools) is a basin: stone rim, water a little below its top
  for (const g of osm.water) {
    if (Math.abs(polyArea(g.p)) >= BASIN_MAX) { fillPoly(water, g.p, LAYER.water, 8, UP, 0.05); continue; }
    fillPoly(basinWater, g.p, 0.32, 8, UP, 0.05);
    for (let i = 0, n = g.p.length / 2; i < n; i++) { const j = (i + 1) % n; stripe(curbs, g.p[2 * i], g.p[2 * i + 1], g.p[2 * j], g.p[2 * j + 1], 0.9, 0, 0.55, RIM_COLOR); }
  }
  // parks get a low kerb, except where the edge lies inside another park (overlapping OSM polygons) or under the plaza
  const pbox = osm.parks.map((g) => { let a: number[] = [1e9, 1e9, -1e9, -1e9]; for (let i = 0; i < g.p.length; i += 2) { a = [Math.min(a[0], g.p[i]), Math.min(a[1], g.p[i + 1]), Math.max(a[2], g.p[i]), Math.max(a[3], g.p[i + 1])]; } return a; });
  osm.parks.forEach((g, gi) => {
    if (Math.abs(polyArea(g.p)) < 30) return;
    for (let i = 0, n = g.p.length / 2; i < n; i++) {
      const j = (i + 1) % n, x0 = g.p[2 * i], z0 = g.p[2 * i + 1], x1 = g.p[2 * j], z1 = g.p[2 * j + 1], mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (inPlaza(mx, mz)) continue;
      let covered = false;
      for (let k = 0; k < osm.parks.length && !covered; k++) { const bx = pbox[k]; if (k !== gi && mx > bx[0] && mx < bx[2] && mz > bx[1] && mz < bx[3] && Math.abs(polyArea(osm.parks[k].p)) >= 30 && insideRing(osm.parks[k].p, mx, mz)) covered = true; }
      if (!covered) stripe(curbs, x0, z0, x1, z1, 0.3, 0, 0.14, CURB_COLOR);
    }
  });
  for (const r of osm.roads) {
    if (r.k === 'walk' || r.k === 'path') ribbon(path, r.p, r.w, LAYER.path, 3);
    else ribbon(road, r.p, r.w, LAYER.road, 9);
  }
  // car parks: asphalt a few cm above the streets, so a lot that overlaps a street or a park never shares its plane
  const lot = new Builder();
  for (const g of osm.parking || []) if (Math.abs(polyArea(g.p)) > 40) fillPoly(lot, g.p, LAYER.lot, 9, UP, 0.04);
  mesh(urban, layerMat(null, 'urban', { color: 0x77736b }), group);
  mesh(park, layerMat(tile(parkGrass), 'park', { color: 0x9bb584 }), group);
  mesh(water, layerMat(null, 'water', { color: 0x3b79a8, roughness: 0.15, metalness: 0.1 }), group);
  mesh(road, layerMat(null, 'road', { color: 0x2b2d31, ...surface('asphalt', 3, 0.9) }), group);
  mesh(lot, layerMat(null, 'lot', { color: 0x3d3f44, ...surface('asphalt', 3, 0.9) }), group);
  mesh(path, layerMat(tile(sidewalkTex), 'path', { color: 0x9b968c, ...surface('cobble', 1.5, 1.1) }), group);
  mesh(curbs, layerMat(null, 'basin', { vertexColors: true, roughness: 0.95 }), group, true);
  mesh(basinWater, layerMat(null, 'basin', { color: 0x4f8fb5, roughness: 0.12, metalness: 0.1 }), group);

  // the plaza slab at the origin: a 6 cm step with a curb, same as the procedural city had
  {
    const g = new THREE.BoxGeometry(PLAZA_HALF * 2, LAYER.plaza, PLAZA_HALF * 2).translate(0, LAYER.plaza / 2, 0);
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);       // same stone and scale as the paths around it
    const m = new THREE.Mesh(g, layerMat(tile(sidewalkTex), 'plaza', { color: 0x9b968c, ...surface('cobble', 1.5, 1.1) })); m.receiveShadow = true; group.add(m);
  }

  // ── buildings: walls grouped by facade kind and colour, pitched tile roofs and flat roofs in two meshes ──
  // Historic centre (small footprints, no tall height tag): 2-4 storey baroque / classicist houses, pastel plaster, red hip roofs.
  // Everything larger or taller: plain calm facade, flat roof.
  const walls = new Map<string, { kind: string; v: number; b: Builder }>(), tiles = new Builder(), flats = new Builder(), relief = new Builder(), kept: number[][] = [];
  const frameR = settings.quality === 'low' ? 75 : 110;     // window frames only where the camera can see them; cornices and plinths everywhere
  const PLINTH = new THREE.Color(0x8c8579), SILL = new THREE.Color(0xf1ece0), tint = new THREE.Color(), band = new THREE.Color();
  const wallB = (kind: string, v: number): Builder => { const k = kind + v; let e = walls.get(k); if (!e) { e = { kind, v, b: new Builder() }; walls.set(k, e); } return e.b; };
  for (const bd of osm.buildings) {
    const p = bd.p, n = p.length / 2;
    if (n < 3) continue;
    let cx = 0, cz = 0, near = Infinity;
    for (let i = 0; i < p.length; i += 2) { cx += p[i]; cz += p[i + 1]; near = Math.min(near, Math.hypot(p[i], p[i + 1])); }
    cx /= n; cz /= n;
    if (near < CLEAR || insideRing(p, 0, 0)) continue;
    if (hide && hide.has(bd.n as string)) { kept.push(p); continue; }       // replaced by a hand-built landmark model
    const hv = hash(cx, cz), area = Math.abs(polyArea(p));
    const bh = bd.h ?? 0, panel = (bd.lv ?? 0) >= 5 || (bd.a && bh >= 12);                // estates: prefab blocks (plot extracts carry the flats tag and the level count)
    const old = bd.k !== 'theatre' && area < 2200 && !(bh > 20) && !panel;
    let storeys: number;
    if (bd.k === 'church') storeys = 6;
    else if (old) storeys = bh >= 3 ? Math.min(6, Math.max(2, Math.round(bh / STOREY_H))) : 2 + Math.floor(hv * 3);
    else storeys = Math.min(20, Math.max(2, Math.round((bh >= 3 ? bh : 9 + hv * 8) / STOREY_H)));
    const h = storeys * STOREY_H;
    kept.push(p);
    const v = Math.floor(hv * 1000) % OLD_PALETTE.length;
    const W = old ? wallB('old', bd.k === 'church' ? 99 : v) : wallB('plain', Math.floor(hv * 977) % PLAIN_PALETTE.length);
    const pitched = old && area < 1500 && convexish(p, area), wk = old ? 'old' : 'plain', dist = Math.hypot(cx, cz);
    const shade = 0.93 + 0.13 * hash(cx * 3.1, cz * 1.7), warm = (hash(cz, cx * 2.3) - 0.5) * 0.06;     // slight plaster variation per building
    tint.setRGB(shade * (1 + warm), shade, shade * (1 - warm));
    band.setHex(bd.k === 'church' ? 0xdad3c3 : old ? OLD_PALETTE[v] : PLAIN_PALETTE[Math.floor(hv * 977) % PLAIN_PALETTE.length]).multiplyScalar(1.06 * shade);
    const sign = polyArea(p) >= 0 ? 1 : -1;                    // outward normal of edge d is (dz, -dx) for counter-clockwise rings
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x0 = p[2 * i], z0 = p[2 * i + 1], x1 = p[2 * j], z1 = p[2 * j + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz);
      if (l < 0.05) continue;
      const nn = [dz / l * sign, 0, -dx / l * sign], reps = Math.max(1, Math.round(l / STOREY_W));   // whole windows per wall, none cut
      const uf: UvFn = (q) => [Math.hypot(q[0] - x0, q[2] - z0) / l * reps, q[1] / STOREY_H];
      const A = [x0, 0, z0], B = [x1, 0, z1], C = [x1, h, z1], D = [x0, h, z0];
      W.tri(A, B, C, nn, uf, tint); W.tri(A, C, D, nn, uf, tint);
      // relief: plinth, cornice (or a thin stringcourse under the eaves), window sills / lintels / jambs
      const t = [dx / l, dz / l];
      wallBox(relief, x0, z0, t, nn, 0, l, 0, 0.7, 0.1, PLINTH);
      if (pitched) wallBox(relief, x0, z0, t, nn, 0, l, h - 0.55, h - 0.38, 0.1, band);
      else { wallBox(relief, x0, z0, t, nn, 0, l, h - 0.42, h, 0.3, band); wallBox(relief, x0, z0, t, nn, 0, l, h - 0.62, h - 0.46, 0.14, band); }
      if (dist < frameR && l > 2.2) {
        const F = WIN[wk as keyof typeof WIN], tw = l / reps;
        for (let r = 0; r < reps; r++) for (const f of [0.25, 0.75]) {
          const uc = (r + f) * tw, hw = F.w / 2;
          if (uc - hw < 0.05 || uc + hw > l - 0.05) continue;
          for (let s2 = 0; s2 < storeys; s2++) {
            const y = s2 * STOREY_H;
            wallBox(relief, x0, z0, t, nn, uc - hw - 0.04, uc + hw + 0.04, y + F.sillY, y + F.sillY + F.sillH, F.sillOut, SILL);
            wallBox(relief, x0, z0, t, nn, uc - hw, uc + hw, y + F.lintelY, y + F.lintelY + F.lintelH, F.lintelOut, SILL);
            if (settings.quality !== 'low') {
              wallBox(relief, x0, z0, t, nn, uc - hw, uc - hw + F.jamb, y + F.jambY0, y + F.jambY1, F.jambOut, SILL);
              wallBox(relief, x0, z0, t, nn, uc + hw - F.jamb, uc + hw, y + F.jambY0, y + F.jambY1, F.jambOut, SILL);
            }
          }
        }
      }
    }
    if (pitched) pitchedRoof(tiles, p, h, ROOF_COLORS[Math.floor(hv * 7919) % ROOF_COLORS.length], 0, 0.5);
    else {
      fillPoly(flats, p, h, 8);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; stripe(relief, p[2 * i], p[2 * i + 1], p[2 * j], p[2 * j + 1], 0.22, h, h + 0.5, band); }   // parapet
    }
  }
  for (const { kind, v, b } of walls.values()) {
    if (b.empty) continue;
    mesh(b, calmMat(v === 99 ? 0xdad3c3 : kind === 'old' ? OLD_PALETTE[v] : PLAIN_PALETTE[v], kind, v, true), group, true);
  }
  mesh(tiles, material(tile(tileRoofTex), { vertexColors: true, ...surface('roof', 3, 1.1) }), group, true);
  mesh(relief, material(null, { vertexColors: true, roughness: 0.9 }), group, false);   // no shadow casting: the details are too small to show in the shadow map
  mesh(flats, material(tile(roofTex), { color: 0xb8b8b8 }), group);

  // ── trees in parks, bushes on park corners, street lights, parked cars ──
  const trees: [number, number, number, number][] = [], bushes: [number, number][] = [], lamps: number[][] = [], cars: number[][] = [], hedges: [number, number, number, number][] = [], beds: [number, number, number, number, number][] = [];
  const inBuilding = (x: number, z: number): boolean => { for (const p of kept) if (insideRing(p, x, z)) return true; return false; };
  const clearPlaza = (x: number, z: number): boolean => Math.abs(x) < PLAZA_HALF + 2 && Math.abs(z) < PLAZA_HALF + 2;
  for (const g of osm.parks) {
    if (g.k === 'pitch') continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < g.p.length; i += 2) { x0 = Math.min(x0, g.p[i]); x1 = Math.max(x1, g.p[i]); z0 = Math.min(z0, g.p[i + 1]); z1 = Math.max(z1, g.p[i + 1]); }
    const step = g.k === 'wood' ? 5 : 9;
    for (let x = x0; x < x1; x += step) for (let z = z0; z < z1; z += step) {
      const jx = x + (hash(x, z) - 0.5) * step * 0.8, jz = z + (hash(z, x) - 0.5) * step * 0.8;
      if (!bbIn(jx, jz, 10) || clearPlaza(jx, jz) || !insideRing(g.p, jx, jz) || inBuilding(jx, jz)) continue;
      trees.push([jx, jz, 0.8 + hash(jx, jz) * 0.7, Math.floor(hash(jz, jx) * 3)]);
    }
    for (let i = 0; i < g.p.length; i += 12) if (bushes.length < 70 && bbIn(g.p[i], g.p[i + 1], 10) && !clearPlaza(g.p[i], g.p[i + 1])) bushes.push([g.p[i], g.p[i + 1]]);
  }
  // hedge rows: lumps 1.3 m apart, half a metre inside the kerb, on about every second long edge of the bigger parks
  for (const g of osm.parks) {
    if (g.k === 'pitch' || Math.abs(polyArea(g.p)) < 200) continue;
    const sg = polyArea(g.p) >= 0 ? 1 : -1;
    for (let i = 0, n = g.p.length / 2; i < n; i++) {
      const j = (i + 1) % n, x0 = g.p[2 * i], z0 = g.p[2 * i + 1], dx = g.p[2 * j] - x0, dz = g.p[2 * j + 1] - z0, l = Math.hypot(dx, dz);
      if (l < 6 || hash(x0, z0) < 0.5 || hedges.length > 420) continue;
      const nx = -dz / l * sg, nz = dx / l * sg, gap = 1.25;
      for (let s = 0.8; s < l - 0.8; s += gap) {
        const x = x0 + dx / l * s + nx * 0.55, z = z0 + dz / l * s + nz * 0.55;
        if (bbIn(x, z, 10) && !clearPlaza(x, z) && insideRing(g.p, x, z) && !inBuilding(x, z)) hedges.push([x, z, Math.atan2(dx, dz) + Math.PI / 2, 0.85 + hash(x, z) * 0.3]);
      }
    }
  }
  for (const g of osm.parks) {   // flower beds: a few per bigger park, away from the trees
    if (g.k === 'pitch' || g.k === 'wood' || Math.abs(polyArea(g.p)) < 250) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, got = 0;
    for (let i = 0; i < g.p.length; i += 2) { x0 = Math.min(x0, g.p[i]); x1 = Math.max(x1, g.p[i]); z0 = Math.min(z0, g.p[i + 1]); z1 = Math.max(z1, g.p[i + 1]); }
    for (let k = 0; k < 60 && got < 2 && beds.length < 36; k++) {
      const x = x0 + hash(k, x0) * (x1 - x0), z = z0 + hash(z0, k) * (z1 - z0), r = hash(x, z) * Math.PI;
      if (!bbIn(x, z, 12) || clearPlaza(x, z) || inBuilding(x, z)) continue;
      const ok = [[2.2, 0], [-2.2, 0], [0, 1.2], [0, -1.2]].every(([u, v]) => insideRing(g.p, x + u * Math.cos(r) + v * Math.sin(r), z - u * Math.sin(r) + v * Math.cos(r)));
      if (!ok || trees.some((q) => Math.hypot(q[0] - x, q[1] - z) < 3.2) || beds.some((q) => Math.hypot(q[0] - x, q[1] - z) < 8)) continue;
      beds.push([x, z, r, 3.6, 1.7]); got++;
    }
  }
  let carN = 0;
  for (const r of osm.roads) {
    if (r.k !== 'main' && r.k !== 'street') continue;
    const gap = r.k === 'main' ? 30 : 46;
    let acc = 6;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz);
      if (l < 1) continue;
      const tx = dx / l, tz = dz / l, nx = -tz, nz = tx, rot = Math.atan2(tx, tz);
      for (let s = acc; s < l; s += gap) {
        const x = x0 + tx * s, z = z0 + tz * s, side = (Math.floor(x * 7 + z * 3) & 1) ? 1 : -1, off = r.w / 2 + 1.2;
        const lx = x + nx * off * side, lz = z + nz * off * side;
        if (lamps.length < 40 && bbIn(lx, lz, 8) && !clearPlaza(lx, lz) && !inBuilding(lx, lz)) lamps.push([lx, 0.03, lz, Math.atan2(-nx * side, -nz * side)]);
        const t = hash(x, z);
        if (t < 0.7 && carN < 120 && r.w >= 5.5) {
          const cx = x + tx * 9 - nx * (r.w / 2 - 1.3) * side, cz = z + tz * 9 - nz * (r.w / 2 - 1.3) * side;
          if (bbIn(cx, cz, 8) && !clearPlaza(cx, cz) && !inBuilding(cx, cz)) { cars.push([cx, 0.04, cz, rot + (t < 0.27 ? 0 : Math.PI)]); carN++; }
        }
      }
      acc = ((acc - l) % gap + gap) % gap;
    }
  }
  // trees (several canopy lumps, tints, wind sway), hedge rows along park kerbs, flower beds (js/vegetation.js)
  addTrees(group, trees, LAYER.park);
  addHedges(group, hedges, LAYER.park);
  addFlowerBeds(group, beds, LAYER.park);
  instanceKit(kit.bush, bushes.map(([x, z]) => [x, LAYER.park, z, hash(x, z) * 6]), 1.1, group, { shadow: false });
  instanceKit(kit.streetlight, lamps, 6, group);
  // parked cars in the car parks (OpenStreetMap amenity=parking): bays in rows along the long side of the lot, about two thirds taken
  for (const g of osm.parking || []) {
    if (Math.abs(polyArea(g.p)) < 120) continue;
    const n = g.p.length / 2; let cx = 0, cz = 0, sxx = 0, szz = 0, sxz = 0;
    for (let i = 0; i < n; i++) { cx += g.p[2 * i]; cz += g.p[2 * i + 1]; } cx /= n; cz /= n;
    for (let i = 0; i < n; i++) { const dx = g.p[2 * i] - cx, dz = g.p[2 * i + 1] - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
    const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(th), uz = Math.sin(th), vx = -uz, vz = ux;   // u: long axis
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (let i = 0; i < n; i++) { const dx = g.p[2 * i] - cx, dz = g.p[2 * i + 1] - cz, u = dx * ux + dz * uz, v = dx * vx + dz * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    // rows run along u (cars nose to the aisle: rotated across u), 2.6 m between cars, 6 m between rows (two rows share an aisle)
    for (let v = v0 + 2.8; v < v1 - 2.4; v += 5.4) for (let u = u0 + 1.6; u < u1 - 1.6; u += 2.7) {
      const x = cx + ux * u + vx * v, z = cz + uz * u + vz * v;
      if (hash(x * 1.3, z * 0.7) > 0.66 || !bbIn(x, z, 8) || clearPlaza(x, z) || inBuilding(x, z) || !insideRing(g.p, x, z)) continue;
      const ok = [[1.2, 0], [-1.2, 0], [0, 2.4], [0, -2.4]].every(([a, b]) => insideRing(g.p, x + ux * a + vx * b, z + uz * a + vz * b));
      if (ok) cars.push([x, LAYER.lot + 0.03, z, Math.atan2(vx, vz) + (hash(z, x) < 0.5 ? 0 : Math.PI)]);
    }
  }
  // the nearest first: the preset and the finished plots decide how many are shown (People.applyTraffic)
  cars.sort((a, b) => Math.hypot(a[0], a[2]) - Math.hypot(b[0], b[2]));
  const parked: { ims: THREE.InstancedMesh[]; n: number }[] = [];
  const carKit = (src: THREE.Object3D | undefined, list: number[][], len: number) => { const ims = instanceKit(src, list, 0, group, { lengthFit: len }) || []; parked.push({ ims, n: list.length }); };
  carKit(kit.car_sedan, cars.filter((_, i) => i % 2 === 0), 4.4);
  carKit(kit.car_hatchback, cars.filter((_, i) => i % 2 === 1), 4.0);
  group.userData.parked = parked;
  // tram lines (rails in a track bed, overhead wire and poles, stops, trams): js/trams.js
  group.userData.tram = buildTramLine(osm, { group, inBuilding, clearPlaza });
  // street furniture, bike lanes, seats and standing spots for the people (js/street-life.js)
  const life = buildStreetLife(osm, kit, { group, inBuilding, clearPlaza, bbIn });
  group.userData.life = life;
  // moving traffic: the streets nearest to the tower first, so the cars are where the camera looks
  const routeD = (p: number[]): number => { let d = 1e9; for (let i = 0; i < p.length; i += 2) d = Math.min(d, Math.hypot(p[i], p[i + 1])); return d; };
  group.userData.carRoutes = osm.roads.filter((r) => (r.k === 'main' || r.k === 'street' || (r.k === 'lane' && r.w >= 4)) && r.w >= 4 && lineLen(r.p) > 40)
    .map((r) => ({ p: r.p, d: routeD(r.p) })).filter((r) => r.d < 220).sort((a, b) => a.d - b.d).slice(0, 18).map((r) => r.p);
  group.userData.walkRoutes = osm.roads.filter((r) => r.k === 'walk' || r.k === 'path').map((r) => {
    let d = 1e9; for (let i = 0; i < r.p.length; i += 2) d = Math.min(d, Math.hypot(r.p[i], r.p[i + 1]));
    let len = 0; for (let i = 2; i < r.p.length; i += 2) len += Math.hypot(r.p[i] - r.p[i - 2], r.p[i + 1] - r.p[i - 1]);
    return { p: r.p, off: 0.5, d, len };
  }).filter((r) => r.len > 30 && r.d > 18 && r.d < 160).sort((a, b) => a.d - b.d).slice(0, 24);
  group.userData.walkRoutes.life = life;      // People.setRoutes picks the life data (seats, bike routes, basins) up from here
  return group;
}

const lineLen = (p: number[]): number => { let l = 0; for (let i = 2; i < p.length; i += 2) l += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return l; };
export function mergeParts(parts: [THREE.BufferGeometry, number][]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  for (const [g0, c] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0, color = new THREE.Color(c);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(color.r, color.g, color.b);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
