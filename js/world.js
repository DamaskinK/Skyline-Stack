// The city around the tower: renderer, sky, ground, roads, traffic, props, background and moving sky life.
import * as THREE from 'three';
import { CFG, PHASES } from './config.js';
import { settings } from './settings.js';
import { facade, roofTex, shopTex, billboardTex, pavingTex, grassTex, sidewalkTex, puffTex, storeyUV, canvas2d, toTex } from './textures.js';

// deterministic pseudo-random for scenery, so the city looks the same on every visit
let seed = 7;
export function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PHASES[0].bot, 110, 320);
export const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1200);   // near 0.5: 5x the depth precision of 0.1

export const hemi = new THREE.HemisphereLight(0xdfeeff, 0x4a5a3a, 1.0); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff3dc, 1.7);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 150 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

export function applyQuality() {
  const q = settings.quality;
  renderer.setPixelRatio(Math.min(q === 'low' ? 1 : q === 'medium' ? 1.5 : 2, window.devicePixelRatio || 1));
  sun.castShadow = q !== 'low';
  const size = q === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  if (traffic) traffic.setCount(q === 'low' ? 14 : 34);
}
export function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
}

// ── sky dome: gradient, sun glow and drifting procedural clouds ──
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    top: { value: new THREE.Color(PHASES[0].top) }, bot: { value: new THREE.Color(PHASES[0].bot) },
    cloudCol: { value: new THREE.Color(0xffffff) }, sunCol: { value: new THREE.Color(0xfff3dc) },
    sunDir: { value: new THREE.Vector3(...PHASES[0].sunDir).normalize() },
    time: { value: 0 }, cover: { value: 0.35 }, wind: { value: new THREE.Vector2() }, night: { value: 0 },
  },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform vec3 top; uniform vec3 bot; uniform vec3 cloudCol; uniform vec3 sunCol; uniform vec3 sunDir;
    uniform float time; uniform float cover; uniform vec2 wind; uniform float night;
    varying vec3 vP;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    void main(){
      vec3 d = normalize(vP);
      float h = clamp(d.y * 1.6 + 0.08, 0.0, 1.0);
      vec3 col = mix(bot, top, pow(h, 0.7));
      float sd = max(dot(d, normalize(sunDir)), 0.0);
      col += sunCol * (pow(sd, 600.0) * 4.0 + pow(sd, 14.0) * 0.3) * (1.0 - night * 0.8);
      if (night > 0.5) { float st = step(0.997, hash(floor(d.xz / (d.y + 0.2) * 300.0))); col += vec3(st) * (night - 0.5) * 1.6 * step(0.1, d.y); }
      if (d.y > 0.0) {
        vec2 uv = d.xz / (d.y + 0.12) * 0.9 + wind * time * 0.004 + vec2(time * 0.012, time * 0.004);
        float n = fbm(uv * 1.6);
        float c = smoothstep(1.0 - cover, 1.0 - cover + 0.3, n) * smoothstep(0.0, 0.2, d.y);
        vec3 cc = mix(cloudCol, cloudCol * 0.7, smoothstep(0.55, 1.0, n)) + sunCol * pow(sd, 8.0) * 0.35;
        col = mix(col, cc, c * 0.9);
      }
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat); sky.renderOrder = -1; scene.add(sky);

