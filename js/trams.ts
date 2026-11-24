// Tram lines of an OpenStreetMap near ring (railway=tram): a track bed in the street (paved next to a road, grass elsewhere), two steel
// rails standing 9 cm above the bed, an overhead wire on poles, platforms with a shelter at the tram stops, and low-poly trams
// (three sections, red and white, own geometry, no external asset) that run along the lines and stand a few seconds at every stop.
// Line logic (chaining the OSM ways, snapping stops, the timetable) is plain data in js/core/tram-route.js.
import * as THREE from 'three';
import { mergeColored, glowMats } from './world.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas2d } from './textures.js';
import { Builder, LAYER, ribbon, stripe, mesh, layerMat, material } from './near-ring.js';
import { BED_W } from './core/placement.js';
import { pointAt, snapStops, makeSchedule } from './core/tram-route.js';
import type { Route, Schedule } from './core/tram-route.js';
import type { OsmExtract } from './types.js';
import type { Plan } from './core/placement.js';

const GAUGE = 1.435, RAIL_Y0 = LAYER.bed, RAIL_Y1 = LAYER.bed + 0.09, WIRE_HI = 5.9, SAG = 0.32, SPAN = 36, PAN_Y = 5.75;
const STEEL = new THREE.Color(0x8a8d92), WIRE = new THREE.Color(0x2b2b2e), PLATFORM = new THREE.Color(0xb4b1a8), TACTILE = new THREE.Color(0xa8483c), SHELTER = new THREE.Color(0x6e8a99), POST = new THREE.Color(0x4a4d52), POLE = 0xc9a424;
const SECTION = 9, BELLOWS = 0.9, PITCH = SECTION + BELLOWS, AXLE = 3.2;     // metres

function offsetLine(p: number[], off: number): number[] {
  const out: number[] = [], n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = p[2 * b] - p[2 * a], dz = p[2 * b + 1] - p[2 * a + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    out.push(p[2 * i] - dz * off, p[2 * i + 1] + dx * off);
  }
  return out;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const rod = (a: number[], b: number[], r: number): THREE.BufferGeometry => {
  const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), g = new THREE.CylinderGeometry(r, r, v.length(), 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()));
  return g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
};

