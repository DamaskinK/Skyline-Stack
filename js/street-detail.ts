// Draws the street detail of a near ring (S0004 03): granite kerbs, zebra crossings, stop lines, dashed centre lines, manholes, gully drains,
// traffic lights (which the cars obey, see world.ts), parked bikes at the racks and street name plates in Slovak. The positions are the plan
// of js/core/street-detail.ts; nothing is decided here. Paint sits on the `mark` layer (6.5 cm, polygon offset), kerbs stand 15 cm tall.
import * as THREE from 'three';
import { Builder, LAYER, layerMat, mesh, mergeParts } from './near-ring.js';
import { canvas2d } from './textures.js';
import { lightState } from './core/street-detail.js';
import type { Detail, Light } from './core/street-detail.js';
import type { Plan } from './core/placement.js';

const MARK = new THREE.Color(0xf2efe6), KERB = new THREE.Color(0xa9a69e), KERB_TOP = new THREE.Color(0xb7b4ab);
const UP = [0, 1, 0];
const uv0 = (): [number, number] => [0, 0];
const furnitureMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

// A straight bar without end caps (kerb piece): top and the two long sides.
function bar(b: Builder, x0: number, z0: number, x1: number, z1: number, w: number, y0: number, y1: number, top: THREE.Color, side: THREE.Color): void {
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz); if (l < 1e-3) return;
  const ux = dx / l, uz = dz / l, nx = -uz * w / 2, nz = ux * w / 2;
  const P = (x: number, z: number, s: number, y: number): number[] => [x + nx * s, y, z + nz * s];
  const quad = (A: number[], B: number[], C: number[], D: number[], n: number[], c: THREE.Color): void => { b.tri(A, B, C, n, uv0, c); b.tri(A, C, D, n, uv0, c); };
  quad(P(x0, z0, 1, y1), P(x0, z0, -1, y1), P(x1, z1, -1, y1), P(x1, z1, 1, y1), UP, top);
  quad(P(x0, z0, 1, y0), P(x1, z1, 1, y0), P(x1, z1, 1, y1), P(x0, z0, 1, y1), [-uz, 0, ux], side);
  quad(P(x0, z0, -1, y0), P(x0, z0, -1, y1), P(x1, z1, -1, y1), P(x1, z1, -1, y0), [uz, 0, -ux], side);
}
// A flat painted rectangle: centre, direction (unit), half length along it, half width across.
function paint(b: Builder, cx: number, cz: number, tx: number, tz: number, hl: number, hw: number, y: number): void {
  const nx = -tz * hw, nz = tx * hw, ax = tx * hl, az = tz * hl;
  const A = [cx - ax + nx, y, cz - az + nz], B = [cx - ax - nx, y, cz - az - nz], C = [cx + ax - nx, y, cz + az - nz], D = [cx + ax + nx, y, cz + az + nz];
  b.tri(A, B, C, UP, uv0, MARK); b.tri(A, C, D, UP, uv0, MARK);
}
const cyl = (r0: number, r1: number, h: number, y: number, seg = 8): THREE.BufferGeometry => new THREE.CylinderGeometry(r0, r1, h, seg).translate(0, y, 0);
const box = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
// a thin rod between two points (bike frame)
function rod(a: number[], b: number[], r: number): THREE.BufferGeometry {
  const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), g = new THREE.CylinderGeometry(r, r, v.length(), 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()));
  return g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
}
// A parked bike, length along z, wheels 0.33 m, frame white (tinted per instance).
const BIKE = (): [THREE.BufferGeometry, number][] => {
  const W = 0x1b1b1d, F = 0xffffff, rear = [0, 0.34, -0.55], front = [0, 0.34, 0.55], bb = [0, 0.3, -0.12], seat = [0, 0.78, -0.3], head = [0, 0.72, 0.38];
  return [
    [new THREE.TorusGeometry(0.33, 0.022, 5, 14).rotateY(Math.PI / 2).translate(0, 0.34, -0.55), W], [new THREE.TorusGeometry(0.33, 0.022, 5, 14).rotateY(Math.PI / 2).translate(0, 0.34, 0.55), W],
    [rod(rear, bb, 0.02), F], [rod(bb, seat, 0.02), F], [rod(seat, head, 0.02), F], [rod(bb, head, 0.022), F], [rod(rear, seat, 0.018), F], [rod(head, front, 0.02), F],
    [box(0.08, 0.04, 0.2, 0, 0.8, -0.3), W], [box(0.5, 0.03, 0.03, 0, 0.8, 0.4), W],
  ];
};
// traffic light: pole, arm, head with three dark lenses; the lit lens is an instanced disc on top
const TL_POLE = (): [THREE.BufferGeometry, number][] => [[cyl(0.07, 0.09, 3.4, 1.7, 6), 0x3b4047], [box(0.34, 1.0, 0.3, 0, 3.55, 0.08), 0x1d1f23], [box(0.46, 1.12, 0.04, 0, 3.55, -0.1), 0xe8e4d8]];
const LENS_Y = [3.88, 3.55, 3.22];     // red, amber, green