// ── ground, plaza, roads, sidewalks ──
// No two ground surfaces share a plane: every layer has a real height step and strips are cut where they would cross.
// Grass at 0, roads 2 cm up, markings 3.5 cm, plaza and sidewalks are 6 cm slabs with a curb. Shared geometry, so the
// whole ground is a handful of draw calls.
const ROAD = 44, ROAD_W = 9, LEN = 640, SW = 3;
export const GROUND_Y = { road: 0.02, mark: 0.035, walk: 0.06 };
const ground = (mat, parts) => {
  // parts: [x0, x1, z0, z1, top, uScale, vScale, swapUV] -> one merged mesh with world-space UVs
  const geos = parts.map(([x0, x1, z0, z1, top, us, vs, swap]) => {
    const g = top > 0.03 ? new THREE.BoxGeometry(x1 - x0, top, z1 - z0).translate((x0 + x1) / 2, top / 2, (z0 + z1) / 2)
      : new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, top, (z0 + z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / us, v = p.getZ(i) / vs; uv.setXY(i, swap ? v : u, swap ? u : v); }
    return g.index ? g.toNonIndexed() : g;
  });
  const m = new THREE.Mesh(mergeGeos(geos), mat); m.receiveShadow = true; scene.add(m); return m;
};
function mergeGeos(geos) {
  const n = geos.reduce((s, g) => s + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    const arr = new Float32Array(n * size); let off = 0;
    for (const g of geos) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
const flat = (w, d, mat, x, z, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };
flat(2400, 2400, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }), 0, 0, 0);
const roadMat = new THREE.MeshStandardMaterial({ color: 0x3b3e46, roughness: 1 });
const tile = (t) => { const c = t.clone(); c.repeat.set(1, 1); c.needsUpdate = true; return c; };
const swMat = new THREE.MeshStandardMaterial({ map: tile(sidewalkTex), roughness: 1 });
const pavingMat = new THREE.MeshStandardMaterial({ map: tile(pavingTex), roughness: 0.95 });
// pieces of a line along one axis, cut out where the crossing roads are
const cuts = (pad) => [[-LEN / 2, -ROAD - pad], [-ROAD + pad, ROAD - pad], [ROAD + pad, LEN / 2]];
const IN = ROAD - ROAD_W / 2 - SW;   // inner edge of the inner sidewalks = edge of the plaza
const { road: yR, walk: yW } = GROUND_Y;
const roadParts = [], walkParts = [];
for (const s of [-1, 1]) {
  roadParts.push([-LEN / 2, LEN / 2, s * ROAD - ROAD_W / 2, s * ROAD + ROAD_W / 2, yR, 9, 9]);                  // along x, full
  for (const [a, b] of cuts(ROAD_W / 2)) roadParts.push([s * ROAD - ROAD_W / 2, s * ROAD + ROAD_W / 2, a, b, yR, 9, 9]);   // along z, cut
  for (const o of [-1, 1]) {
    const c = s * ROAD + o * (ROAD_W / 2 + SW / 2);
    for (const [a, b] of cuts(ROAD_W / 2)) walkParts.push([a, b, c - SW / 2, c + SW / 2, yW, SW, SW]);                       // along x, cut at roads
    for (const [a, b] of cuts(ROAD_W / 2 + SW)) walkParts.push([c - SW / 2, c + SW / 2, a, b, yW, SW, SW, true]);            // along z, cut at roads and walks
  }
}
ground(roadMat, roadParts);
ground(swMat, walkParts);
ground(pavingMat, [[-IN, IN, -IN, IN, yW, 7.6, 7.6]]);
const dashes = [];
for (const s of [-1, 1]) for (let k = -LEN / 2; k < LEN / 2; k += 6) { dashes.push([k, s * ROAD, 0]); dashes.push([s * ROAD, k, Math.PI / 2]); }
// markings sit a real 1.5 cm above the road; the small depth bias only keeps distant ones crisp
function groundLayer(mat, layer) { const m = mat.clone(); m.polygonOffset = true; m.polygonOffsetFactor = -layer; m.polygonOffsetUnits = -layer; return m; }
const o3 = new THREE.Object3D();
function instanced(geo, mat, list, place, shadow = false) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((it, i) => { o3.position.set(0, 0, 0); o3.rotation.set(0, 0, 0); o3.scale.set(1, 1, 1); place(it, o3, i); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); });
  im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im;
}
instanced(new THREE.PlaneGeometry(2.5, 0.3).rotateX(-Math.PI / 2), groundLayer(new THREE.MeshBasicMaterial({ color: 0xf4f0e0 }), 1), dashes, ([x, z, r], o) => { o.position.set(x, GROUND_Y.mark, z); o.rotation.y = r; });
// zebra crossings at the four corners of the plaza
const zebra = [];
for (const s of [-1, 1]) for (const t of [-1, 1]) for (let k = -3; k <= 3; k++) { zebra.push([t * 20 + k * 1.2, s * ROAD, 0]); zebra.push([s * ROAD, t * 20 + k * 1.2, Math.PI / 2]); }
instanced(new THREE.PlaneGeometry(0.7, ROAD_W - 1).rotateX(-Math.PI / 2), groundLayer(new THREE.MeshBasicMaterial({ color: 0xf4f0e0 }), 2), zebra, ([x, z, r], o) => { o.position.set(x, GROUND_Y.mark + 0.004, z); o.rotation.y = r; });

