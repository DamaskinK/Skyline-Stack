// The near ring of a level: real streets, building footprints, parks and water from OpenStreetMap (assets/levels/<id>/osm.json,
// made by scripts/build-osm-level.mjs), with CC0 kit props (street lights, bushes, parked cars) instanced.
// Frame: 1 unit = 1 m, x east, z south, origin = build site = tower. A small paved plaza stays clear around the tower.
// Draw calls: ground layers, one wall mesh per facade variant, one roof mesh, a few instanced props.
import * as THREE from 'three';
import { facade, roofTex, pavingTex, grassTex, sidewalkTex } from './textures.js';
import { glowMats, GROUND_Y } from './world.js';

export const PLAZA_HALF = 14;      // paved square around the tower
const CLEAR = 24;                  // no buildings closer than this to the origin

// ground heights: every layer a real step above the one below, plus a depth bias for the far distance
const LAYER = { urban: 0.01, park: 0.02, water: 0.03, road: 0.04, path: 0.05, plaza: GROUND_Y.walk };
const BIAS = { urban: 1, park: 2, water: 3, road: 4, path: 5 };

// ── tiny geometry builder (non-indexed, world-space uv) ──
class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  tri(a, b, c, n, uvf) {
    // flip the winding when the geometric normal points away from n
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    if (gx * n[0] + gy * n[1] + gz * n[2] < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); const t = uvf(p); this.uv.push(t[0], t[1]); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
  get empty() { return this.pos.length === 0; }
}
const UP = [0, 1, 0];

function polyArea(p) { let a = 0; for (let i = 0, n = p.length / 2; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; }
function fillPoly(b, p, y, scale, n = UP) {
  const pts = []; for (let i = 0; i < p.length; i += 2) pts.push(new THREE.Vector2(p[i], p[i + 1]));
  if (pts.length < 3) return;
  const tris = THREE.ShapeUtils.triangulateShape(pts, []);
  const uvf = (q) => [q[0] / scale, q[2] / scale];
  for (const [i, j, k] of tris) b.tri([pts[i].x, y, pts[i].y], [pts[j].x, y, pts[j].y], [pts[k].x, y, pts[k].y], n, uvf);
}
// a polyline with a width, as a flat ribbon with round-ish joints; same height and material everywhere, so overlaps are invisible
function ribbon(b, p, w, y, scale) {
  const uvf = (q) => [q[0] / scale, q[2] / scale], h = w / 2;
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
function hash(x, z) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
const insideRing = (p, x, z) => { let c = false; for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) { const xi = p[2 * i], zi = p[2 * i + 1], xj = p[2 * j], zj = p[2 * j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };

function material(map, o = {}) { const m = new THREE.MeshStandardMaterial({ map, roughness: 1, ...o }); return m; }
function layerMat(map, key, o = {}) {
  const m = material(map, o); m.polygonOffset = true; m.polygonOffsetFactor = -BIAS[key]; m.polygonOffsetUnits = -BIAS[key]; return m;
}
const tile = (t, rep = 1) => { const c = t.clone(); c.repeat.set(rep, rep); c.needsUpdate = true; return c; };
function mesh(b, mat, group, shadow = false) {
  if (b.empty) return null;
  const m = new THREE.Mesh(b.geometry(), mat); m.receiveShadow = true; m.castShadow = shadow; group.add(m); return m;
}

// ── kit props: one InstancedMesh per sub-mesh of the glTF, so a piece is a draw call or two however often it is placed ──
function instanceKit(src, list, targetHeight, group, { shadow = true, lengthFit = 0 } = {}) {
  if (!src || !list.length) return;
  const root = src.clone(true); root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const k = lengthFit ? lengthFit / Math.max(size.x, size.z, 1e-3) : targetHeight / Math.max(size.y, 1e-3);
  const base = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
    base.copy(o.matrixWorld);
    list.forEach(([x, y, z, r], i) => {
      place.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, r), new THREE.Vector3(k, k, k));
      im.setMatrixAt(i, place.clone().multiply(base));
    });
    im.castShadow = shadow; im.receiveShadow = true; group.add(im);
  });
}