// A flat strip along a polyline with real corners (mitred), a top and two walls: platforms and shelter roofs that follow a bend without gaps.
function slab(b: Builder, p: number[], w: number, y0: number, y1: number, color: THREE.Color): void {
  const n = p.length / 2; if (n < 2) return;
  const nx: number[] = [], nz: number[] = [], k: () => [number, number] = () => [0, 0];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), c = Math.min(n - 1, i + 1);
    let dx = p[2 * c] - p[2 * a], dz = p[2 * c + 1] - p[2 * a + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    nx.push(-dz); nz.push(dx);
  }
  const L = (i: number, y: number): number[] => [p[2 * i] + nx[i] * w / 2, y, p[2 * i + 1] + nz[i] * w / 2], R = (i: number, y: number): number[] => [p[2 * i] - nx[i] * w / 2, y, p[2 * i + 1] - nz[i] * w / 2];
  const quad = (A: number[], B: number[], C: number[], D: number[], nn: number[]): void => { b.tri(A, B, C, nn, k, color); b.tri(A, C, D, nn, k, color); };
  for (let i = 0; i + 1 < n; i++) {
    const sx = (nx[i] + nx[i + 1]) / 2, sz = (nz[i] + nz[i + 1]) / 2;
    quad(L(i, y1), R(i, y1), R(i + 1, y1), L(i + 1, y1), [0, 1, 0]);
    quad(L(i, y0), L(i + 1, y0), L(i + 1, y1), L(i, y1), [sx, 0, sz]);
    quad(R(i, y0), R(i, y1), R(i + 1, y1), R(i + 1, y0), [-sx, 0, -sz]);
  }
  const e = n - 1, tx0 = p[0] - p[2], tz0 = p[1] - p[3], tx1 = p[2 * e] - p[2 * e - 2], tz1 = p[2 * e + 1] - p[2 * e - 1];
  quad(L(0, y0), L(0, y1), R(0, y1), R(0, y0), [tx0, 0, tz0]); quad(R(e, y0), R(e, y1), L(e, y1), L(e, y0), [tx1, 0, tz1]);
}
// points of a route from s0 to s1, every `step` metres
const sample = (r: Route, s0: number, s1: number, step: number): number[] => { const out: number[] = []; const n = Math.max(2, Math.ceil((s1 - s0) / step) + 1); for (let i = 0; i < n; i++) { const q = pointAt(r, s0 + (s1 - s0) * i / (n - 1)); out.push(q[0], q[1]); } return out; };
// overhead wire: hangs from the poles and sags between them (the strip is tilted, so the sag is a smooth curve)
function wireStrip(b: Builder, r: Route): void {
  const n = Math.max(2, Math.ceil(r.len / 1.5) + 1), P: number[][] = [];
  for (let i = 0; i < n; i++) { const s = r.len * i / (n - 1), f = (s % SPAN) / SPAN, q = pointAt(r, s); P.push([q[0], WIRE_HI - SAG * 4 * f * (1 - f), q[1], q[2], q[3]]); }
  const k = (): [number, number] => [0, 0];
  for (let i = 0; i + 1 < n; i++) {
    const a = P[i], c = P[i + 1], hw = 0.035, A = [a[0] - a[4] * hw, a[1], a[2] + a[3] * hw], B = [a[0] + a[4] * hw, a[1], a[2] - a[3] * hw];
    const C = [c[0] + c[4] * hw, c[1], c[2] - c[3] * hw], D = [c[0] - c[4] * hw, c[1], c[2] + c[3] * hw];
    for (const nn of [[0, 1, 0], [0, -1, 0]]) { b.tri(A, B, C, nn, k, WIRE); b.tri(A, C, D, nn, k, WIRE); }
  }
}