// ── geometry helper: merge simple parts into one vertex-coloured mesh ──
export function mergeColored(parts) {
  let count = 0; const geos = parts.map(([g, c]) => { const n = g.index ? g.toNonIndexed() : g; count += n.attributes.position.count; return [n, new THREE.Color(c)]; });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let off = 0;
  for (const [g, c] of geos) {
    pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3);
    for (let i = 0; i < g.attributes.position.count; i++) { col[(off + i) * 3] = c.r; col[(off + i) * 3 + 1] = c.g; col[(off + i) * 3 + 2] = c.b; }
    off += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r, h, x, y, z, s = 8) => new THREE.CylinderGeometry(r, r, h, s).translate(x, y, z);

// ── background buildings with shops, rooftop details and billboards ──
const sceneryMats = [];
const palette = [0xc7b39b, 0x8fa3b8, 0xd88c6a, 0xa7b08b, 0xe2d6bf, 0x7d8aa6, 0xb87d7d, 0xd2c27a, 0x9bb7a5];
const topMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1 });
const shopMats = Array.from({ length: 8 }, (_, i) => { const t = shopTex(i); const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 }); sceneryMats.push(m); return m; });
const roofProps = mergeColored([[box(1.6, 1, 1.2, 0, 0.5, 0), 0x9aa0a8], [cyl(0.7, 1.6, 2.2, 1.2, 1.4), 0x8a5a3a], [cyl(0.05, 3.5, -1.6, 1.75, -1), 0xcccccc]]);
const roofPropMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const roofPropList = [], billboards = [];
function cityBlock(x, z, w, d, h, hex, variant, idx) {
  const fa = facade(hex, variant);
  const side = new THREE.MeshStandardMaterial({ map: fa.map, emissiveMap: fa.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 });
  sceneryMats.push(side);
  const m = new THREE.Mesh(storeyUV(new THREE.BoxGeometry(w, h, d), w, h, d), [side, side, topMat, topMat, side, side]);
  m.position.set(x, CFG.H * 1.6 + h / 2, z); m.receiveShadow = true; scene.add(m);
  const sm = shopMats[idx % shopMats.length];
  const shop = new THREE.Mesh(storeyUV(new THREE.BoxGeometry(w + 0.4, CFG.H * 1.6, d + 0.4), (w + 0.4) * 0.62, CFG.H, (d + 0.4) * 0.62), [sm, sm, topMat, topMat, sm, sm]);
  shop.position.set(x, CFG.H * 0.8, z); shop.receiveShadow = true; scene.add(shop);
  const roofY = CFG.H * 1.6 + h;
  roofPropList.push([x, roofY, z, rnd() * 6]);
  if (idx % 5 === 0) billboards.push([x, roofY, z, w, idx]);
}
const isRoad = (x, z, pad) => Math.abs(Math.abs(x) - ROAD) < pad || Math.abs(Math.abs(z) - ROAD) < pad;
for (let i = 0, made = 0; i < 160 && made < 84; i++) {
  const a = rnd() * Math.PI * 2, r = 64 + rnd() * 190;
  const x = Math.cos(a) * r, z = Math.sin(a) * r, w = 7 + rnd() * 9, d = 7 + rnd() * 9;
  if (isRoad(x, z, ROAD_W / 2 + 4 + Math.max(w, d) / 2)) continue;
  // keep a clear sky behind the tower as seen from the default camera, so the tower never blends into a skyscraper
  const along = (x * -9 + z * -22) / 23.8, across = Math.abs(x * 22 - z * 9) / 23.8;
  if (along > 0 && across < 12 + Math.max(w, d) / 2) continue;
  const tall = r > 120 ? 20 + rnd() * 90 : 6 + rnd() * rnd() * 50;
  cityBlock(x, z, w, d, tall, palette[made % palette.length], made % 3, made); made++;
}
instanced(roofProps, roofPropMat, roofPropList, ([x, y, z, r], o) => { o.position.set(x, y, z); o.rotation.y = r; });
for (const [x, y, z, w, i] of billboards) {
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, w * 0.3), new THREE.MeshStandardMaterial({ map: billboardTex(i), emissive: 0xffffff, emissiveMap: billboardTex(i), emissiveIntensity: 0.1, side: THREE.DoubleSide }));
  sceneryMats.push(bb.material);
  bb.position.set(x, y + w * 0.3, z); bb.lookAt(0, y + w * 0.3, 0); scene.add(bb);
}

