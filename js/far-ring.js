// Middle and far ring of a real-city level: Kosice-style buildings from ~330 m to ~1.5 km (merged per facade variant, no shadows),
// and a stylised horizon: ground texture with fields, woods and the city, rounded wooded hills, the Hornad river.
// Frame as in near-ring.js: 1 unit = 1 m, x east, z south, north = -z, origin = build site.
// Real directions from the site: the Slovak Ore Mountains (Cierna hora, Volovske vrchy) close the horizon in the north and north-west,
// the Hornad valley runs north-south about 1.8 km west of the centre, the Kosice basin opens to gentler hills east and a plain in the south.
import * as THREE from 'three';
import { canvas2d } from './textures.js';
import { Builder, hash, insideRing, material, mesh, calmMat, pitchedRoof, OLD_PALETTE, PLAIN_PALETTE, ROOF_COLORS } from './near-ring.js';
import { tileRoofTex, roofTex, STOREY_H, STOREY_W } from './textures.js';

const EXT = 4800;                      // terrain radius
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function vn(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f + i * 17.3, z * f - i * 9.1); a *= 0.5; f *= 2; } return s / (1 - 0.5 ** o); }
const bearing = (x, z) => { let b = Math.atan2(x, -z) * 180 / Math.PI; if (b < 0) b += 360; return b; };   // 0 north, 90 east
const gauss = (b, c, w) => { let d = Math.abs(b - c); if (d > 180) d = 360 - d; return Math.exp(-((d / w) ** 2)); };
const riverX = (z) => -1800 + 160 * Math.sin(z / 1100);

// ground height at (x, z): flat city basin, rounded wooded hills rising from ~1.5 km, tallest in the north and north-west
export function terrainY(x, z) {
  const d = Math.hypot(x, z); if (d < 700) return 0;
  const b = bearing(x, z);
  const amp = 70 + 560 * gauss(b, 335, 55) + 380 * gauss(b, 270, 42) + 200 * gauss(b, 95, 60) + 110 * gauss(b, 195, 50);
  const ridges = 0.3 + 0.7 * fbm(x * 0.00085 + 3, z * 0.00085 - 5, 4);
  let h = amp * sstep(1300, 4000, d) * ridges + 28 * sstep(800, 1700, d) * fbm(x * 0.004, z * 0.004, 3);
  const carve = sstep(60, 800, Math.abs(x - riverX(z)));                      // Hornad valley
  h *= 1 - (1 - carve) * (1 - sstep(2600, 5000, d));
  return h;
}
// city outline: the edge of the built-up area depends on direction (woods close in on the north-west)
const cityRadius = (x, z) => { const b = bearing(x, z); return 1500 - 380 * gauss(b, 345, 45) - 300 * gauss(b, 285, 40) + 260 * (fbm(x * 0.002, z * 0.002, 3) - 0.5); };