// ── the tram: a Vario LF2+ of the Kosice transport company (DPMK): three sections, sky blue with a white and a yellow sweep ──
// Colours and the face (yellow lamp panel under the windscreen, blue bumper, orange destination display, orange pantograph) from Commons photos:
// File:Vario LF2+ Kosice c801.JPG, File:Vario pri Hlavnej poste.jpg, File:Kosice-linka4-Kuzmanyho ulica.jpg.
const BLUE = 0x2b93d6, BLUE_DARK = 0x1f78b4, YELLOW = 0xf2b61c, WHITE = 0xf1efe8, GLASS = 0x1c2733, BLACK = 0x25262a, GREY = 0x9a9ea3;
const SKIN_W = 9, SKIN_H = 3.3, SKIN_Y0 = 0.3;       // metres covered by the side texture
function bodyGeometry(kind: 'front' | 'mid' | 'rear'): THREE.BufferGeometry {
  const L = SECTION, h = L / 2, parts: [THREE.BufferGeometry, number][] = [
    [box(2.0, 0.3, L - 1.0, 0, 0.35, 0), BLACK],                                       // underframe
    [box(2.36, 3.0, L, 0, 1.9, 0), BLUE],                                              // body (the sides are covered by the livery plates)
    [box(2.1, 0.16, L - 0.2, 0, 3.46, 0), BLUE_DARK],                                  // roof
    [box(1.5, 0.28, 2.8, 0, 3.64, -1.0), GREY], [box(1.2, 0.2, 2.0, 0, 3.6, 2.2), GREY],  // roof equipment
  ];
  for (const s of [-1, 1]) for (const z of [-3, 3]) parts.push([box(0.3, 0.55, 1.5, s * 0.8, 0.3, z), BLACK]);   // bogies
  parts.push([box(2.1, 2.7, BELLOWS / 2, 0, 1.9, -h - BELLOWS / 4), BLACK]);           // bellows toward the next section
  if (kind === 'mid') {
    parts.push([box(2.1, 2.7, BELLOWS / 2, 0, 1.9, h + BELLOWS / 4), BLACK]);
    // pantograph: orange arms from the roof up to the wire, black contact strip
    parts.push([rod([0, 3.55, -2.4], [0, PAN_Y - 0.08, 0.2], 0.035), 0xe58a28], [rod([0, 3.55, -1.4], [0, PAN_Y - 0.08, 0.2], 0.03), 0xe58a28], [box(1.7, 0.05, 0.1, 0, PAN_Y - 0.03, 0.2), BLACK], [box(0.1, 0.04, 0.9, 0.8, PAN_Y - 0.03, 0.2), BLACK], [box(0.1, 0.04, 0.9, -0.8, PAN_Y - 0.03, 0.2), BLACK]);
  } else {
    // the face at +z: yellow roof front, big windscreen, yellow lamp panel, white band, blue bumper
    parts.push([box(2.4, 0.5, 0.14, 0, 3.2, h + 0.0), YELLOW], [box(2.3, 1.5, 0.08, 0, 2.3, h + 0.03), GLASS], [box(2.4, 0.5, 0.2, 0, 1.28, h + 0.08), YELLOW],
      [box(2.4, 0.3, 0.26, 0, 0.88, h + 0.1), WHITE], [box(2.4, 0.62, 0.34, 0, 0.5, h + 0.12), BLUE], [box(1.3, 0.3, 0.04, 0, 0.45, h + 0.31), BLUE_DARK],
      [box(0.06, 1.5, 0.06, -1.17, 2.3, h + 0.05), WHITE], [box(0.06, 1.5, 0.06, 1.17, 2.3, h + 0.05), WHITE]);
  }
  return mergeColored(parts);
}
// the lamps of a cab (+z end), white at the front of the tram, red at its rear, and the orange destination display
function lampGeometry(color: number): THREE.BufferGeometry { const h = SECTION / 2; return mergeColored([[box(0.3, 0.2, 0.06, -0.85, 1.28, h + 0.2), color], [box(0.3, 0.2, 0.06, 0.85, 1.28, h + 0.2), color], [box(0.14, 0.14, 0.05, -0.45, 0.62, h + 0.3), color], [box(0.14, 0.14, 0.05, 0.45, 0.62, h + 0.3), color]]); }
function ledGeometry(): THREE.BufferGeometry { return box(1.5, 0.2, 0.04, 0, 2.88, SECTION / 2 + 0.08); }

