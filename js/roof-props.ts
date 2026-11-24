// Lived-in roofs (S0004 16): the props of assets/levels/kosice/roofprops.glb (scripts/blender/roofprops.py) on the roofs of the near ring, and the tiling roof
// textures (bitumen membrane on flat roofs, uneven clay tiles on the old town). One InstancedMesh per module, so the draw calls do not grow with the roofs.
// Panel blocks: a lift machine room (or a stair exit on low blocks) over every stair section, ventilation heads, soil pipes, TV masts, satellite dishes near
// the parapet, roof outlets and a hatch, all varied by the block's hash. Tile roofs: chimneys on the slopes, roof windows, gutters along the eaves.
import * as THREE from 'three';
import { hash, insideRing } from './core/placement.js';
import { pointLine } from './core/geometry2d.js';
import { settings } from './settings.js';
import type { RoofSite } from './near-ring.js';

type Kit = Record<string, unknown>;
interface Inst { x: number; y: number; z: number; yaw: number; sx?: number; sy?: number; sz?: number; pitch?: number; shade?: number }

/** Flat-roof material: the membrane texture (8 m period, the flat roofs' UV is metres / 8), or null without the files. */
export function membraneMaterial(kit: Kit): THREE.MeshStandardMaterial | null {
  const col = kit.roof_membrane_col as THREE.Texture | undefined, nrm = kit.roof_membrane_nrm as THREE.Texture | undefined;
  if (!col) return null;
  for (const t of [col, nrm]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; }
  if (nrm) nrm.colorSpace = THREE.NoColorSpace;
  return new THREE.MeshStandardMaterial({ map: col, normalMap: nrm ?? null, normalScale: new THREE.Vector2(1, 1), roughness: 0.92, color: 0xe4e2dc });
}

/** Tile-roof material: uneven clay plain tiles (4 m period, the roofs' UV runs along each slope). The house's roof colour (vertex colour) shifts the tiles' hue
 *  relative to the middle roof red, and a slow world-space noise lays lichen, moss and soot over the roofs, so no two roofs repeat. */