function groundTexture() {
  const N = 768, [c, g] = canvas2d(N, N), img = g.createImageData(N, N), px = img.data;
  const col = (hx) => [(hx >> 16) & 255, (hx >> 8) & 255, hx & 255];
  const fields = [0xb2bd66, 0xd2c474, 0x8db057, 0xbf9f5c, 0x9dbb66, 0xc8b86a].map(col);
  const wood = [0x3d6b3a, 0x2f5a35, 0x46733c].map(col), urban = col(0x7b776e), garden = col(0x93a171), riparian = col(0x7fa65c), meadow = col(0x86ad62);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -EXT + (i + 0.5) / N * 2 * EXT, z = -EXT + (j + 0.5) / N * 2 * EXT, d = Math.hypot(x, z), h = terrainY(x, z);
    const wx = x + (fbm(x * 0.0015, z * 0.0015, 2) - 0.5) * 500, wz = z + (fbm(x * 0.0015 + 9, z * 0.0015, 2) - 0.5) * 500;
    const cell = hash(Math.floor(wx / 210), Math.floor(wz / 150));
    let rgb = fields[Math.floor(cell * 97) % fields.length];
    const wd = fbm(x * 0.0018 + 4, z * 0.0018 + 2, 3);
    if (wd > 0.56 + 0.12 * sstep(1200, 2500, -d + 2600) || h > 55 || (h > 25 && wd > 0.46)) rgb = wood[Math.floor(hash(Math.floor(wx / 90), Math.floor(wz / 90)) * 3)];
    else if (h > 12 && cell > 0.5) rgb = meadow;
    const R = cityRadius(x, z);
    if (d < R) rgb = hash(Math.floor(x / 64), Math.floor(z / 64)) < 0.07 ? garden : urban;       // streets and yards under the buildings
    else if (d < R + 220) rgb = cell < 0.5 ? garden : rgb;
    if (Math.abs(x - riverX(z)) < 200) rgb = riparian;
    const n = 0.93 + 0.14 * vn(x * 0.05, z * 0.05), k = (j * N + i) * 4;
    px[k] = Math.min(255, rgb[0] * n); px[k + 1] = Math.min(255, rgb[1] * n); px[k + 2] = Math.min(255, rgb[2] * n); px[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// fog that never reaches 100 %: the hills stay a faint layered silhouette against the horizon instead of vanishing
function hazeFog(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        fogFactor = min(fogFactor, 0.38 + 0.37 * clamp((vFogDepth - 1500.0) / 3000.0, 0.0, 1.0));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
      #endif`);
  };
  return m;
}

function terrainMesh() {
  const K = 56, A = 192, pos = [], uv = [], idx = [];
  for (let k = 0; k <= K; k++) {
    const r = EXT * (k / K) ** 2.2;
    for (let a = 0; a < A; a++) {
      const th = a / A * Math.PI * 2, x = Math.sin(th) * r, z = -Math.cos(th) * r;
      pos.push(x, terrainY(x, z) - 0.1, z); uv.push((x + EXT) / (2 * EXT), 1 - (z + EXT) / (2 * EXT));
    }
  }
  for (let k = 0; k < K; k++) for (let a = 0; a < A; a++) {
    const a1 = (a + 1) % A, p0 = k * A + a, p1 = k * A + a1, p2 = (k + 1) * A + a, p3 = (k + 1) * A + a1;
    idx.push(p0, p1, p2, p1, p3, p2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, hazeFog(new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 })));
  m.frustumCulled = false; m.name = 'terrain'; return m;
}