// ── street furniture ──
const trees = [], bushes = [], lamps = [], benches = [], flowers = [];
for (let i = 0; i < 120; i++) {
  const a = rnd() * Math.PI * 2, r = 30 + rnd() * 34;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (isRoad(x, z, ROAD_W / 2 + 4) || (Math.abs(x) < 39 && Math.abs(z) < 39)) continue;
  trees.push([x, z, 0.8 + rnd() * 0.6, Math.floor(rnd() * 3)]);
}
for (let k = -33; k <= 33; k += 3) for (const s of [-1, 1]) { if (Math.abs(k) > 6) { bushes.push([k, s * 36.5]); bushes.push([s * 36.5, k]); } }
for (let k = -30; k <= 30; k += 12) for (const s of [-1, 1]) { lamps.push([k, s * 34, s > 0 ? Math.PI : 0]); lamps.push([s * 34, k, s > 0 ? -Math.PI / 2 : Math.PI / 2]); }
for (let k = -150; k <= 150; k += 22) for (const s of [-1, 1]) for (const o of [-1, 1]) {
  if (Math.abs(k) < 40) continue;
  lamps.push([k, s * ROAD + o * (ROAD_W / 2 + 0.6), o > 0 ? Math.PI : 0]); lamps.push([s * ROAD + o * (ROAD_W / 2 + 0.6), k, o > 0 ? -Math.PI / 2 : Math.PI / 2]);
}
for (let k = -24; k <= 24; k += 16) for (const s of [-1, 1]) { benches.push([k + 4, s * 32, s > 0 ? Math.PI : 0]); benches.push([s * 32, k + 4, s > 0 ? -Math.PI / 2 : Math.PI / 2]); }
for (const [x, z] of [[-26, -26], [26, -26], [-26, 26], [26, 26]]) for (let i = 0; i < 24; i++) flowers.push([x + (rnd() - 0.5) * 5, z + (rnd() - 0.5) * 5, Math.floor(rnd() * 4)]);