export function tileMaterial(kit: Kit): THREE.MeshStandardMaterial | null {
  const col = kit.roof_tiles_col as THREE.Texture | undefined, nrm = kit.roof_tiles_nrm as THREE.Texture | undefined;
  if (!col) return null;
  for (const t of [col, nrm]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; }
  if (nrm) nrm.colorSpace = THREE.NoColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: col, normalMap: nrm ?? null, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: 0.82 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTileW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vTileW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vTileW;
float tileN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }`)
      .replace('#include <color_fragment>', `diffuseColor.rgb *= clamp(vColor / vec3(0.392, 0.072, 0.037), vec3(0.3), vec3(2.2));   // roof colour relative to the texture's red (0xa84c36)
 { float n1 = tileN(vTileW.xz * 0.11) * 0.65 + tileN(vTileW.xz * 0.43) * 0.35, n2 = tileN(vTileW.xz * 0.07 + 17.0);
   float moss = smoothstep(0.58, 0.8, n1) * 0.45, soot = smoothstep(0.55, 0.85, n2) * 0.25;
   diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.18, 0.1), moss) * (1.0 - soot); }`);
  };
  m.customProgramCacheKey = () => 'roof-tiles-s416';
  return m;
}

const near = (p: number[], x: number, z: number): number => pointLine(x, z, [...p, p[0], p[1]]);

function panelProps(r: RoofSite, put: (m: string, i: Inst) => void, low: boolean): void {
  const p = r.p!, n = p.length / 2, h = r.h, hv = r.hv;
  // long axis: the longest edge
  let best = 0, ax = [1, 0];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, dx = p[2 * j] - p[2 * i], dz = p[2 * j + 1] - p[2 * i + 1], l = Math.hypot(dx, dz); if (l > best) { best = l; ax = [dx / l, dz / l]; } }
  const bx = [-ax[1], ax[0]];
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (let i = 0; i < n; i++) { const u = p[2 * i] * ax[0] + p[2 * i + 1] * ax[1], v = p[2 * i] * bx[0] + p[2 * i + 1] * bx[1]; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const W = (u: number, v: number): [number, number] => [ax[0] * u + bx[0] * v, ax[1] * u + bx[1] * v];
  const yawA = Math.atan2(ax[1], ax[0]);                    // module x along the roof's long axis: rotation about y is -angle
  const placed: number[][] = [];
  const fits = (x: number, z: number, rad: number): boolean => insideRing(p, x, z) && near(p, x, z) > rad + 0.45 && placed.every(([a, b, c]) => Math.hypot(a - x, b - z) > rad + c + 0.3);
  const at = (m: string, u: number, v: number, rad: number, yaw = -yawA, extra: Partial<Inst> = {}): boolean => {
    const [x, z] = W(u, v); if (!fits(x, z, rad)) return false;
    placed.push([x, z, rad]); put(m, { x, y: h, z, yaw, shade: 0.9 + 0.14 * hash(x * 1.3, z * 0.7), ...extra }); return true;
  };
  const len = u1 - u0, vm = (v0 + v1) / 2, depth = v1 - v0;
  if (len < 6 || depth < 5) return;
  const sections = Math.max(1, Math.round(len / 16)), tall = h > 17;
  for (let k = 0; k < sections; k++) {
    const uc = u0 + (k + 0.5) * len / sections, s = hash(uc * 0.31 + hv, vm), side = s > 0.5 ? 1 : -1;
    const v = vm + side * Math.min(1.2, depth * 0.12);
    at(tall ? 'lift' : 'stair', uc + (s - 0.5) * 2, v, tall ? 2.2 : 1.7, -yawA + (s > 0.8 ? Math.PI : 0));
    if (!low || k === 0) at('vents', uc + 4.5 + s * 1.5, vm - side * 2.6, 1.2);
    if (!low) at('vents', uc - 5 - s, vm - side * 2.2, 1.2);
    at('drain', uc + 6.5, vm, 0.35);
    if (!low) for (let q = 0; q < 3; q++) { const a = hash(uc + q * 7.1, hv * 9); at('pipe', uc - len / sections / 2 + a * len / sections, vm + (hash(q, uc) - 0.5) * depth * 0.6, 0.2); }
  }
  if (!low) {
    const nA = 1 + Math.floor(hash(hv * 3, 1) * 3);
    for (let k = 0; k < nA; k++) { const a = hash(hv * 7, k); at('antenna', u0 + (0.15 + 0.7 * a) * len, vm + (hash(k, hv) - 0.5) * depth * 0.4, 0.5, -yawA + hash(k, 3) * 6.28); }
    const nD = Math.floor(hash(hv * 5, 2) * 5);
    for (let k = 0; k < nD; k++) {                          // satellite dishes look south-south-east (to the Astra / Eutelsat belt) from near the parapet
      const a = hash(hv * 11, k), side = hash(k, hv * 2) > 0.5 ? 1 : -1;
      at('dish', u0 + (0.08 + 0.84 * a) * len, side > 0 ? v1 - 1.0 : v0 + 1.0, 0.35, 0.25 + (hash(k, 9) - 0.5) * 0.3);
    }
    if (hash(hv, 13) > 0.4) at('hatch', u0 + (0.3 + 0.4 * hash(hv, 17)) * len, vm + depth * 0.25, 0.6, -yawA);
  }
}

// Height of the roof surface over a point (u along the ridge, v across, in the roof frame) as near-ring.ts builds it: a hip roof's eaves stand 0.5 m out and
// 0.15 m down, a gable roof's 0.45 m out and 0.15 m down with the ridge raised by the eave overhang; and the pitch of the slope.
function roofY(r: RoofSite, u: number, v: number): number {
  const R = r.roof!;
  if (r.gable) { const ev = R.hv + 0.45, top = R.h + R.rh + 0.2 * R.rh / ev; return top - (top - R.h + 0.15) * Math.abs(v) / ev; }
  const d = Math.max(Math.abs(v), Math.abs(u) - R.rl); return R.h + R.rh - (R.rh + 0.15) * d / (R.hv + 0.5);
}
const roofPitch = (r: RoofSite): number => { const R = r.roof!; return r.gable ? Math.atan2(R.rh + 0.2 * R.rh / (R.hv + 0.45) + 0.15, R.hv + 0.45) : Math.atan2(R.rh + 0.15, R.hv + 0.5); };

function tileProps(r: RoofSite, put: (m: string, i: Inst) => void, low: boolean, detail: boolean): void {
  const R = r.roof!, hv = r.hv, bx = [-R.ax[1], R.ax[0]], yawA = Math.atan2(R.ax[1], R.ax[0]);
  const W = (u: number, v: number): [number, number] => [R.cx + R.ax[0] * u + bx[0] * v, R.cz + R.ax[1] * u + bx[1] * v];
  // chimneys: one or two, on the slopes near the ridge, square to the ridge
  const nC = R.rl < 3 ? 1 : 1 + (hash(hv, 3) > 0.7 ? 1 : 0);
  for (let k = 0; k < nC; k++) {
    const u = (nC === 1 ? hash(hv, 5) - 0.5 : (k ? 0.35 : -0.35) + (hash(hv, k) - 0.5) * 0.2) * Math.max(0.5, R.rl) * 1.2, v = (hash(k, hv * 7) - 0.5) * R.hv * 0.7;
    const [x, z] = W(u, v), y = roofY(r, u, v);
    put('chimney', { x, y: y - 0.75, z, yaw: -yawA, shade: 0.88 + 0.16 * hash(x, z) });
  }
  if (!detail) return;
  // roof windows on a slope (not on the near houses with dormers): in the roof plane
  if (!low && (r.dist >= 48 || r.gable) && hash(hv, 11) > 0.45) {
    const slope = roofPitch(r), side = hash(hv, 13) > 0.5 ? 1 : -1, nW = 1 + Math.floor(hash(hv, 17) * 2);
    for (let k = 0; k < nW; k++) {
      const u = (nW === 1 ? 0 : (k ? 0.5 : -0.5)) * Math.min(R.rl, 3) + (hash(k, hv) - 0.5), v = side * R.hv * 0.5;
      const [x, z] = W(u, v);
      put('skylight', { x, y: roofY(r, u, v) + 0.03, z, yaw: -yawA + (side > 0 ? Math.PI : 0), pitch: -slope });
    }
  }
  // gutters under the eaves (along the long sides of a gable roof, all round a hip roof) and two downpipes
  const p = r.p, sg = r.sign ?? 1; if (!p) return;
  const n = p.length / 2, eaves: [number, number, number, number][] = [];
  if (r.gable) {
    const ev = R.hv + 0.45 + 0.06, eu = R.hu - 0.2;
    for (const s of [-1, 1]) { const [x0, z0] = W(-eu, s * ev), [x1, z1] = W(eu, s * ev); eaves.push([x0, z0, x1, z1]); }
  } else for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ex = p[2 * j] - p[2 * i], ez = p[2 * j + 1] - p[2 * i + 1], l = Math.hypot(ex, ez); if (l < 1.5) continue;
    const nx = ez / l * sg * 0.56, nz = -ex / l * sg * 0.56;
    eaves.push([p[2 * i] + nx - ex / l * 0.4, p[2 * i + 1] + nz - ez / l * 0.4, p[2 * j] + nx + ex / l * 0.4, p[2 * j + 1] + nz + ez / l * 0.4]);
  }
  const gy = R.h - 0.25;
  for (const [x0, z0, x1, z1] of eaves) put('gutter', { x: x0, y: gy, z: z0, yaw: -Math.atan2(z1 - z0, x1 - x0), sx: Math.hypot(x1 - x0, z1 - z0) });
  if (!low) for (const k of [0, Math.floor(n / 2)]) {
    const i = k % n, q = (i + n - 1) % n, j = (i + 1) % n;
    let ox = 0, oz = 0; for (const [a, c] of [[q, i], [i, j]]) { const ex = p[2 * c] - p[2 * a], ez = p[2 * c + 1] - p[2 * a + 1], l = Math.hypot(ex, ez) || 1; ox += ez / l * sg; oz += -ex / l * sg; }
    const ol = Math.hypot(ox, oz) || 1;
    put('downpipe', { x: p[2 * i] + ox / ol * 0.16, y: 0, z: p[2 * i + 1] + oz / ol * 0.16, yaw: 0, sy: gy });
  }
}

/** Instanced roof props on the near-ring roofs (`near.userData.roofs`); adds the meshes to `group`. Returns the number of props. */
export function buildRoofProps(group: THREE.Object3D, roofs: RoofSite[], kit: Kit): number {
  const src = kit.roofprops as THREE.Object3D | undefined; if (!src) return 0;
  src.updateMatrixWorld(true);
  const geos = new Map<string, THREE.BufferGeometry>();
  src.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) geos.set(m.name.replace(/\.\d+$/, ''), m.geometry.clone().applyMatrix4(m.matrixWorld)); });
  const low = settings.quality === 'low', maxD = low ? 170 : 330;
  const lists = new Map<string, Inst[]>();
  const put = (m: string, i: Inst) => { let l = lists.get(m); if (!l) { l = []; lists.set(m, l); } l.push(i); };
  for (const r of roofs) {
    if (r.dist > maxD) continue;
    if ((r.kind === 'panel' || (r.kind === 'mid' && r.h > 12)) && r.p) panelProps(r, put, low);
    if (r.kind === 'tile' && r.roof && r.dist < (low ? 90 : 170)) tileProps(r, put, low, r.dist < (low ? 32 : 60));
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const o3 = new THREE.Object3D(), c = new THREE.Color();
  let total = 0;
  for (const [name, list] of lists) {
    const g = geos.get(name); if (!g || !list.length) continue;
    const im = new THREE.InstancedMesh(g, mat, list.length); im.name = 'roofprop-' + name;
    list.forEach((it, k) => {
      o3.position.set(it.x, it.y, it.z); o3.rotation.set(it.pitch ?? 0, it.yaw, 0, 'YXZ'); o3.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1); o3.updateMatrix();
      im.setMatrixAt(k, o3.matrix); im.setColorAt(k, c.setScalar(it.shade ?? 1));
    });
    im.computeBoundingSphere(); im.castShadow = ['lift', 'stair', 'vents', 'chimney'].includes(name); im.receiveShadow = true;
    group.add(im); total += list.length;
  }
  group.userData.roofProps = Object.fromEntries([...lists].map(([k, v]) => [k, v.length]));
  (globalThis as unknown as { __roofProps: unknown }).__roofProps = { counts: group.userData.roofProps, at: Object.fromEntries([...lists].map(([k, v]) => [k, [...v].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, 3).map((i) => [i.x, i.y, i.z])])) };       // debug: props per module of the last near ring
  return total;
}
