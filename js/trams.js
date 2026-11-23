// Tram lines of an OpenStreetMap near ring (railway=tram): a track bed in the street (paved next to a road, grass elsewhere), two steel
// rails standing 9 cm above the bed, an overhead wire on poles, platforms with a shelter at the tram stops, and low-poly trams
// (three sections, red and white, own geometry, no external asset) that run along the lines and stand a few seconds at every stop.
// Line logic (chaining the OSM ways, snapping stops, the timetable) is plain data in js/core/tram-route.js.
import * as THREE from 'three';
import { mergeColored } from './world.js';
import { Builder, LAYER, ribbon, stripe, mesh, layerMat, material } from './near-ring.js';
import { joinWays, makeRoute, pointAt, snapStops, makeSchedule } from './core/tram-route.js';

const GAUGE = 1.435, BED_W = 3.2, RAIL_Y0 = LAYER.bed, RAIL_Y1 = LAYER.bed + 0.09, WIRE_Y = 5.6;
const STEEL = new THREE.Color(0x8a8d92), WIRE = new THREE.Color(0x2b2b2e), PLATFORM = new THREE.Color(0xb9b4a8), EDGE = new THREE.Color(0xe8c547), SHELTER = new THREE.Color(0x6e8a99), POST = new THREE.Color(0x4a4d52);
const SECTION = 9, BELLOWS = 0.9, PITCH = SECTION + BELLOWS, AXLE = 3.2;     // metres