const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
const treeGeos = [0x3f8f3a, 0x4fa548, 0x2f7a3a].map((c) => mergeColored([[cyl(0.3, 2, 0, 1, 0, 6), 0x7a5230], [new THREE.IcosahedronGeometry(1.7, 0).translate(0, 3.2, 0), c], [new THREE.IcosahedronGeometry(1.1, 0).translate(0.6, 4.3, 0.3), c]]));
for (let t = 0; t < 3; t++) instanced(treeGeos[t], treeMat, trees.filter((q) => q[3] === t), ([x, z, s], o) => { o.position.set(x, 0, z); o.scale.setScalar(s); o.rotation.y = x; }, true);
instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x3d8a3a, flatShading: true, roughness: 1 }), bushes, ([x, z], o) => { o.position.set(x, 0.6, z); o.scale.set(1.4, 0.8, 1.4); }, true);
const flowerCols = [0xff5a6e, 0xffd34d, 0xff9be0, 0xffffff];
for (let c = 0; c < 4; c++) instanced(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: flowerCols[c], roughness: 0.8 }), flowers.filter((f) => f[2] === c), ([x, z], o) => { o.position.set(x, 0.35, z); });
for (const [x, z] of [[-26, -26], [26, -26], [-26, 26], [26, 26]]) { const bed = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x6b4a2e })); bed.position.set(x, 0.2, z); bed.receiveShadow = true; scene.add(bed); }
const benchGeo = mergeColored([[box(2.2, 0.15, 0.7, 0, 0.55, 0), 0x9c6b3e], [box(2.2, 0.6, 0.12, 0, 0.9, -0.3), 0x9c6b3e], [box(0.12, 0.55, 0.6, -0.95, 0.27, 0), 0x333333], [box(0.12, 0.55, 0.6, 0.95, 0.27, 0), 0x333333]]);
instanced(benchGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), benches, ([x, z, r], o) => { o.position.set(x, GROUND_Y.walk, z); o.rotation.y = r; }, true);
const poleGeo = mergeColored([[cyl(0.1, 5.2, 0, 2.6, 0, 6), 0x2f3540], [box(0.12, 0.12, 1.4, 0, 5.1, 0.6), 0x2f3540]]);
instanced(poleGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), lamps, ([x, z, r], o) => { o.position.set(x, GROUND_Y.walk, z); o.rotation.y = r; }, true);
const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffd27a, emissiveIntensity: 0 });
instanced(box(0.5, 0.25, 0.7, 0, 4.95, 1.25), lampHeadMat, lamps, ([x, z, r], o) => { o.position.set(x, GROUND_Y.walk, z); o.rotation.y = r; });
const poolMat = new THREE.MeshBasicMaterial({ map: puffTex, color: 0xffc66a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
instanced(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), poolMat, lamps, ([x, z, r], o) => { o.position.set(x + Math.sin(r) * 1.25, GROUND_Y.walk + 0.05, z + Math.cos(r) * 1.25); });
// traffic lights at the corners, cycling for show
const tlights = [];
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  const g = new THREE.Group(); g.position.set(sx * (ROAD + ROAD_W / 2 + 0.8), 0, sz * (ROAD + ROAD_W / 2 + 0.8));
  const pole = new THREE.Mesh(cyl(0.1, 4, 0, 2, 0, 6), new THREE.MeshStandardMaterial({ color: 0x2f3540 }));
  const head = new THREE.Mesh(box(0.5, 1.4, 0.4, 0, 4.4, 0), new THREE.MeshStandardMaterial({ color: 0x1d1f24 }));
  const bulbs = [0xff3030, 0xffc020, 0x30ff60].map((c, i) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: c })); b.position.set(0, 4.85 - i * 0.45, 0.22); g.add(b); return b; });
  g.add(pole, head); g.lookAt(0, 0, 0); scene.add(g); tlights.push({ bulbs, phase: (sx + sz + 2) % 4 });
}

// ── hills on the horizon (no fog; tinted toward the sky colour so they read as distance) ──
const hillMat = new THREE.MeshLambertMaterial({ color: 0x6f9a7a, flatShading: true, fog: false, transparent: true });
const hills = [];
for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + rnd() * 0.2; hills.push([Math.cos(a) * (520 + rnd() * 80), Math.sin(a) * (520 + rnd() * 80), 60 + rnd() * 90, 50 + rnd() * 80]); }
instanced(new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0), hillMat, hills, ([x, z, w, h], o) => { o.position.set(x, -2, z); o.scale.set(w, h, w * 0.8); o.rotation.y = x; });

// ── 3D clouds at every height, so a tall tower climbs through them ──
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 });
const clouds = [], PUFFS = 6;
for (let i = 0; i < 40; i++) {
  const a = rnd() * Math.PI * 2, r = 40 + rnd() * 170, sc = 1 + rnd() * 1.5;
  const puffs = Array.from({ length: PUFFS }, (_, k) => ({ x: (k - 2.5) * 2.2 * sc, y: rnd() * 1.4 * sc, z: rnd() * 2 * sc, s: (1.6 + rnd() * 1.8) * sc }));
  clouds.push({ p: new THREE.Vector3(Math.cos(a) * r, 30 + rnd() * 260, Math.sin(a) * r), puffs, sp: 0.6 + rnd() * 0.8 });
}
const cloudMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), cloudMat, clouds.length * PUFFS); cloudMesh.frustumCulled = false; scene.add(cloudMesh);