// Side plates with the livery; the same canvas drawn again in warm light is the emissive map (the windows glow at night).
function liveryTextures(): { map: THREE.CanvasTexture; emis: THREE.CanvasTexture } {
  const W = 1024, H = 256, [c, x] = canvas2d(W, H), [ce, xe] = canvas2d(W, H);
  const px = (m: number): number => m / SKIN_W * W, py = (ym: number): number => (SKIN_Y0 + SKIN_H - ym) / SKIN_H * H;
  x.fillStyle = '#2b93d6'; x.fillRect(0, 0, W, H); xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
  // yellow and white sweeps: from the lower left rising to the window sill on the right, repeated as one wave per section
  const wave = (col: string, a: number, b: number, c0: number): void => {
    x.fillStyle = col; x.beginPath(); x.moveTo(px(a), py(0.3)); x.bezierCurveTo(px(a + 2), py(0.3), px(b - 2), py(c0), px(b), py(c0 + 0.9)); x.lineTo(px(b + 1.6), py(c0 + 0.9)); x.lineTo(px(b + 1.6), py(0.3)); x.closePath(); x.fill();
  };
  wave('#f1efe8', 3.2, 6.4, 1.0); wave('#f2b61c', 4.4, 7.4, 0.95);
  x.fillStyle = '#f2b61c'; x.beginPath(); x.moveTo(0, py(3.4)); x.lineTo(px(2.6), py(3.4)); x.lineTo(px(1.6), py(2.95)); x.lineTo(0, py(2.95)); x.fill();   // yellow roof-line wedge
  x.fillStyle = '#f1efe8'; x.fillRect(0, py(0.62), px(2.6), py(0.3) - py(0.62));
  // windows (glass band) with pillars, and two doors
  const win = (m0: number, m1: number, y0: number, y1: number, glass: string, lit: string): void => { x.fillStyle = glass; x.fillRect(px(m0), py(y1), px(m1) - px(m0), py(y0) - py(y1)); xe.fillStyle = lit; xe.fillRect(px(m0), py(y1), px(m1) - px(m0), py(y0) - py(y1)); };
  for (let i = 0; i < 6; i++) { const m0 = 0.35 + i * 1.45, lit = i % 3 === 1 ? '#c9a45a' : '#ffd88a'; win(m0, m0 + 1.3, 1.15, 2.95, '#1c2733', lit); }
  for (const dm of [2.1, 6.1]) { x.fillStyle = '#f1efe8'; x.fillRect(px(dm - 0.05), py(2.95), px(1.5), py(0.45) - py(2.95)); win(dm + 0.05, dm + 1.35, 0.55, 2.9, '#1c2733', '#ffe7a8'); }
  const map = new THREE.CanvasTexture(c), emis = new THREE.CanvasTexture(ce);
  for (const t of [map, emis]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
  return { map, emis };
}
let kit: { body: THREE.BufferGeometry[]; lampW: THREE.BufferGeometry; lampR: THREE.BufferGeometry; led: THREE.BufferGeometry; skin: THREE.BufferGeometry; skinMat: THREE.MeshStandardMaterial; lampWMat: THREE.MeshStandardMaterial; lampRMat: THREE.MeshStandardMaterial } | null = null;
const getKit = (): NonNullable<typeof kit> => {
  if (kit) return kit;
  const { map, emis } = liveryTextures();
  const skinMat = new THREE.MeshStandardMaterial({ map, emissiveMap: emis, emissive: 0xb8a070, emissiveIntensity: 0, roughness: 0.5, metalness: 0.1 });
  const lampWMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: 0, roughness: 0.3 }), lampRMat = new THREE.MeshStandardMaterial({ color: 0xc02020, emissive: 0xff2a2a, emissiveIntensity: 0, roughness: 0.3 });
  glowMats.push(skinMat, lampWMat, lampRMat);        // world.ts brightens them as night falls
  const plate = (s: number): THREE.BufferGeometry => new THREE.PlaneGeometry(SKIN_W, SKIN_H).rotateY(s * Math.PI / 2).translate(s * 1.19, SKIN_Y0 + SKIN_H / 2, 0);
  const skin = mergeGeometries([plate(1), plate(-1)]) as THREE.BufferGeometry;
  kit = { body: [bodyGeometry('front'), bodyGeometry('mid'), bodyGeometry('rear')], lampW: lampGeometry(0xffffff), lampR: lampGeometry(0xffffff), led: ledGeometry(), skin, skinMat, lampWMat, lampRMat };
  return kit;
};
const tramMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.15 });
const ledMat = new THREE.MeshBasicMaterial({ color: 0xff9a30 });