function offsetLine(p, off) {
  const out = [], n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = p[2 * b] - p[2 * a], dz = p[2 * b + 1] - p[2 * a + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    out.push(p[2 * i] - dz * off, p[2 * i + 1] + dx * off);
  }
  return out;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// One tram section, z forward, 1 unit = 1 m. `cab`: a driver's cab at the front (+z); the inner end (-z) carries the bellows.
function sectionGeometry(cab, pantograph) {
  const RED = 0xb3262d, DARK_RED = 0x8a1c22, WHITE = 0xece8df, GLASS = 0x26323f, GREY = 0x9a9ea3, BLACK = 0x2a2b2e;
  const L = SECTION, h = L / 2, parts = [
    [box(2.0, 0.28, L - 1.2, 0, 0.36, 0), BLACK],                                      // chassis between the bogies
    [box(2.4, 0.7, L, 0, 0.85, 0), RED],                                               // lower body
    [box(2.4, 0.95, L, 0, 3.0, 0), WHITE],                                             // upper body (above the windows)
    [box(2.0, 0.16, L - 0.4, 0, 3.55, 0), GREY],                                       // roof
    [box(2.38, 1.35, L - 0.1, 0, 1.87, 0), GLASS],                                     // window band
    [box(1.4, 0.3, 2.6, 0, 3.7, -1.2), GREY],                                          // roof air-conditioning
  ];
  for (let k = -3; k <= 3; k++) for (const s of [-1, 1]) parts.push([box(0.06, 1.35, 0.14, s * 1.2, 1.87, k * 1.2 + 0.3), WHITE]);   // window pillars
  for (const z of [-3.1, 0.1, 3.1]) for (const s of [-1, 1]) parts.push([box(0.08, 1.9, 1.3, s * 1.2, 1.55, z), DARK_RED]);        // doors
  for (const s of [-1, 1]) for (const z of [-3, 3]) parts.push([box(0.3, 0.55, 1.5, s * 0.8, 0.3, z), BLACK]);                       // bogies
  parts.push([box(2.1, 2.7, BELLOWS / 2, 0, 1.9, -h - BELLOWS / 4), BLACK]);           // bellows toward the next section
  if (cab) {
    parts.push([box(2.34, 1.5, 0.08, 0, 2.05, h + 0.02), GLASS], [box(2.4, 0.7, 0.3, 0, 0.85, h + 0.12), RED],      // windscreen, nose
      [box(1.6, 0.28, 0.08, 0, 3.35, h + 0.04), 0xf5d36a], [box(0.28, 0.2, 0.08, -0.85, 0.85, h + 0.3), 0xfff4c2], [box(0.28, 0.2, 0.08, 0.85, 0.85, h + 0.3), 0xfff4c2]);
  } else parts.push([box(2.1, 2.7, BELLOWS / 2, 0, 1.9, h + BELLOWS / 4), BLACK]);
  if (pantograph) {
    parts.push([box(0.08, 0.08, 1.7, 0, 4.6, 0.6), BLACK], [box(0.06, 1.0, 0.06, 0.3, 4.1, -0.1).rotateZ(0.0), BLACK], [box(0.06, 1.0, 0.06, -0.3, 4.1, -0.1), BLACK]);
  }
  return mergeColored(parts);
}
const tramMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
let geoCab = null, geoMid = null;
const geometries = () => { geoCab ??= sectionGeometry(true, false); geoMid ??= sectionGeometry(false, true); return [geoCab, geoMid, geoCab]; };

export function buildTramLine(osm, { group, inBuilding, clearPlaza }) {
  const lines = joinWays((osm.rails || []).map((r) => r.p)).map(makeRoute).filter((r) => r.len > 12);
  if (!lines.length) return null;
  const roads = osm.roads.filter((r) => r.k === 'main' || r.k === 'street' || r.k === 'lane');
  const nearRoad = (x, z) => {
    for (const r of roads) {
      const m = r.w / 2 + 2.5;
      for (let i = 0; i + 3 < r.p.length; i += 2) {
        const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l2 = dx * dx + dz * dz || 1;
        if (Math.abs(x - x0) > m + Math.abs(dx) || Math.abs(z - z0) > m + Math.abs(dz)) continue;
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / l2));
        if (Math.hypot(x - x0 - dx * t, z - z0 - dz * t) < m) return true;
      }
    }
    return false;
  };
  // track bed in runs of the same kind; rails and wire along the whole line
  const paved = new Builder(), grass = new Builder(), steel = new Builder(), wire = new Builder(), furniture = new Builder();
  for (const r of lines) {
    let run = [], kind = null;
    const flush = () => { if (run.length >= 4) ribbon(kind ? paved : grass, run, BED_W, LAYER.bed, 3); run = []; };
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const k = nearRoad((r.p[i] + r.p[i + 2]) / 2, (r.p[i + 1] + r.p[i + 3]) / 2);
      if (kind !== null && k !== kind) flush();
      if (!run.length) run.push(r.p[i], r.p[i + 1]);
      run.push(r.p[i + 2], r.p[i + 3]); kind = k;
    }
    flush();
    for (const side of [-1, 1]) {
      const q = offsetLine(r.p, side * GAUGE / 2);
      for (let i = 0; i + 3 < q.length; i += 2) stripe(steel, q[i], q[i + 1], q[i + 2], q[i + 3], 0.11, RAIL_Y0, RAIL_Y1, STEEL);
    }
    for (let i = 0; i + 3 < r.p.length; i += 2) stripe(wire, r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], 0.04, WIRE_Y, WIRE_Y + 0.04, WIRE);
  }
  mesh(paved, layerMat(null, 'bed', { color: 0x5d5c58, roughness: 1 }), group);
  mesh(grass, layerMat(null, 'bed', { color: 0x6f9a58, roughness: 1 }), group);
  mesh(steel, material(null, { vertexColors: true, roughness: 0.45, metalness: 0.5 }), group);
  mesh(wire, material(null, { vertexColors: true, roughness: 0.6 }), group);

  // poles on alternate sides every 36 m (one instanced mesh)
  const poles = [];
  for (const r of lines) for (let s = 12, k = 0; s < r.len - 6; s += 36, k++) {
    const [x, z, dx, dz] = pointAt(r, s), side = k % 2 ? 1 : -1, px = x - dz * 2.4 * side, pz = z + dx * 2.4 * side;
    if (inBuilding(px, pz) || clearPlaza(px, pz)) continue;
    poles.push([px, pz, Math.atan2(dz * side, -dx * side)]);     // the arm points back to the track
  }
  if (poles.length) {
    const geo = mergeColored([[new THREE.CylinderGeometry(0.07, 0.1, 6.3, 6).translate(0, 3.15, 0), 0x5b5e63], [box(2.4, 0.09, 0.09, 1.2, 6.0, 0), 0x5b5e63]]);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), poles.length), m = new THREE.Matrix4();
    poles.forEach(([x, z, a], i) => { m.makeRotationY(a).setPosition(x, 0, z); im.setMatrixAt(i, m); });
    im.castShadow = true; group.add(im);
  }

  // stops: a platform on one side of the line with a yellow edge and a small shelter
  const platforms = [];
  const stopsOf = (r) => snapStops(r, osm.stops || [], 16, 60);
  for (const r of lines) for (const s of stopsOf(r)) {
    const side = hashSide(r, s), [x, z, dx, dz] = pointAt(r, s), nx = -dz * side, nz = dx * side;
    const a = pointAt(r, s - 7), b = pointAt(r, s + 7), o = 2.7;
    if (inBuilding(x + nx * o, z + nz * o)) continue;
    platforms.push({ x: x + nx * o, z: z + nz * o });
    stripe(furniture, a[0] + nx * o, a[1] + nz * o, b[0] + nx * o, b[1] + nz * o, 2.2, 0, 0.28, PLATFORM);
    stripe(furniture, a[0] + nx * (o - 1.0), a[1] + nz * (o - 1.0), b[0] + nx * (o - 1.0), b[1] + nz * (o - 1.0), 0.25, 0, 0.3, EDGE);
    const sa = pointAt(r, s - 3), sb = pointAt(r, s + 3), so = o + 0.5;
    stripe(furniture, sa[0] + nx * so, sa[1] + nz * so, sb[0] + nx * so, sb[1] + nz * so, 1.3, 2.4, 2.5, SHELTER);
    for (const p of [sa, sb]) stripe(furniture, p[0] + nx * (so + 0.55) - dx * 0.05, p[1] + nz * (so + 0.55) - dz * 0.05, p[0] + nx * (so + 0.55) + dx * 0.05, p[1] + nz * (so + 0.55) + dz * 0.05, 0.1, 0.28, 2.4, POST);
    stripe(furniture, sa[0] + nx * (so + 0.62), sa[1] + nz * (so + 0.62), sb[0] + nx * (so + 0.62), sb[1] + nz * (so + 0.62), 0.05, 0.9, 2.3, SHELTER);   // back glass
  }
  mesh(furniture, material(null, { vertexColors: true, roughness: 0.85 }), group, true);

  // trams: the lines nearest to the tower first; each tram runs one way along its line, stands at the stops and starts again at the start
  const dOf = (r) => { let d = 1e9; for (let i = 0; i < r.p.length; i += 2) d = Math.min(d, Math.hypot(r.p[i], r.p[i + 1])); return d; };
  const span = 3 * PITCH - BELLOWS;
  const runs = lines.filter((r) => r.len > span + 40 && dOf(r) < 330).sort((a, b) => dOf(a) - dOf(b)).slice(0, 4)
    .map((r) => ({ r, sch: makeSchedule(r.len, stopsOf(r), { span, speed: 8.5, dwell: 7, pause: 4 }) }));
  const trams = [], geos = geometries();
  const MAX = 3;
  if (runs.length) for (let i = 0; i < MAX; i++) {
    const g = new THREE.Group(), sections = geos.map((geo, k) => { const m = new THREE.Mesh(geo, tramMat); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; });
    g.visible = false; group.add(g);
    const run = runs[i % runs.length], onSame = Math.floor(i / runs.length);
    trams.push({ g, sections, run, phase: onSame * run.sch.period * 0.5 + i * 11.3 });
  }
  let clock = 0, want = 1;
  const place = (t) => {
    const at = t.run.sch.at(clock + t.phase); t.at = at;
    t.sections.forEach((m, k) => {
      const c = at.s - SECTION / 2 - k * PITCH, f = pointAt(t.run.r, c + AXLE), b = pointAt(t.run.r, c - AXLE);
      m.position.set((f[0] + b[0]) / 2, 0.04, (f[1] + b[1]) / 2);
      m.rotation.y = Math.atan2(f[0] - b[0], f[1] - b[1]) + (k === 2 ? Math.PI : 0);
    });
  };
  return {
    platforms, lines: lines.length, trams: trams.length, stops: lines.reduce((n, r) => n + stopsOf(r).length, 0),
    // where each running tram is (middle section, metres) and whether it drives: for the checks
    where: () => trams.filter((t) => t.g.visible).map((t) => ({ x: t.sections[1].position.x, z: t.sections[1].position.z, moving: t.at.moving })),
    setCount(n) { want = n; trams.forEach((t, i) => { t.g.visible = i < n; if (t.g.visible) place(t); }); },
    update(dt) { clock += dt; trams.forEach((t) => { if (t.g.visible) place(t); }); },
  };
}
function hashSide(r, s) { return Math.sin(r.len * 12.9 + s * 0.37) > 0 ? 1 : -1; }

// The tram line of the scene in view; People.applyTraffic sets how many run, main.js advances the clock.
export const Trams = {
  line: null, want: 1,
  use(line) { this.line = line || null; this.setCount(this.want); },
  setCount(n) { this.want = n; this.line?.setCount(n); },
  update(dt) { this.line?.update(dt); },
};