// ── traffic ──
const carGeo = mergeColored([
  [box(2, 0.7, 4.2, 0, 0.65, 0), 0xffffff], [box(1.75, 0.65, 2.1, 0, 1.3, -0.2), 0x9aa3b5],
  [box(1.8, 0.08, 2.0, 0, 1.66, -0.2), 0xffffff],
  ...[[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]].map(([x, z]) => [new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10).rotateZ(Math.PI / 2).translate(x * 0.95, 0.38, z), 0x1a1a1a]),
]);
const carLightGeo = mergeColored([[box(0.4, 0.2, 0.08, -0.6, 0.75, 2.12), 0xfff6d0], [box(0.4, 0.2, 0.08, 0.6, 0.75, 2.12), 0xfff6d0], [box(0.4, 0.18, 0.08, -0.6, 0.8, -2.12), 0xff2a2a], [box(0.4, 0.18, 0.08, 0.6, 0.8, -2.12), 0xff2a2a]]);
const carCols = [0xe74c3c, 0x3498db, 0xf1c40f, 0xecf0f1, 0x2ecc71, 0x34495e, 0xe67e22, 0x9b59b6];
const MAX_CARS = 40;
const carMesh = new THREE.InstancedMesh(carGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2 }), MAX_CARS);
const carLights = new THREE.InstancedMesh(carLightGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), MAX_CARS);
carMesh.castShadow = true; carMesh.frustumCulled = carLights.frustumCulled = false; scene.add(carMesh, carLights);
const cars = [];
for (let i = 0; i < MAX_CARS; i++) {
  const road = i % 4, lane = i % 8 < 4 ? 1 : -1, bus = i % 9 === 0, parked = i % 11 === 5;
  cars.push({ road, lane, pos: -LEN / 2 + rnd() * LEN, sp: parked ? 0 : (9 + rnd() * 7) * (bus ? 0.7 : 1), bus, parked });
  carMesh.setColorAt(i, new THREE.Color(bus ? 0xf5b400 : carCols[i % carCols.length]));
}
export const traffic = {
  count: 34,
  setCount(n) { this.count = Math.min(MAX_CARS, n); carMesh.count = carLights.count = this.count; },
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      const c = cars[i];
      c.pos += c.sp * dt * c.lane; if (c.pos > LEN / 2) c.pos -= LEN; if (c.pos < -LEN / 2) c.pos += LEN;
      const side = c.road < 2 ? (c.road === 0 ? 1 : -1) : (c.road === 2 ? 1 : -1);
      const off = c.parked ? c.lane * 3.4 : c.lane * 2;
      if (c.road < 2) { o3.position.set(c.pos, 0, side * ROAD + off); o3.rotation.set(0, c.lane > 0 ? Math.PI / 2 : -Math.PI / 2, 0); }
      else { o3.position.set(side * ROAD - off, 0, c.pos); o3.rotation.set(0, c.lane > 0 ? 0 : Math.PI, 0); }
      o3.scale.set(1, c.bus ? 1.5 : 1, c.bus ? 2.3 : 1); o3.updateMatrix();
      carMesh.setMatrixAt(i, o3.matrix); carLights.setMatrixAt(i, o3.matrix);
    }
    carMesh.instanceMatrix.needsUpdate = true; carLights.instanceMatrix.needsUpdate = true;
  },
};
traffic.setCount(34);

