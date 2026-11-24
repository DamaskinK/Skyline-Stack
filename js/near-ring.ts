// The near ring of a level: real streets, building footprints, parks and water from OpenStreetMap (assets/levels/<id>/osm.json,
// made by scripts/build-osm-level.mjs), with CC0 kit props (street lights, bushes, parked cars) instanced.
// Frame: 1 unit = 1 m, x east, z south, origin = build site = tower. A small paved plaza stays clear around the tower.
// Draw calls: ground layers, one wall mesh per facade variant, one roof mesh, a few instanced props.
import * as THREE from 'three';
import { calmFacade, STOREY_W, STOREY_H, roofTex, tileRoofTex, sidewalkTex, canvas2d, toTex } from './textures.js';
import { glowMats, GROUND_Y } from './world.js';
import { buildStreetLife } from './street-life.js';
import { buildStreetDetail } from './street-detail.js';
import { surface } from './surfaces.js';
import { addTrees, addHedges, addFlowerBeds } from './vegetation.js';
import { settings } from './settings.js';
import { planNearRing, PLAZA_HALF, PAD_HALF, BASIN_MAX, hash, insideRing, polyArea } from './core/placement.js';
import type { Circle } from './core/placement.js';
import { buildTramLine } from './trams.js';
import { HouseKit, addHouse, addDormers, PANEL_SCHEMES } from './house-kit.js';
import type { RoofInfo } from './house-kit.js';
import { FacadeBuilder } from './baked-facades.js';
import { buildRoofProps, membraneMaterial, tileMaterial } from './roof-props.js';
import type { LevelAssets, OsmExtract } from './types.js';

export { PLAZA_HALF, PAD_HALF, hash, insideRing, polyArea };
/** A roof of the near ring: `tile` (pitched, with its ridge) or flat (`panel`, `old`, `mid`, with the footprint and its winding sign). */
export interface RoofSite { kind: 'tile' | 'panel' | 'old' | 'mid'; h: number; dist: number; hv: number; roof?: RoofInfo; color?: THREE.Color; p?: number[]; sign?: number; gable?: boolean }

export const OLD_PALETTE = [0xefe2c4, 0xe8c9b4, 0xe9d89a, 0xc9ddc6, 0xc3d2de, 0xe4a99a, 0xf0ebe0];   // pastel plaster of the historic centre
export const PLAIN_PALETTE = [0xe6e1d6, 0xd6d9d2, 0xdcd3c1];
// S0004 13 modern kit: white plaster and dark metal roofs of the renovated barracks, white / grey render with cladding of the new flats, office frames and fins (Aupark green)
const BK_PALETTE = [0xf3f1eb, 0xeeebe3, 0xf6f4ef], BK_ROOF = [0x4a4e53, 0x55595e, 0x40444a];
const RS_PALETTE = [0xf2f2ef, 0xe8e8e5, 0xdcdddb, 0xefebe3], RS_CLAD = [0x3c4046, 0x8a5e40, 0xb0533c, 0x6b7076];
const OF_PALETTE = [0xc9ccd0, 0xb9b5ae, 0xdedfdc, 0x9da3aa], OF_FIN = [0x7fb23a, 0xa9afb5, 0xe6e6e2, 0x3d4a5a];
const MID_PALETTE = [0xe6e1d6, 0xdcd3c1, 0xe8dcc0, 0xd7c9a8, 0xe3d6c4, 0xd3d8cf];   // 1930s-50s blocks: plaster in pale ochre and grey
export const ROOF_COLORS = [0xb4573c, 0xa84c36, 0x9a5a44, 0x8a4a3a, 0xc0623f, 0x7d5a4c, 0xb0523a].map((c) => new THREE.Color(c));