// What the near ring hands to the tram line: the group to add to and the plan (js/core/placement.ts) with the lines, beds, poles and platforms that fit.
export interface TramHost { group: THREE.Group; plan: Plan }
interface TramRun { sections: THREE.Object3D[]; run: { r: Route; sch: Schedule }; phase: number; visible: boolean; at?: { s: number; moving: boolean } }
// A running tram line: what the checks and People read, and what main.js drives.
export interface TramLine {
  platforms: { x: number; z: number }[]; lines: number; trams: number; stops: number;
  where(): { x: number; z: number; moving: boolean }[]; setCount(n: number): void; update(dt: number): void;
}
export function buildTramLine(osm: OsmExtract, { group, plan }: TramHost): TramLine | null {
  const lines = plan.tramLines;
  if (!lines.length) return null;
  // track bed in runs of the same kind (paved beside a road, grass elsewhere); rails and wire along the whole line
  const paved = new Builder(), grass = new Builder(), steel = new Builder(), wire = new Builder(), furniture = new Builder();
  for (const bed of plan.tramBeds) ribbon(bed.paved ? paved : grass, bed.p, BED_W, LAYER.bed, 3);
  for (const r of lines) {
    for (const side of [-1, 1]) {
      const q = offsetLine(r.p, side * GAUGE / 2);
      for (let i = 0; i + 3 < q.length; i += 2) stripe(steel, q[i], q[i + 1], q[i + 2], q[i + 3], 0.11, RAIL_Y0, RAIL_Y1, STEEL);
    }
    wireStrip(wire, r);
  }
  mesh(paved, layerMat(null, 'bed', { color: 0x5d5c58, roughness: 1 }), group);
  mesh(grass, layerMat(null, 'bed', { color: 0x6f9a58, roughness: 1 }), group);
  mesh(steel, material(null, { vertexColors: true, roughness: 0.45, metalness: 0.5 }), group);
  mesh(wire, material(null, { vertexColors: true, roughness: 0.6 }), group);

  // poles on alternate sides every 36 m (the plan keeps those whose spot is free; one instanced mesh), painted yellow like the DPMK poles
  const poles = plan.poles;
  if (poles.length) {
    const geo = mergeColored([[new THREE.CylinderGeometry(0.07, 0.1, 6.3, 6).translate(0, 3.15, 0), POLE], [box(2.4, 0.09, 0.09, 1.2, 6.0, 0), POLE]]);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), poles.length), m = new THREE.Matrix4();
    poles.forEach(([x, z, a], i) => { m.makeRotationY(a).setPosition(x, 0, z); im.setMatrixAt(i, m); });
    im.castShadow = true; group.add(im);
  }

  // stops: a platform of paving with a red tactile strip on one side of the line and a small shelter (the plan keeps those that fit); it follows bends
  const platforms: { x: number; z: number }[] = [];
  const stopsOf = (r: Route) => snapStops(r, osm.stops || [], 16, 60);
  for (const pl of plan.platforms) {
    const r = lines[pl.line], s = pl.s;
    const side = hashSide(r, s), [x, z, dx, dz] = pointAt(r, s), nx = -dz * side, nz = dx * side, o = 2.7;
    platforms.push({ x: x + nx * o, z: z + nz * o });
    const run = (a: number, b: number, off: number): number[] => offsetLine(sample(r, s + a, s + b, 1.75), side * off);
    slab(furniture, run(-7, 7, o), 2.2, 0, 0.28, PLATFORM);
    slab(furniture, run(-7, 7, o - 0.75), 0.4, 0, 0.3, TACTILE);
    const so = o + 0.5;
    slab(furniture, run(-3, 3, so), 1.3, 2.4, 2.5, SHELTER);
    for (const e of [-3, 3]) { const q = offsetLine(sample(r, s + e - 0.05, s + e + 0.05, 0.1), side * (so + 0.55)); slab(furniture, q, 0.1, 0.28, 2.4, POST); }
    slab(furniture, run(-3, 3, so + 0.62), 0.05, 0.9, 2.3, SHELTER);   // back glass
  }
  mesh(furniture, material(null, { vertexColors: true, roughness: 0.85 }), group, true);

  // trams: the lines nearest to the tower first; each tram runs one way along its line, stands at the stops and starts again at the start
  const dOf = (r: Route) => { let d = 1e9; for (let i = 0; i < r.p.length; i += 2) d = Math.min(d, Math.hypot(r.p[i], r.p[i + 1])); return d; };
  const span = 3 * PITCH - BELLOWS;
  const runs = lines.filter((r) => r.len > span + 40 && dOf(r) < 330).sort((a, b) => dOf(a) - dOf(b)).slice(0, 4)
    .map((r) => ({ r, sch: makeSchedule(r.len, stopsOf(r), { span, speed: 8.5, dwell: 7, pause: 4 }) }));
  const trams: TramRun[] = [], MAX = 3;
  // one InstancedMesh per kind of part, an instance per tram (or per section for the side plates)
  const K = getKit(), mk = (g: THREE.BufferGeometry, m: THREE.Material, n: number, shadow: boolean): THREE.InstancedMesh => { const im = new THREE.InstancedMesh(g, m, n); im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false; im.count = 0; group.add(im); return im; };
  const bodies = K.body.map((g) => mk(g, tramMat, MAX, true)), skins = mk(K.skin, K.skinMat, MAX * 3, false), lampW = mk(K.lampW, K.lampWMat, MAX, false), lampR = mk(K.lampR, K.lampRMat, MAX, false), led = mk(K.led, ledMat, MAX, false);
  skins.name = 'tram-sides';
  if (runs.length) for (let i = 0; i < MAX; i++) {
    const run = runs[i % runs.length], onSame = Math.floor(i / runs.length);
    trams.push({ sections: [0, 1, 2].map(() => new THREE.Object3D()), run, phase: onSame * run.sch.period * 0.5 + i * 11.3, visible: false });
  }
  let clock = 0, want = 1;
  const place = (t: TramRun): void => {
    const at = t.run.sch.at(clock + t.phase); t.at = at;
    t.sections.forEach((m, k) => {
      const c = at.s - SECTION / 2 - k * PITCH, f = pointAt(t.run.r, c + AXLE), b = pointAt(t.run.r, c - AXLE);
      m.position.set((f[0] + b[0]) / 2, 0.04, (f[1] + b[1]) / 2);
      m.rotation.y = Math.atan2(f[0] - b[0], f[1] - b[1]) + (k === 2 ? Math.PI : 0);
      m.updateMatrix();
    });
  };
  const flush = (): void => {
    const vis = trams.filter((t) => t.visible); let n = 0;
    for (const t of vis) {
      t.sections.forEach((m, k) => { bodies[k].setMatrixAt(n, m.matrix); skins.setMatrixAt(n * 3 + k, m.matrix); });
      lampW.setMatrixAt(n, t.sections[0].matrix); lampR.setMatrixAt(n, t.sections[2].matrix); led.setMatrixAt(n, t.sections[0].matrix); n++;
    }
    for (const im of [...bodies, lampW, lampR, led]) { im.count = n; im.instanceMatrix.needsUpdate = true; }
    skins.count = n * 3; skins.instanceMatrix.needsUpdate = true;
  };
  return {
    platforms, lines: lines.length, trams: trams.length, stops: lines.reduce((n, r) => n + stopsOf(r).length, 0),
    // where each running tram is (middle section, metres) and whether it drives: for the checks
    where: () => trams.filter((t) => t.visible).map((t) => ({ x: t.sections[1].position.x, z: t.sections[1].position.z, moving: (t.at as { moving: boolean }).moving })),
    setCount(n) { want = n; trams.forEach((t, i) => { t.visible = i < n; if (t.visible) place(t); }); flush(); },
    update(dt) { clock += dt; trams.forEach((t) => { if (t.visible) place(t); }); flush(); },
  };
}
function hashSide(r: Route, s: number): number { return Math.sin(r.len * 12.9 + s * 0.37) > 0 ? 1 : -1; }

// The tram line of the scene in view; People.applyTraffic sets how many run, main.js advances the clock.
export const Trams: { line: TramLine | null; want: number; use(line: TramLine | null | undefined): void; setCount(n: number): void; update(dt: number): void } = {
  line: null, want: 1,
  use(line) { this.line = line || null; this.setCount(this.want); },
  setCount(n) { this.want = n; this.line?.setCount(n); },
  update(dt) { this.line?.update(dt); },
};