// ── sky life: birds, a plane with a contrail, a hot-air balloon ──
const birdMat = new THREE.MeshBasicMaterial({ color: 0x2a2a35, side: THREE.DoubleSide });
const wingGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.25, 0, 0, 0.25, 1.1, 0, 0], 3));
const flocks = [];
for (let f = 0; f < 3; f++) {
  const g = new THREE.Group(); const birds = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group(); const l = new THREE.Mesh(wingGeo, birdMat), r = new THREE.Mesh(wingGeo, birdMat); r.scale.x = -1;
    b.add(l, r); b.position.set(-Math.abs(i - 3) * 1.6, rnd() * 0.6, (i - 3) * 1.4); g.add(b); birds.push({ l, r, ph: rnd() * 6 });
  }
  scene.add(g); flocks.push({ g, birds, r: 50 + f * 35, y: 26 + f * 30, a: f * 2, sp: 0.06 + f * 0.02 });
}
const plane = new THREE.Mesh(mergeColored([[box(1.6, 1.6, 12, 0, 0, 0), 0xf2f2f2], [box(14, 0.25, 2.6, 0, 0, 0.5), 0xe0e0e0], [box(4.5, 0.2, 1.4, 0, 0.3, -5), 0xe0e0e0], [box(0.25, 2.4, 1.6, 0, 1.4, -5.2), 0xd63a3a]]), new THREE.MeshLambertMaterial({ vertexColors: true }));
const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
scene.add(plane, trail);
const flight = { t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), dur: 40 };
function newFlight() {
  const a = rnd() * Math.PI * 2, y = 200 + rnd() * 80;
  flight.from.set(Math.cos(a) * 500, y, Math.sin(a) * 500); flight.to.set(-Math.cos(a + 0.4) * 500, y, -Math.sin(a + 0.4) * 500); flight.t = 0;
}
newFlight(); flight.t = 12;
const balloon = new THREE.Group();
{
  const [c, x] = canvas2d(256, 64); ['#e74c3c', '#f1c40f', '#3498db', '#ffffff'].forEach((col, i) => { for (let k = i; k < 16; k += 4) { x.fillStyle = col; x.fillRect(k * 16, 0, 16, 64); } });
  const env = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.7 })); env.scale.y = 1.2; env.position.y = 7;
  const basket = new THREE.Mesh(box(1.6, 1.2, 1.6, 0, 0.6, 0), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
  const ropes = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.8, 1.2, -0.8, -2, 3.6, -2, 0.8, 1.2, -0.8, 2, 3.6, -2, -0.8, 1.2, 0.8, -2, 3.6, 2, 0.8, 1.2, 0.8, 2, 3.6, 2], 3)), new THREE.LineBasicMaterial({ color: 0x333333 }));
  balloon.add(env, basket, ropes); scene.add(balloon);
}

// ── atmosphere state, blended toward the current weather every frame ──
export const atm = {
  top: new THREE.Color(PHASES[0].top), bot: new THREE.Color(PHASES[0].bot), sunCol: new THREE.Color(PHASES[0].sunCol), cloud: new THREE.Color(0xffffff),
  sunDir: new THREE.Vector3(...PHASES[0].sunDir).normalize(), night: 0, sunI: 1.7, hemiI: 1, cover: 0.35, fogNear: 110, fogFar: 320,
};
const tc = new THREE.Color(), tv = new THREE.Vector3();
let clock = 0;
export const blockMats = new Map();
export const glowMats = sceneryMats;

// Image-based light from the level's sky HDRI (set by level-scene.js). Three r160 has no scene-wide env intensity,
// so the standard materials are collected now and then and dimmed together as night falls.
const envMats = new Set(); let envScan = 0;
export function setEnvironment(tex) { scene.environment = tex; envScan = 0; }
function updateEnvIntensity(v) {
  if (!scene.environment) return;
  if (--envScan <= 0) {
    envScan = 60; envMats.clear();
    scene.traverse((o) => { const m = o.material; if (m) for (const x of Array.isArray(m) ? m : [m]) if (x.isMeshStandardMaterial) envMats.add(x); });
  }
  for (const m of envMats) m.envMapIntensity = v;
}

// Point the sun (and its shadow frustum) at the area around `focus`.
export function aimSun(focus) {
  sun.position.copy(focus).addScaledVector(atm.sunDir, 60); sun.target.position.copy(focus);
  sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
}