// ground heights: every layer a real step above the one below, plus a depth bias for the far distance
export const LAYER = { urban: 0.005, park: 0.015, water: 0.02, road: 0.03, lot: 0.034, bed: 0.038, path: 0.045, bike: 0.055, mark: 0.065, plaza: GROUND_Y.walk };   // bike lanes and their paint sit above roads and footways, never in the same plane
const BIAS = { urban: 1, park: 2, water: 3, road: 4, lot: 4.5, bed: 5, path: 5.2, plaza: 7, basin: 9, bike: 6, mark: 8 };   // the plaza top always wins over the flat layers around it
// park grass: soft green with random specks (the shared grass texture has specks on a lattice that read as dashed lines)
const parkGrass = (() => {
  const [c, x] = canvas2d(128, 128); x.fillStyle = '#76a35e'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { x.fillStyle = hash(i, 3) > 0.5 ? 'rgba(40,90,30,.16)' : 'rgba(190,225,140,.16)'; x.fillRect(hash(i, 1) * 128, hash(i, 2) * 128, 2, 3); }
  return toTex(c, true);
})();
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
// Roof axis of a footprint that is (nearly) a rectangle: the direction of its longest edge, or null when the shape is not one (an L, a trapezoid, a
// curve): the ridge of a hip roof over such a footprint runs skewed, so those get a flat roof (S0004 15). Every vertex must lie within
// max(0.7 m, 9 % of the half width) of the edge of the bounding rectangle in that frame, and the footprint must fill 85 % of the rectangle.
export function rectAxis(p: number[]): [number, number] | null {
  const n = p.length / 2; if (n < 3) return null;
  let best = 0, ax: [number, number] = [1, 0];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, dx = p[2 * j] - p[2 * i], dz = p[2 * j + 1] - p[2 * i + 1], l = Math.hypot(dx, dz); if (l > best) { best = l; ax = [dx / l, dz / l]; } }
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (let i = 0; i < n; i++) { const u = p[2 * i] * ax[0] + p[2 * i + 1] * ax[1], v = -p[2 * i] * ax[1] + p[2 * i + 1] * ax[0]; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const tol = Math.max(0.7, 0.09 * Math.min(u1 - u0, v1 - v0) / 2);
  for (let i = 0; i < n; i++) {
    const u = p[2 * i] * ax[0] + p[2 * i + 1] * ax[1], v = -p[2 * i] * ax[1] + p[2 * i + 1] * ax[0];
    if (Math.min(u - u0, u1 - u, v - v0, v1 - v) > tol) return null;
  }
  return Math.abs(polyArea(p)) / Math.max(1, (u1 - u0) * (v1 - v0)) > 0.85 ? ax : null;
}
// hip roof over a roughly convex footprint: the ridge runs along the long axis, eave ring at height h
export function pitchedRoof(b: Builder, p: number[], h: number, color: THREE.Color, rhFixed = 0, eave = 0): RoofInfo {
  const n = p.length / 2; let cx = 0, cz = 0, sxx = 0, szz = 0, sxz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; } cx /= n; cz /= n;
  for (let i = 0; i < n; i++) { const dx = p[2 * i] - cx, dz = p[2 * i + 1] - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  const ra = rectAxis(p), th = ra ? Math.atan2(ra[1], ra[0]) : 0.5 * Math.atan2(2 * sxz, sxx - szz), c = Math.cos(th), s = Math.sin(th);
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
      b.tri(A, B, C, [nx / l, ny / l, nz / l], slopeUv(E[i], ex, ez, [nx / l, ny / l, nz / l]) ?? uvf, color);
    }
    if (eave) {                                   // fascia board under the eave edge, a shade darker
      const d = color.clone().multiplyScalar(0.72), ex = E[j][0] - E[i][0], ez = E[j][2] - E[i][2], l = Math.hypot(ex, ez) || 1, nn = [ez / l * sg, 0, -ex / l * sg];
      const lo = (q: Vec): Vec => [q[0], q[1] - 0.28, q[2]];
      b.tri(E[i], E[j], lo(E[j]), nn, uvf, d); b.tri(E[i], lo(E[j]), lo(E[i]), nn, uvf, d);
    }
  }
  return { cx, cz, ax, hu, hv, rh, rl, h };
}