function riverMesh() {
  const pos = [], idx = [], N = 110, z0 = -3400, z1 = 3400;
  for (let i = 0; i <= N; i++) {
    const z = z0 + (z1 - z0) * i / N, x = riverX(z), w = 34 + 14 * Math.sin(z / 300), y = terrainY(x, z) + 0.8;
    pos.push(x - w, y, z, x + w, y, z);
  }
  for (let i = 0; i < N; i++) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = hazeFog(new THREE.MeshStandardMaterial({ color: 0x5d8fb0, roughness: 0.2, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const r = new THREE.Mesh(geo, m); r.frustumCulled = false; r.name = 'hornad'; return r;
}

// ── buildings ──
const rectRing = (cx, cz, w, d, rot) => {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (const [u, v] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) out.push(cx + u * c - v * s, cz + u * s + v * c);
  return out;
};
function addWalls(W, p, y0, h) {
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, x0 = p[2 * i], z0 = p[2 * i + 1], x1 = p[2 * j], z1 = p[2 * j + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), reps = Math.max(1, Math.round(l / STOREY_W));
    const nn = [dz / l, 0, -dx / l], uf = (q) => [Math.hypot(q[0] - x0, q[2] - z0) / l * reps, (q[1] - y0) / STOREY_H];
    const A = [x0, y0, z0], B = [x1, y0, z1], C = [x1, y0 + h, z1], D = [x0, y0 + h, z0];
    W.tri(A, B, C, nn, uf); W.tri(A, C, D, nn, uf);
  }
}

export function buildMiddleFar() {
  const group = new THREE.Group(); group.name = 'middle-far-ring';
  group.add(terrainMesh(), riverMesh());

  const walls = new Map(), tiles = new Builder(), flats = new Builder();
  const wallB = (kind, hex, v) => { const k = `${kind}${hex}${v}`; if (!walls.has(k)) walls.set(k, { kind, hex, v, b: new Builder() }); return walls.get(k).b; };
  const ALPHA = 0.14, ca = Math.cos(ALPHA), sa = Math.sin(ALPHA), C = 60;                     // street lattice, turned a little off north
  // the default camera looks north-north-west past the tower: keep tall blocks out of that sector so the tower never melts into one
  const blocksView = (x, z, h) => h > 22 && (x * -9 + z * -22) / 23.8 > 0 && Math.abs(x * 22 - z * 9) / 23.8 < 60;
  const panelHex = [0xe7e3d9, 0xd9ddd8, 0xe8dcc6, 0xdfe4e6];
  let count = 0;
  const place = (kind, hex, v, cx, cz, w, d, rot, storeys, roof, rcol, ty) => {
    const h = storeys * STOREY_H;
    if (blocksView(cx, cz, h)) return;
    const p = rectRing(cx, cz, w, d, rot), y0 = ty - 3;
    addWalls(wallB(kind, hex, v), p, y0, h + 3);
    if (roof === 'hip') pitchedRoof(tiles, p, ty + h, rcol); else if (roof === 'low') pitchedRoof(tiles, p, ty + h, rcol, 1.3);
    else if (roof !== 'open') {
      const pts = []; for (let i = 0; i < p.length; i += 2) pts.push(new THREE.Vector2(p[i], p[i + 1]));
      const tris = THREE.ShapeUtils.triangulateShape(pts, []);
      for (const [i, j, k] of tris) flats.tri([pts[i].x, ty + h, pts[i].y], [pts[j].x, ty + h, pts[j].y], [pts[k].x, ty + h, pts[k].y], [0, 1, 0], (q) => [q[0] / 8, q[2] / 8]);
    }
    count++;
  };
  const pick = (a, r) => a[Math.floor(r * a.length * 0.999)];
  for (let iu = -30; iu <= 30; iu++) for (let iv = -30; iv <= 30; iv++) {
    const u = iu * C, v = iv * C, x = u * ca - v * sa, z = u * sa + v * ca;
    if (Math.max(Math.abs(x), Math.abs(z)) < 340) continue;
    const d = Math.hypot(x, z), R = cityRadius(x, z);
    if (d > R || Math.abs(x - riverX(z)) < 300) continue;
    const b = bearing(x, z), cell = hash(iu * 3.1, iv * 1.7), ty = terrainY(x, z);
    // zone by distance, nudged by direction and noise: old town and pre-war blocks, 1950s blocks, then prefab panel estates
    const dz = d + (fbm(x * 0.0025, z * 0.0025, 3) - 0.5) * 380 - 260 * gauss(b, 190, 45) - 200 * gauss(b, 235, 35) - 150 * gauss(b, 45, 30);
    if (cell < 0.06) continue;                                                       // a park or empty yard
    if (dz < 780) {
      for (let a = 0; a < 2; a++) for (let c2 = 0; c2 < 2; c2++) {
        const r1 = hash(iu * 7.3 + a, iv * 5.9 + c2);
        if (r1 < 0.08) continue;
        const w = 19 + hash(r1 * 91, a) * 9, dd = 17 + hash(r1 * 57, c2) * 9, st = 3 + Math.floor(hash(r1 * 13, iu) * 4);
        const vi = Math.floor(hash(r1 * 71, iv) * OLD_PALETTE.length);
        place('old', OLD_PALETTE[vi], vi, x + (a - 0.5) * 30 * ca - (c2 - 0.5) * 30 * sa + (r1 - 0.5) * 3, z + (a - 0.5) * 30 * sa + (c2 - 0.5) * 30 * ca + (r1 - 0.5) * 3, w, dd, ALPHA, st, 'hip', pick(ROOF_COLORS, hash(r1 * 33, 5)), ty);
      }
    } else if (dz < 1150) {
      for (let s = -1; s <= 1; s += 2) {
        const r1 = hash(iu * 2.9 + s, iv * 4.1);
        if (r1 < 0.1) continue;
        const w = 40 + hash(r1 * 19, 3) * 14, st = 4 + Math.floor(hash(r1 * 29, 4) * 3), vi = Math.floor(hash(r1 * 41, 6) * PLAIN_PALETTE.length);
        place('plain', PLAIN_PALETTE[vi], vi, x - sa * 15 * s, z + ca * 15 * s, w, 13, ALPHA, st, r1 > 0.55 ? 'low' : 'flat', pick(ROOF_COLORS, r1), ty);
      }
    } else if (dz > 1350 && cell > 0.55) {                                            // family houses on the edge
      for (let a = -1; a <= 1; a++) for (let c2 = -1; c2 <= 1; c2++) {
        const r1 = hash(iu * 6.1 + a, iv * 3.7 + c2);
        if (r1 < 0.2) continue;
        const vi = Math.floor(r1 * 977) % OLD_PALETTE.length;
        place('old', OLD_PALETTE[vi], vi, x + a * 19 * ca - c2 * 19 * sa, z + a * 19 * sa + c2 * 19 * ca, 10 + r1 * 3, 9 + r1 * 2, ALPHA, 2, 'hip', pick(ROOF_COLORS, hash(r1 * 5.7, 1)), ty);
      }
    } else {                                                                          // panelaky: parallel slabs and the odd point block
      const reg = hash(Math.floor(x / 420), Math.floor(z / 420)), turn = reg > 0.5 ? Math.PI / 2 : 0, pv = Math.floor(reg * 977) % 4;
      const r1 = hash(iu * 1.3, iv * 8.9), st = 8 + Math.floor(hash(reg * 31, 2) * 5);
      if (r1 < 0.3) place('panel', panelHex[pv], pv, x, z, 20, 20, ALPHA, 10 + Math.floor(r1 * 12), 'flat', null, ty);
      else place('panel', panelHex[pv], pv, x, z, 52 + r1 * 10, 12, ALPHA + turn, st, 'flat', null, ty);
    }
  }
  // church towers, here and there in the old town
  for (let i = 0; i < 9; i++) {
    const a = hash(i, 3.3) * Math.PI * 2, r = 380 + hash(i, 8.1) * 520, x = Math.sin(a) * r, z = -Math.cos(a) * r, ty = terrainY(x, z);
    if (Math.max(Math.abs(x), Math.abs(z)) < 340 || Math.abs(x - riverX(z)) < 300) continue;
    place('old', 0xdad3c3, 99, x, z, 9, 9, ALPHA, 8, 'open', null, ty);
    const rr = rectRing(x, z, 9, 9, ALPHA); pitchedRoof(tiles, rr, ty + 8 * STOREY_H, new THREE.Color(i % 2 ? 0x5e8f7c : 0xa84c36), 13);
    place('old', 0xdad3c3, 99, x + 13 * Math.cos(ALPHA), z + 13 * Math.sin(ALPHA), 12, 26, ALPHA, 4, 'hip', pick(ROOF_COLORS, i / 9), ty);
  }
  group.userData.count = count;
  for (const { kind, hex, v, b } of walls.values()) if (!b.empty) mesh(b, calmMat(hex, kind, v), group, false).frustumCulled = false;
  const tm = mesh(tiles, material(tileRoofTex, { vertexColors: true }), group); if (tm) tm.frustumCulled = false;
  const fm = mesh(flats, material(roofTex, { color: 0xa8a8a8 }), group); if (fm) fm.frustumCulled = false;
  return group;
}