export function buildNearRing(osm, kit = {}) {
  const group = new THREE.Group(); group.name = 'near-ring';
  const bbIn = (x, z, m = 0) => Math.abs(x) < osm.half - m && Math.abs(z) < osm.half - m;

  // ── ground ──
  const urban = new Builder(), park = new Builder(), water = new Builder(), road = new Builder(), path = new Builder();
  const H = osm.half;
  fillPoly(urban, [-H, -H, H, -H, H, H, -H, H], LAYER.urban, 6);
  for (const g of osm.parks) { if (polyArea(g.p) !== 0) fillPoly(park, g.p, LAYER.park, 8); }
  for (const g of osm.water) fillPoly(water, g.p, LAYER.water, 8);
  for (const r of osm.roads) {
    if (r.k === 'walk' || r.k === 'path') ribbon(path, r.p, r.w, LAYER.path, 3);
    else ribbon(road, r.p, r.w, LAYER.road, 9);
  }
  for (const r of osm.rails) ribbon(path, r.p, 1.6, LAYER.path, 3);
  mesh(urban, layerMat(null, 'urban', { color: 0xaaa79f }), group);
  mesh(park, layerMat(tile(grassTex), 'park', { color: 0xcdeab8 }), group);
  mesh(water, layerMat(null, 'water', { color: 0x3b79a8, roughness: 0.15, metalness: 0.1 }), group);
  mesh(road, layerMat(null, 'road', { color: 0x2b2e35 }), group);
  mesh(path, layerMat(tile(sidewalkTex), 'path'), group);

  // the plaza slab at the origin: a 6 cm step with a curb, same as the procedural city had
  {
    const g = new THREE.BoxGeometry(PLAZA_HALF * 2, LAYER.plaza, PLAZA_HALF * 2).translate(0, LAYER.plaza / 2, 0);
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 7.6, p.getZ(i) / 7.6);
    const m = new THREE.Mesh(g, material(tile(pavingTex), { roughness: 0.95 })); m.receiveShadow = true; group.add(m);
  }

  // ── buildings: walls grouped by facade variant, one shared roof mesh ──
  const palette = [0xc7b39b, 0xe2d6bf, 0xd88c6a, 0xa7b08b, 0x9bb7a5, 0xd2c27a, 0xb8a08a, 0xcfc4b0];
  const walls = palette.map(() => new Builder()), roofs = new Builder(), kept = [];
  for (const bd of osm.buildings) {
    const p = bd.p, n = p.length / 2;
    if (n < 3) continue;
    let cx = 0, cz = 0, near = Infinity;
    for (let i = 0; i < p.length; i += 2) { cx += p[i]; cz += p[i + 1]; near = Math.min(near, Math.hypot(p[i], p[i + 1])); }
    cx /= n; cz /= n;
    if (near < CLEAR || insideRing(p, 0, 0)) continue;
    const hv = hash(cx, cz);
    let h = bd.h >= 3 ? bd.h : (bd.k === 'church' ? 22 : bd.k === 'theatre' ? 17 : 9 + hv * 8);
    h = Math.min(h, 70);
    kept.push(p);
    const v = Math.floor(hv * 1000) % palette.length, W = walls[bd.k === 'church' ? 0 : v];
    const sign = polyArea(p) >= 0 ? 1 : -1;                    // outward normal of edge d is (dz, -dx) for counter-clockwise rings
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x0 = p[2 * i], z0 = p[2 * i + 1], x1 = p[2 * j], z1 = p[2 * j + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz);
      if (l < 0.05) continue;
      const nn = [dz / l * sign, 0, -dx / l * sign];
      const u0 = (hash(x0, z0) * 4 | 0) + 0, uAcross = (q) => [(Math.hypot(q[0] - x0, q[2] - z0) + u0 * 8) / 8, q[1] / 3.1];
      const A = [x0, 0, z0], B = [x1, 0, z1], C = [x1, h, z1], D = [x0, h, z0];
      W.tri(A, B, C, nn, uAcross); W.tri(A, C, D, nn, uAcross);
    }
    fillPoly(roofs, p, h, 8);
  }
  walls.forEach((b, i) => {
    if (b.empty) return;
    const fa = facade(palette[i], i % 3);
    const m = new THREE.MeshStandardMaterial({ map: fa.map, emissiveMap: fa.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 });
    glowMats.push(m);
    mesh(b, m, group, true);
  });
  mesh(roofs, material(tile(roofTex), {}), group);

  // ── trees in parks, bushes on park corners, street lights, parked cars ──
  const trees = [], bushes = [], lamps = [], cars = [];
  const inBuilding = (x, z) => { for (const p of kept) if (insideRing(p, x, z)) return true; return false; };
  const clearPlaza = (x, z) => Math.abs(x) < PLAZA_HALF + 2 && Math.abs(z) < PLAZA_HALF + 2;
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
        if (t < 0.55 && carN < 14 && r.w >= 7) {
          const cx = x + tx * 9 - nx * (r.w / 2 - 1.3) * side, cz = z + tz * 9 - nz * (r.w / 2 - 1.3) * side;
          if (bbIn(cx, cz, 8) && !clearPlaza(cx, cz) && !inBuilding(cx, cz)) { cars.push([cx, 0.04, cz, rot + (t < 0.27 ? 0 : Math.PI)]); carN++; }
        }
      }
      acc = ((acc - l) % gap + gap) % gap;
    }
  }
  // trees: same simple look as the procedural ones, three variants, instanced
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  for (let t = 0; t < 3; t++) {
    const list = trees.filter((q) => q[3] === t); if (!list.length) continue;
    const col = [0x3f8f3a, 0x4fa548, 0x2f7a3a][t];
    const parts = [[new THREE.CylinderGeometry(0.3, 0.3, 2, 6).translate(0, 1, 0), 0x7a5230], [new THREE.IcosahedronGeometry(1.7, 0).translate(0, 3.2, 0), col], [new THREE.IcosahedronGeometry(1.1, 0).translate(0.6, 4.3, 0.3), col]];
    const g = mergeParts(parts), im = new THREE.InstancedMesh(g, treeMat, list.length), o = new THREE.Object3D();
    list.forEach(([x, z, s], i) => { o.position.set(x, LAYER.park, z); o.scale.setScalar(s); o.rotation.y = x; o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = true; im.receiveShadow = true; group.add(im);
  }
  instanceKit(kit.bush, bushes.map(([x, z]) => [x, LAYER.park, z, hash(x, z) * 6]), 1.1, group, { shadow: false });
  instanceKit(kit.streetlight, lamps, 6, group);
  instanceKit(kit.car_sedan, cars.filter((_, i) => i % 2 === 0), 0, group, { lengthFit: 4.4 });
  instanceKit(kit.car_hatchback, cars.filter((_, i) => i % 2 === 1), 0, group, { lengthFit: 4.0 });
  return group;
}

function mergeParts(parts) {
  const pos = [], nor = [], col = [];
  for (const [g0, c] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0, color = new THREE.Color(c);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(color.r, color.g, color.b);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