// Street name plates (white on blue, as on Slovak street signs): one atlas, one draw call.
const ROW = 64, ATLAS_W = 256;
function plateAtlas(names: string[]): { tex: THREE.CanvasTexture; rows: Map<string, number>; h: number } {
  const n = Math.max(1, names.length), h = 1 << Math.ceil(Math.log2(n * ROW)), [c, x] = canvas2d(ATLAS_W, Math.min(h, 4096));
  const rows = new Map<string, number>();
  names.slice(0, Math.floor(4096 / ROW)).forEach((name, i) => {
    rows.set(name, i); const y = i * ROW;
    x.fillStyle = '#1d5aa8'; x.fillRect(0, y, ATLAS_W, ROW); x.strokeStyle = '#f4f1e8'; x.lineWidth = 3; x.strokeRect(4, y + 4, ATLAS_W - 8, ROW - 8);
    x.fillStyle = '#f4f1e8'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 30; x.font = `bold ${size}px sans-serif`; while (x.measureText(name).width > ATLAS_W - 26 && size > 12) { size -= 2; x.font = `bold ${size}px sans-serif`; }
    x.fillText(name, ATLAS_W / 2, y + ROW / 2 + 1);
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, rows, h: c.height };
}

export interface LightsHandle { lights: Light[]; update(dt: number): void; time(): number }
export interface DetailHandle { lights: LightsHandle | null; counts: Record<string, number> }

export function buildStreetDetail(plan: Plan, group: THREE.Group): DetailHandle {
  const d: Detail = plan.detail, counts: Record<string, number> = {};
  // kerbs
  const kerb = new Builder();
  for (const [x0, z0, x1, z1] of d.kerbs) bar(kerb, x0, z0, x1, z1, 0.18, 0.02, 0.15, KERB_TOP, KERB);
  const km = mesh(kerb, furnitureMat, group, true); if (km) km.name = 'kerbs';
  // paint
  const mark = new Builder();
  for (const z of d.zebras) {
    const tx = Math.sin(z.rot), tz = Math.cos(z.rot), nx = -tz, nz = tx, n = Math.floor(z.w / 1.0);
    for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 1.0; paint(mark, z.x + nx * o, z.z + nz * o, tx, tz, 1.5, 0.25, LAYER.mark); }
  }
  for (const s of d.stopLines) { const tx = Math.sin(s.rot), tz = Math.cos(s.rot); paint(mark, s.x + tz * s.w / 2, s.z - tx * s.w / 2, -tz, tx, s.w / 2, 0.2, LAYER.mark); }
  for (const [x0, z0, x1, z1] of d.dashes) { const l = Math.hypot(x1 - x0, z1 - z0) || 1; paint(mark, (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / l, (z1 - z0) / l, l / 2, 0.07, LAYER.mark); }
  const pm = mesh(mark, layerMat(null, 'mark', { vertexColors: true, roughness: 0.85 }), group); if (pm) pm.name = 'street-paint';
  // manholes and gully drains: instanced slabs a few cm above the carriageway
  const o = new THREE.Object3D();
  const inst = (name: string, parts: [THREE.BufferGeometry, number][], list: number[][], shadow = false): THREE.InstancedMesh | null => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(mergeParts(parts), furnitureMat, list.length);
    list.forEach(([x, z, rot], i) => { o.position.set(x, 0, z); o.rotation.set(0, rot, 0); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.receiveShadow = true; im.castShadow = shadow; im.name = name; group.add(im); return im;
  };
  inst('manholes', [[cyl(0.4, 0.4, 0.05, 0.055, 12), 0x3a3b3e], [cyl(0.3, 0.3, 0.052, 0.056, 12), 0x55575b]], d.manholes);
  inst('drains', [[box(0.7, 0.05, 0.4, 0, 0.055, 0), 0x2d2e31], ...[-0.24, -0.08, 0.08, 0.24].map((x): [THREE.BufferGeometry, number] => [box(0.05, 0.052, 0.3, x, 0.056, 0), 0x6a6c70])], d.drains);
  counts.kerbs = d.kerbs.length; counts.zebras = d.zebras.length; counts.dashes = d.dashes.length; counts.manholes = d.manholes.length; counts.drains = d.drains.length;

  // traffic lights
  let handle: LightsHandle | null = null;
  const heads = d.lights.flatMap((l) => l.arms.map((a) => ({ l, a })));
  if (heads.length) {
    const poles = new THREE.InstancedMesh(mergeParts(TL_POLE()), furnitureMat, heads.length);
    const lens = LENS_Y.map((y) => { const im = new THREE.InstancedMesh(new THREE.CircleGeometry(0.115, 10).translate(0, y, 0.235), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.length); im.name = 'tl-lens'; return im; });
    heads.forEach(({ a }, i) => {
      o.position.set(a.x, 0.05, a.z); o.rotation.set(0, a.rot, 0); o.scale.setScalar(1); o.updateMatrix(); poles.setMatrixAt(i, o.matrix); for (const im of lens) im.setMatrixAt(i, o.matrix);
    });
    poles.castShadow = true; poles.receiveShadow = true; poles.name = 'traffic-lights'; group.add(poles, ...lens);
    const ON = [new THREE.Color(0xff3b30), new THREE.Color(0xffb020), new THREE.Color(0x3cff7a)], OFF = [new THREE.Color(0x2a0d0c), new THREE.Color(0x2a1d08), new THREE.Color(0x0c2214)];
    const last: number[] = heads.map(() => -1);
    const paintLights = (t: number): void => {
      heads.forEach(({ l, a }, i) => {
        const st = lightState(l, a.group, t); if (last[i] === st) return; last[i] = st;
        // state 0 green, 1 amber, 2 red; lens 0 red, 1 amber, 2 green
        lens[0].setColorAt(i, st === 2 ? ON[0] : OFF[0]); lens[1].setColorAt(i, st === 1 ? ON[1] : OFF[1]); lens[2].setColorAt(i, st === 0 ? ON[2] : OFF[2]);
      });
      for (const im of lens) if (im.instanceColor) im.instanceColor.needsUpdate = true;
    };
    for (const im of lens) im.setColorAt(0, OFF[0]);
    let clock = 0; paintLights(0);
    handle = { lights: d.lights, update(dt: number) { clock += dt; paintLights(clock); }, time: () => clock };
    
  }
  counts.lights = d.lights.length;

  // parked bikes at the racks: between the hoops, one or two per rack
  const bikes: number[][] = [];
  for (const [x, , z, rot] of plan.items.rack) {
    const cx = Math.cos(rot), sx = -Math.sin(rot);
    [-0.275, 0.275].forEach((u, k) => { if (((Math.abs(Math.floor(x * 3 + z * 5 + k * 7)) % 5) as number) < 3) bikes.push([x + cx * u, z + sx * u, rot]); });
  }
  if (bikes.length) {
    const im = new THREE.InstancedMesh(mergeParts(BIKE()), furnitureMat, bikes.length), tints = [0xc6483c, 0x2f6fb0, 0x3f8f4a, 0xe0a52a, 0x8a8f96, 0x1f2a36], c = new THREE.Color();
    bikes.forEach(([x, z, rot], i) => { o.position.set(x, 0.05, z); o.rotation.set(0, rot, 0); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.setHex(tints[i % tints.length])); });
    im.castShadow = true; im.receiveShadow = true; im.name = 'parked-bikes'; group.add(im);
  }
  counts.bikes = bikes.length;

  // street name plates on the sign posts: the name of the nearest named street
  const named = plan.osm.roads.filter((r) => r.n && (r.k === 'street' || r.k === 'main' || r.k === 'lane'));
  const nameAt = (x: number, z: number): string | null => {
    let best: string | null = null, bd = 12;
    for (const r of named) for (let i = 0; i + 3 < r.p.length; i += 2) {
      const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), dd = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (dd < bd) { bd = dd; best = r.n as string; }
    }
    return best;
  };
  const plates = plan.items.sign.map(([x, , z, rot]) => ({ x, z, rot, name: nameAt(x, z) })).filter((p): p is { x: number; z: number; rot: number; name: string } => !!p.name);
  if (plates.length) {
    const atlas = plateAtlas([...new Set(plates.map((p) => p.name))]), b = new Builder();
    for (const p of plates) {
      const row = atlas.rows.get(p.name); if (row === undefined) continue;
      const v0 = 1 - (row * ROW) / atlas.h, v1 = 1 - ((row + 1) * ROW) / atlas.h, cs = Math.cos(p.rot), sn = Math.sin(p.rot);
      const at = (u: number, y: number, zl: number): number[] => [p.x + u * cs + zl * sn, 0.05 + y, p.z - u * sn + zl * cs];
      for (const [zl, nz, flip] of [[0.045, 1, 1], [-0.045, -1, -1]] as [number, number, number][]) {
        const n = [nz * sn, 0, nz * cs], pts = [[-0.45 * flip, 2.36, 0], [0.45 * flip, 2.36, 1], [0.45 * flip, 2.64, 2], [-0.45 * flip, 2.64, 3]];
        const V = pts.map(([u, y]) => at(u, y, zl)), uvs = [[0, v1], [1, v1], [1, v0], [0, v0]] as [number, number][];
        const uvf = (q: number[]): [number, number] => uvs[Math.max(0, V.indexOf(q))];
        b.tri(V[0], V[1], V[2], n, uvf); b.tri(V[0], V[2], V[3], n, uvf);
      }
    }
    const m = new THREE.Mesh(b.geometry(), new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.6, metalness: 0.1 })); m.name = 'street-names'; m.receiveShadow = true; group.add(m);
  }
  counts.plates = plates.length;
  return { lights: handle, counts };
}