export function updateWorld(dt, ph, wind, focus, flash) {
  clock += dt;
  const k = Math.min(1, dt * 1.2);
  atm.top.lerp(tc.setHex(ph.top), k); atm.bot.lerp(tc.setHex(ph.bot), k); atm.sunCol.lerp(tc.setHex(ph.sunCol), k); atm.cloud.lerp(tc.setHex(ph.cloud), k);
  atm.sunDir.lerp(tv.set(...ph.sunDir).normalize(), k * 0.5).normalize();
  atm.night += (ph.night - atm.night) * k; atm.sunI += (ph.sun - atm.sunI) * k; atm.hemiI += (ph.hemi - atm.hemiI) * k; atm.cover += (ph.cover - atm.cover) * k;
  atm.fogNear += (ph.fog[0] - atm.fogNear) * k; atm.fogFar += (ph.fog[1] - atm.fogFar) * k;
  const u = skyMat.uniforms;
  u.top.value.copy(atm.top); u.bot.value.copy(atm.bot); u.cloudCol.value.copy(atm.cloud); u.sunCol.value.copy(atm.sunCol); u.sunDir.value.copy(atm.sunDir);
  u.time.value = clock; u.cover.value = atm.cover; u.wind.value.set(wind.x, wind.z); u.night.value = atm.night;
  sky.position.copy(camera.position);
  scene.fog.color.copy(atm.bot); scene.fog.near = atm.fogNear; scene.fog.far = atm.fogFar;
  sun.color.copy(atm.sunCol); sun.intensity = atm.sunI; hemi.intensity = (atm.hemiI + flash * 2.5) * (scene.environment ? 0.55 : 1);
  updateEnvIntensity((1 - 0.85 * atm.night) * 0.35);
  aimSun(focus);
  cloudMat.color.copy(atm.cloud);
  // hills ignore fog, so fade them into the horizon colour at night and in fog instead of letting them turn into black cut-outs
  hillMat.color.setHex(0x5f8f6e).lerp(atm.bot, Math.min(0.94, 0.5 + 0.42 * atm.night + 0.45 * Math.max(0, 1 - atm.fogFar / 220)));
  hillMat.opacity = Math.min(1, Math.max(0, (atm.fogFar - 60) / 90)); hillMat.visible = hillMat.opacity > 0.02;   // thick fog swallows the horizon
  hillMat.emissive.copy(atm.bot).multiplyScalar(0.3 + 0.65 * atm.night);   // self-lit toward the fog colour so they stay visible but soft in the dark
  const glow = Math.min(1.4, atm.night * 1.4);
  for (const arr of blockMats.values()) arr[0].emissiveIntensity = arr[0].userData.gold ? 0.25 + glow : glow;
  for (const m of sceneryMats) m.emissiveIntensity = glow;
  lampHeadMat.emissiveIntensity = atm.night * 2.5; poolMat.opacity = atm.night * 0.55;

  for (const c of clouds) {
    c.p.x += (c.sp + wind.x * 0.25) * dt; c.p.z += wind.z * 0.25 * dt;
    if (c.p.x > 230) c.p.x -= 460; if (c.p.x < -230) c.p.x += 460;
    if (c.p.z > 230) c.p.z -= 460; if (c.p.z < -230) c.p.z += 460;
  }
  clouds.forEach((c, i) => c.puffs.forEach((p, j) => {
    o3.position.set(c.p.x + p.x, c.p.y + p.y, c.p.z + p.z); o3.rotation.set(0, 0, 0); o3.scale.setScalar(p.s); o3.updateMatrix();
    cloudMesh.setMatrixAt(i * PUFFS + j, o3.matrix);
  }));
  cloudMesh.instanceMatrix.needsUpdate = true;
  traffic.update(dt);
  const tl = Math.floor(clock / 3);
  for (const t of tlights) t.bulbs.forEach((b, i) => { b.visible = ((tl + t.phase) % 3) === i; });
  for (const f of flocks) {
    f.a += f.sp * dt;
    f.g.position.set(Math.cos(f.a) * f.r, f.y + Math.sin(clock * 0.3 + f.r) * 3, Math.sin(f.a) * f.r);
    f.g.rotation.y = -f.a;
    for (const b of f.birds) { const s = Math.sin(clock * 9 + b.ph) * 0.7; b.l.rotation.z = s; b.r.rotation.z = -s; }
  }
  flight.t += dt; if (flight.t > flight.dur) newFlight();
  const fk = flight.t / flight.dur;
  plane.position.lerpVectors(flight.from, flight.to, fk); plane.lookAt(flight.to);
  const tl2 = Math.min(fk, 0.35) * flight.from.distanceTo(flight.to);
  trail.position.copy(plane.position); trail.lookAt(flight.to); trail.scale.set(1, 1, tl2);
  balloon.position.set(Math.cos(clock * 0.012) * 140, 70 + Math.sin(clock * 0.05) * 12, Math.sin(clock * 0.012) * 140);
}