// Tile UVs of a roof face (S0004 16): u along the eave (horizontal, direction ex, ez), v up the slope, 4 m per repeat; so the tile courses run level on every face.
function slopeUv(o: Vec, ex: number, ez: number, n: Vec): UvFn | null {
  const el = Math.hypot(ex, ez); if (el < 1e-4) return null;
  const e = [ex / el, 0, ez / el];
  let w = [n[1] * e[2] - n[2] * e[1], n[2] * e[0] - n[0] * e[2], n[0] * e[1] - n[1] * e[0]];      // n x e lies in the face, across the eave
  if (w[1] < 0) w = [-w[0], -w[1], -w[2]];
  return (q) => { const dx = q[0] - o[0], dy = q[1] - o[1], dz = q[2] - o[2]; return [(dx * e[0] + dz * e[2]) / 4, (dx * w[0] + dy * w[1] + dz * w[2]) / 4]; };
}

// Gable roof over a four-cornered footprint (S0004 02): the ridge runs along the long side, eaves 0.45 m, barge 0.2 m, the gable ends are plain plaster (`fill`).
// Returns the roof for dormers, or null when the footprint is not a rectangle.
function gableRoof(tiles: Builder, fill: Builder, p: number[], h: number, color: THREE.Color, plaster: THREE.Color): RoofInfo | null {
  if (p.length !== 8 || !rectAxis(p)) return null;
  const l01 = Math.hypot(p[2] - p[0], p[3] - p[1]), l12 = Math.hypot(p[4] - p[2], p[5] - p[3]);
  if (Math.max(l01, l12) < 1.25 * Math.min(l01, l12) || Math.min(l01, l12) < 5) return null;
  const long = l01 >= l12 ? 0 : 1, a0 = p[2 * long + 2] - p[2 * long], a1 = p[2 * long + 3] - p[2 * long + 1], al = Math.hypot(a0, a1);
  const ax: [number, number] = [a0 / al, a1 / al], bx: [number, number] = [-ax[1], ax[0]];
  let cx = 0, cz = 0; for (let i = 0; i < 4; i++) { cx += p[2 * i] / 4; cz += p[2 * i + 1] / 4; }
  let hu = 0, hv = 0; for (let i = 0; i < 4; i++) { const dx = p[2 * i] - cx, dz = p[2 * i + 1] - cz; hu = Math.max(hu, Math.abs(dx * ax[0] + dz * ax[1])); hv = Math.max(hv, Math.abs(dx * bx[0] + dz * bx[1])); }
  const rh = Math.min(4.4, Math.max(2.2, hv * 0.62)), ev = hv + 0.45, eu = hu + 0.2, uvf: UvFn = (q) => [q[0] / 4, q[2] / 4];
  const P = (u: number, v: number, y: number): Vec => [cx + ax[0] * u + bx[0] * v, y, cz + ax[1] * u + bx[1] * v];
  for (const s of [-1, 1]) {
    const nrm = [bx[0] * s * rh, ev, bx[1] * s * rh], nl = Math.hypot(nrm[0], nrm[1], nrm[2]), n: Vec = [nrm[0] / nl, nrm[1] / nl, nrm[2] / nl];
    const e0 = P(-eu, s * ev, h - 0.15), e1 = P(eu, s * ev, h - 0.15), r0 = P(-eu, 0, h + rh + 0.2 * rh / ev), r1 = P(eu, 0, h + rh + 0.2 * rh / ev);
    const su = slopeUv(e0, e1[0] - e0[0], e1[2] - e0[2], n) ?? uvf;
    tiles.tri(e0, e1, r1, n, su, color); tiles.tri(e0, r1, r0, n, su, color);
  }
  for (const s of [-1, 1]) {                                  // gable triangles in the wall plane
    const A = P(s * hu, -hv, h), B = P(s * hu, hv, h), C = P(s * hu, 0, h + rh);
    fill.tri(A, B, C, [ax[0] * s, 0, ax[1] * s], (q) => [q[0] + q[2], q[1]], plaster);
  }
  return { cx, cz, ax, hu: hu + 0.4, hv, rh, rl: hu - 0.2, h };
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

// `towers`: circles round the sites of the finished towers of the other plots inside this extract (towerCircles in js/core/placement.ts).
// Every placement rule (what may stand where) lives in js/core/placement.ts; this file only draws the plan. The plan is on `group.userData.plan`
// so the browser audit can compare it with the objects of the scene.
export function buildNearRing(osm0: OsmExtract, kit: LevelAssets = {}, hide: Set<string> | null = null, towers: Circle[] = [], landmarks: number[][] = []): THREE.Group {
  const plan = planNearRing(osm0, { towers, landmarks }), osm = plan.osm;
  const group = new THREE.Group(); group.name = 'near-ring'; group.userData.plan = plan;

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
  const walls = new Map<string, { kind: string; v: number; b: Builder }>(), tiles = new Builder(), flats = new Builder(), relief = new Builder();
  const spots: Record<string, { x: number; z: number; h: number; storeys: number; d: number }> = {}; group.userData.houseSpots = spots;     // nearest house of each style (screenshot poses)
  const roofs: RoofSite[] = []; group.userData.roofs = roofs;        // every roof that stands: perches for the pigeons (js/birds.ts), roof props (js/roof-props.ts)
  const frameR = settings.quality === 'low' ? 75 : 110, kitR = settings.quality === 'low' ? 32 : 48;     // window frames only where the camera can see them; cornices and plinths everywhere
  const PLINTH = new THREE.Color(0x8c8579), SILL = new THREE.Color(0xf1ece0), tint = new THREE.Color(), band = new THREE.Color();
  // S0004 02: houses are assembled from the Blender module kit (js/house-kit.ts); `?houses=procedural` or a kit that failed to load keeps the procedural facades
  const hk = new URLSearchParams(location.search).get('houses') === 'procedural' ? null : HouseKit.from(kit.housekit as THREE.Object3D | undefined, kit.modernkit as THREE.Object3D | undefined);
  const far = new FacadeBuilder();                          // houses beyond the kit radius: baked atlas walls (js/baked-facades.ts)
  const fill = new Builder();                                // plain wall for edges too short for a bay, and gable ends
  const shadowWalls = new Builder();                         // walls pushed 0.9 m into the house: the modules do not cast shadows, this does (invisible in the colour pass)
  const wallB = (kind: string, v: number): Builder => { const k = kind + v; let e = walls.get(k); if (!e) { e = { kind, v, b: new Builder() }; walls.set(k, e); } return e.b; };
  for (const site of plan.site.buildings) {                  // the footprints that stand: none near the tower, none on top of another (js/core/placement.ts)
    const bd = osm.buildings[site.i], p = bd.p, n = p.length / 2;
    let cx = 0, cz = 0;
    for (let i = 0; i < p.length; i += 2) { cx += p[i]; cz += p[i + 1]; }
    cx /= n; cz /= n;
    if (hide && hide.has(bd.n as string)) continue;          // replaced by a hand-built landmark model
    const hv = hash(cx, cz), area = Math.abs(polyArea(p));
    if (area < 8 && bd.k !== 'church') continue;             // pillars, plinths and pedestals (an OSM footprint of 3-4 m2 is no house): drawn as nothing, still an obstacle in the plan
    const tiny = area < 15 && bd.k !== 'church';             // a kiosk, a transformer hut, a shed: one storey with a shop front and a roof, never a 7-14 m blank pillar
    const modern = !tiny && hk?.modern ? bd.m : undefined;                 // S0004 13: renovated barracks, new flats, offices (OSM class from scripts/build-osm-level.mjs)
    const bh = bd.h ?? 0, panel = !tiny && !modern && ((bd.lv ?? 0) >= 5 || (bd.a && bh >= 12));                // estates: prefab blocks (plot extracts carry the flats tag and the level count)
    const old = tiny || (!modern && bd.k !== 'theatre' && area < 2200 && !(bh > 20) && !panel);
    let storeys: number;
    if (tiny) storeys = 1;
    else if (modern) storeys = Math.min(20, Math.max(1, Math.round((bh >= 3 ? bh : modern === 'barracks' ? 10 + hv * 4 : modern === 'resi' ? 14 + hv * 7 : 14 + hv * 14) / STOREY_H)));
    else if (bd.k === 'church') storeys = 6;
    else if (old) storeys = bh >= 3 ? Math.min(6, Math.max(2, Math.round(bh / STOREY_H))) : 2 + Math.floor(hv * 3);
    else storeys = Math.min(20, Math.max(2, Math.round((bh >= 3 ? bh : 9 + hv * 8) / STOREY_H)));
    const h = storeys * STOREY_H;
    { const kind = modern ?? (old ? 'old' : panel ? 'panel' : 'mid'), d0 = Math.hypot(cx, cz), cur = spots[kind]; if (d0 > 30 && (!cur || d0 < cur.d)) spots[kind] = { x: cx, z: cz, h, storeys, d: d0 }; }
    const v = Math.floor(hv * 1000) % OLD_PALETTE.length;
    const W = old ? wallB('old', bd.k === 'church' ? 99 : v) : wallB('plain', Math.floor(hv * 977) % PLAIN_PALETTE.length);
    const pitched = (old || modern === 'barracks') && area < 1500 && convexish(p, area) && rectAxis(p) !== null, wk = old ? 'old' : 'plain', dist = Math.hypot(cx, cz);
    const shade = 0.93 + 0.13 * hash(cx * 3.1, cz * 1.7), warm = (hash(cz, cx * 2.3) - 0.5) * 0.06;     // slight plaster variation per building
    tint.setRGB(shade * (1 + warm), shade, shade * (1 - warm));
    band.setHex(bd.k === 'church' ? 0xdad3c3 : old ? OLD_PALETTE[v] : PLAIN_PALETTE[Math.floor(hv * 977) % PLAIN_PALETTE.length]).multiplyScalar(1.06 * shade);
    const sign = polyArea(p) >= 0 ? 1 : -1;                    // outward normal of edge d is (dz, -dx) for counter-clockwise rings
    if (hk) {
      const sc = Math.floor(hv * 733) % PANEL_SCHEMES.length;
      const mi = Math.floor(hv * 977), MP = modern === 'barracks' ? BK_PALETTE : modern === 'resi' ? RS_PALETTE : OF_PALETTE, MA = modern === 'barracks' ? BK_ROOF : modern === 'resi' ? RS_CLAD : OF_FIN;
      const base = modern ? MP[mi % MP.length] : old ? OLD_PALETTE[v] : panel ? PANEL_SCHEMES[sc][0] : MID_PALETTE[mi % MID_PALETTE.length];
      const plaster = new THREE.Color(base).multiply(tint), roofCol = ROOF_COLORS[Math.floor(hv * 7919) % ROOF_COLORS.length];
      const accent = modern ? new THREE.Color(MA[Math.floor(hv * 7919) % MA.length]) : old ? roofCol : new THREE.Color(PANEL_SCHEMES[sc][1]);
      const short = addHouse(hk, { p, sign, style: modern ?? (old ? 'old' : panel ? 'panel' : 'mid'), storeys, h, pitched, near: dist < kitR, plaster, accent, seed: hv, loggia: hash(cz * 1.3, cx) > (modern === 'barracks' ? 0.3 : modern === 'office' ? 0.35 : 0.5), gate: hash(cx * 2.1, cz) > 0.45, far });
      {                                                      // shadow proxy: the footprint ring pushed inwards along the mitred normals (deeper than the loggias)
        const q: number[] = [];
        for (let i = 0; i < n; i++) {
          const a = (i + n - 1) % n, j = (i + 1) % n, e1x = p[2 * i] - p[2 * a], e1z = p[2 * i + 1] - p[2 * a + 1], e2x = p[2 * j] - p[2 * i], e2z = p[2 * j + 1] - p[2 * i + 1];
          const l1 = Math.hypot(e1x, e1z) || 1, l2 = Math.hypot(e2x, e2z) || 1, n1x = e1z / l1 * sign, n1z = -e1x / l1 * sign, n2x = e2z / l2 * sign, n2z = -e2x / l2 * sign;
          const k = 0.9 / Math.max(0.35, 1 + n1x * n2x + n1z * n2z);
          q.push(p[2 * i] - (n1x + n2x) * k, p[2 * i + 1] - (n1z + n2z) * k);
        }
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, ex = q[2 * j] - q[2 * i], ez = q[2 * j + 1] - q[2 * i + 1], l = Math.hypot(ex, ez); if (l < 0.05) continue;
          const nn = [ez / l * sign, 0, -ex / l * sign], A = [q[2 * i], 0, q[2 * i + 1]], B = [q[2 * j], 0, q[2 * j + 1]], C = [q[2 * j], h, q[2 * j + 1]], D = [q[2 * i], h, q[2 * i + 1]];
          shadowWalls.tri(A, B, C, nn, () => [0, 0]); shadowWalls.tri(A, C, D, nn, () => [0, 0]);
        }
      }
      for (const e of short) {                                // a stub of wall between two corners: flat plaster
        const l = Math.hypot(e.x1 - e.x0, e.z1 - e.z0), nn = [(e.z1 - e.z0) / l * sign, 0, -(e.x1 - e.x0) / l * sign], uf: UvFn = (q) => [Math.hypot(q[0] - e.x0, q[2] - e.z0), q[1]];
        const A = [e.x0, 0, e.z0], B = [e.x1, 0, e.z1], C = [e.x1, h, e.z1], D = [e.x0, h, e.z0];
        fill.tri(A, B, C, nn, uf, plaster); fill.tri(A, C, D, nn, uf, plaster);
      }
    } else {
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
    }
    if (pitched) {
      const rc = modern ? new THREE.Color(BK_ROOF[Math.floor(hv * 7919) % BK_ROOF.length]) : ROOF_COLORS[Math.floor(hv * 7919) % ROOF_COLORS.length], plasterC = new THREE.Color(OLD_PALETTE[v]).multiply(tint);
      const gable = hk && hash(cx * 1.9, cz * 0.7) < 0.4 ? gableRoof(tiles, fill, p, h, rc, plasterC) : null, roof = gable ?? pitchedRoof(tiles, p, h, rc, 0, 0.5);
      if (hk && dist < kitR && !modern) addDormers(hk, roof, rc, plasterC, hv);       // the barracks have plain metal roofs
      roofs.push({ kind: 'tile', h, roof, dist, hv, color: rc, p, sign, gable: !!gable });
    } else {
      fillPoly(flats, p, h, 8);
      roofs.push({ kind: panel ? 'panel' : old ? 'old' : 'mid', h, p, sign, dist, hv });
      if (!hk) for (let i = 0; i < n; i++) { const j = (i + 1) % n; stripe(relief, p[2 * i], p[2 * i + 1], p[2 * j], p[2 * j + 1], 0.22, h, h + 0.5, band); }   // parapet
    }
  }
  if (hk) {
    group.userData.houseModules = hk.count;
    hk.build(group);
    far.mesh(group);
    mesh(fill, material(null, { vertexColors: true, roughness: 0.93, ...surface('plaster', [0.4, 0.4], 0.5) }), group, true);
    const sw = mesh(shadowWalls, material(null, { colorWrite: false, depthWrite: false, shadowSide: THREE.DoubleSide }), group, true);
    if (sw) { sw.receiveShadow = false; sw.name = 'house-shadow'; }
  }
  for (const { kind, v, b } of walls.values()) {
    if (b.empty) continue;
    mesh(b, calmMat(v === 99 ? 0xdad3c3 : kind === 'old' ? OLD_PALETTE[v] : PLAIN_PALETTE[v], kind, v, true), group, true);
  }
  mesh(tiles, tileMaterial(kit) ?? material(tile(tileRoofTex), { vertexColors: true, ...surface('roof', 3, 1.1) }), group, true);
  mesh(relief, material(null, { vertexColors: true, roughness: 0.9 }), group, false);   // no shadow casting: the details are too small to show in the shadow map
  mesh(flats, membraneMaterial(kit) ?? material(tile(roofTex), { color: 0xb8b8b8 }), group);
  buildRoofProps(group, roofs, kit);                         // S0004 16: machine rooms, vents, masts, dishes, chimneys, roof windows, gutters (js/roof-props.ts)

  // ── trees in parks, bushes on park corners, street lights, parked cars: all placed by the plan (js/core/placement.ts) ──
  const { trees, bushes, lamps, hedges, beds } = plan;
  // trees (several canopy lumps, tints, wind sway), hedge rows along park kerbs, flower beds (js/vegetation.js)
  addTrees(group, trees, LAYER.park);
  addHedges(group, hedges, LAYER.park);
  addFlowerBeds(group, beds, LAYER.park);
  instanceKit(kit.bush, bushes.map(([x, z]) => [x, LAYER.park, z, hash(x, z) * 6]), 1.1, group, { shadow: false });
  instanceKit(kit.streetlight, lamps, 6, group);
  // the nearest first (the plan sorted them): the preset and the finished plots decide how many are shown (People.applyTraffic)
  const cars = plan.cars.map(([x, , z, r], i) => [x, plan.carKinds[i] === 'lot' ? LAYER.lot + 0.03 : 0.04, z, r]);
  const parked: { ims: THREE.InstancedMesh[]; n: number }[] = [];
  const carKit = (src: THREE.Object3D | undefined, list: number[][], len: number) => { const ims = instanceKit(src, list, 0, group, { lengthFit: len }) || []; parked.push({ ims, n: list.length }); };
  carKit(kit.car_sedan, cars.filter((_, i) => i % 2 === 0), 4.4);
  carKit(kit.car_hatchback, cars.filter((_, i) => i % 2 === 1), 4.0);
  group.userData.parked = parked;
  // tram lines (rails in a track bed, overhead wire and poles, stops, trams): js/trams.js
  group.userData.tram = buildTramLine(osm, { group, plan });
  // street furniture, bike lanes, seats and standing spots for the people (js/street-life.js)
  const life = buildStreetLife(osm, kit, { group, plan });
  group.userData.life = life;
  const detail = buildStreetDetail(plan, group);       // kerbs, crossings, markings, traffic lights, bikes, name plates (js/street-detail.js)
  group.userData.streetLights = detail.lights; group.userData.detailCounts = detail.counts;
  // moving traffic: the streets nearest to the tower first, so the cars are where the camera looks
  group.userData.carRoutes = plan.routes.car; group.userData.carInfo = plan.routes.carInfo;
  group.userData.walkRoutes = plan.routes.walk.map((p) => ({ p, off: 0.5, d: routeD(p), len: lineLen(p) }));
  group.userData.walkRoutes.life = life;      // People.setRoutes picks the life data (seats, bike routes, basins) up from here
  return group;
}

const routeD = (p: number[]): number => { let d = 1e9; for (let i = 0; i < p.length; i += 2) d = Math.min(d, Math.hypot(p[i], p[i + 1])); return d; };
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
