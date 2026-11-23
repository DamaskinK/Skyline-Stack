// Particle effects, weather particles, lightning, and the residents who move into each new floor.
import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, mergeColored, traffic } from './world.js';
import { Trams } from './trams.js';
import { puffTex, starTex, canvas2d, toTex } from './textures.js';
import { settings } from './settings.js';
import { styleFor, skinFor, dressForCold } from './people/styles.js';
import { buildFigure, makeFigureMaterial } from './people/figure.js';

// ── sprite particles: dust, sparks, confetti; rings on perfect drops ──
export const FX = {
  pool: [], live: [], rings: [],
  sprite(tex) {
    const s = this.pool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
    s.visible = true; scene.add(s); return s;
  },
  emit(tex, pos, { n = 8, color = 0xffffff, colors = null, size = 1, grow = 1.5, life = 0.8, speed = 3, up = 1, spread = 2, gravity = 0, add = false } = {}) {
    if (settings.quality === 'low') n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const s = this.sprite(tex); s.material.color.setHex(colors ? colors[i % colors.length] : color); s.material.opacity = 1;
      s.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      s.position.set(pos.x + Math.cos(a) * r, pos.y + Math.random() * 0.3, pos.z + Math.sin(a) * r);
      const v = new THREE.Vector3(Math.cos(a) * speed * (0.5 + Math.random()), up * (0.5 + Math.random()), Math.sin(a) * speed * (0.5 + Math.random()));
      s.scale.setScalar(size);
      this.live.push({ s, v, life: life * (0.8 + Math.random() * 0.4), t: 0, size, grow, gravity });
    }
  },
  dust(pos, big = 1) { this.emit(puffTex, pos, { n: Math.round(10 * big), color: 0xd8d0c0, size: 1.2 * big, grow: 2.2, life: 1.0, speed: 2.5 * big, up: 0.6, spread: CFG.W * 0.5 }); },
  sparks(pos) { this.emit(starTex, pos, { n: 18, color: 0xffd34d, size: 0.7, grow: 0.2, life: 0.9, speed: 6, up: 5, spread: 1.5, gravity: 9, add: true }); },
  confetti(pos) { this.emit(starTex, pos, { n: 40, colors: [0xff5a6e, 0xffd34d, 0x52d9ff, 0x5dff9b, 0xffffff], size: 0.5, grow: 0, life: 2.2, speed: 7, up: 10, spread: 2, gravity: 8 }); },
  ring(pos, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); scene.add(m); this.rings.push({ m, t: 0 });
  },
  update(dt) {
    this.live = this.live.filter((p) => {
      p.t += dt; const k = p.t / p.life;
      if (k >= 1) { p.s.visible = false; scene.remove(p.s); this.pool.push(p.s); return false; }
      p.v.y -= p.gravity * dt; p.v.multiplyScalar(1 - dt * 1.5);
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(p.size * (1 + p.grow * k)); p.s.material.opacity = 1 - k * k;
      return true;
    });
    this.rings = this.rings.filter((r) => {
      r.t += dt; const k = r.t / 0.6;
      if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); return false; }
      r.m.scale.setScalar(2 + k * 6); r.m.material.opacity = 1 - k; return true;
    });
  },
};

// ── rain, snow and wind streaks follow the camera target ──
function linePool(n, color, op) {
  const p = new Float32Array(n * 6);
  const m = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
  m.frustumCulled = false; scene.add(m); return [m, p];
}
const RAIN_N = 1100, SNOW_N = 1000, STREAK_N = 70;
const [rain, rainPos] = linePool(RAIN_N, 0xbfd6ff, 0.5);
const [streaks, streakPos] = linePool(STREAK_N, 0xffffff, 0.35);
const snowPos = new Float32Array(SNOW_N * 3);
const snow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(snowPos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, map: puffTex, transparent: true, depthWrite: false }));
snow.frustumCulled = false; scene.add(snow);
for (let i = 0; i < RAIN_N; i++) { rainPos[i * 6] = (Math.random() - .5) * 50; rainPos[i * 6 + 1] = Math.random() * 40; rainPos[i * 6 + 2] = (Math.random() - .5) * 50; }
for (let i = 0; i < SNOW_N; i++) { snowPos[i * 3] = (Math.random() - .5) * 50; snowPos[i * 3 + 1] = Math.random() * 40; snowPos[i * 3 + 2] = (Math.random() - .5) * 50; }
for (let i = 0; i < STREAK_N; i++) { streakPos[i * 6] = (Math.random() - .5) * 40; streakPos[i * 6 + 1] = Math.random() * 30; streakPos[i * 6 + 2] = (Math.random() - .5) * 30; }
const wrap = (v, c, half) => (v < c - half ? v + half * 2 : v > c + half ? v - half * 2 : v);

let snowNow = false;
export function updateWeather(dt, ph, w, c, active, clock) {
  const lo = settings.quality === 'low';
  rain.visible = !!ph.rain && active; snow.visible = !!ph.snow && active; snowNow = snow.visible;
  rain.geometry.setDrawRange(0, (lo ? RAIN_N / 2 : RAIN_N) * 2);
  if (rain.visible) {
    for (let i = 0; i < RAIN_N; i++) {
      const j = i * 6; rainPos[j + 1] -= 34 * dt; rainPos[j] += w.x * 0.7 * dt; rainPos[j + 2] += w.z * 0.7 * dt;
      rainPos[j] = wrap(rainPos[j], c.x, 25); rainPos[j + 1] = wrap(rainPos[j + 1], c.y, 20); rainPos[j + 2] = wrap(rainPos[j + 2], c.z, 25);
      rainPos[j + 3] = rainPos[j] - w.x * 0.05; rainPos[j + 4] = rainPos[j + 1] + 0.9; rainPos[j + 5] = rainPos[j + 2] - w.z * 0.05;
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }
  if (snow.visible) {
    for (let i = 0; i < SNOW_N; i++) {
      const j = i * 3; snowPos[j + 1] -= 3 * dt; snowPos[j] += (w.x * 0.6 + Math.sin(i + clock)) * dt; snowPos[j + 2] += (w.z * 0.6 + Math.cos(i * 1.3 + clock)) * dt;
      snowPos[j] = wrap(snowPos[j], c.x, 25); snowPos[j + 1] = wrap(snowPos[j + 1], c.y, 20); snowPos[j + 2] = wrap(snowPos[j + 2], c.z, 25);
    }
    snow.geometry.attributes.position.needsUpdate = true;
  }
  streaks.visible = active && w.speed > 3.5;
  if (streaks.visible) {
    const sp = Math.max(1, w.speed), ux = w.x / sp, uz = w.z / sp, L = 1 + sp * 0.25;
    streaks.material.opacity = Math.min(0.5, (w.speed - 3.5) * 0.08);
    for (let i = 0; i < STREAK_N; i++) {
      const j = i * 6; streakPos[j] += w.x * 3 * dt; streakPos[j + 2] += w.z * 3 * dt;
      streakPos[j] = wrap(streakPos[j], c.x, 20); streakPos[j + 2] = wrap(streakPos[j + 2], c.z, 15);
      if (Math.abs(streakPos[j + 1] - c.y) > 15) streakPos[j + 1] = c.y + (Math.random() - 0.5) * 30;
      streakPos[j + 3] = streakPos[j] - ux * L; streakPos[j + 4] = streakPos[j + 1]; streakPos[j + 5] = streakPos[j + 2] - uz * L;
    }
    streaks.geometry.attributes.position.needsUpdate = true;
  }
}

// ── lightning ──
const boltPos = new Float32Array(3 * 2 * 14);
const bolt = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(boltPos, 3)), new THREE.LineBasicMaterial({ color: 0xeef3ff, fog: false }));
bolt.frustumCulled = false; bolt.visible = false; scene.add(bolt);
const boltLight = new THREE.PointLight(0xbfd4ff, 0, 120); scene.add(boltLight);
let boltT = 0;
export function strikeBolt(x, y, z) {
  const y0 = y + 70;
  let px = x + 12, pz = z - 6, py = y0;
  for (let i = 0; i < 14; i++) {
    const k = (i + 1) / 14;
    const nx = x + (12 - 12 * k) + (Math.random() - 0.5) * 4 * (1 - k), nz = z + (-6 + 6 * k) + (Math.random() - 0.5) * 3 * (1 - k), ny = y0 + (y + 0.2 - y0) * k;
    boltPos.set([px, py, pz, nx, ny, nz], i * 6); px = nx; py = ny; pz = nz;
  }
  bolt.geometry.attributes.position.needsUpdate = true; boltT = 0.25;
  boltLight.position.set(x, y + 6, z); boltLight.intensity = 400;
  FX.sparks({ x, y, z });
}
export function updateBolt(dt) {
  boltT -= dt; bolt.visible = boltT > 0 && Math.floor(boltT * 30) % 3 !== 0;
  boltLight.intensity *= Math.exp(-dt * 8);
}

// ── people ──
// Figures live in js/people/: clothing data per city (styles.js) and the low-poly figure with swinging limbs (figure.js).
let city = 'kosice', cold = false;
function dress(extra = null) {
  const st = styleFor(city), skins = skinFor(city);
  let o;
  for (let tries = 0; tries < 6; tries++) {
    let sum = 0; for (const c of st.outfits) sum += c.w;
    let r = Math.random() * sum; o = st.outfits[0];
    for (const c of st.outfits) { r -= c.w; if (r <= 0) { o = c; break; } }
    if (!(extra?.noRobe && o.garment === 'robe')) break;            // riders do not wear robes
  }
  if (cold) o = dressForCold(o, Math.random);
  if (extra?.sit) o = { ...o, sit: true };
  return { geo: buildFigure(o, skins[Math.floor(Math.random() * skins.length)]), scale: o.scale ?? 1 };
}
const umbrellaTexs = [[0xe74c3c, 0xffffff], [0x3498db, 0xffffff], [0xf1c40f, 0xe67e22], [0x2ecc71, 0xffffff], [0x9b59b6, 0xffd34d]].map(([a, b]) => {
  const [c, x] = canvas2d(128, 8);
  for (let i = 0; i < 8; i++) { x.fillStyle = '#' + new THREE.Color(i % 2 ? b : a).getHexString(); x.fillRect(i * 16, 0, 16, 8); }
  return toTex(c);
});
const umbrellaGeo = new THREE.ConeGeometry(1.0, 0.45, 8, 1, true).translate(0, 1.95, 0);
const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4).translate(0.22, 1.5, 0);
const umbrellaMats = umbrellaTexs.map((t) => new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.7 }));
const handleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

function makePerson(withUmbrella, extra = null) {
  const g = new THREE.Group();
  const { geo, scale } = dress(extra), mat = makeFigureMaterial();
  const body = new THREE.Mesh(geo, mat); body.castShadow = true; body.scale.setScalar(scale); g.add(body);
  const um = new THREE.Group();
  const canopy = new THREE.Mesh(umbrellaGeo, umbrellaMats[Math.floor(Math.random() * umbrellaMats.length)]); canopy.position.x = 0.22;
  um.add(canopy, new THREE.Mesh(handleGeo, handleMat)); um.visible = withUmbrella; g.add(um);
  mat.userData.u.uAmp.value = geo.userData.amp * 0.6; mat.userData.u.uRaise.value = withUmbrella ? 1 : 0;
  g.userData.extra = extra; g.userData.umbrella = um; g.userData.body = body; g.userData.u = mat.userData.u; g.userData.baseAmp = geo.userData.amp;
  g.scale.setScalar(1.25); scene.add(g); return g;
}
function removePerson(p) { scene.remove(p); p.userData.body.geometry.dispose(); p.userData.body.material.dispose(); }
// New outfits for the people already standing around (a new city or a change in the cold).
function redress(p) {
  const old = p.userData.body, { geo, scale } = dress(p.userData.extra);
  old.geometry.dispose(); old.geometry = geo; old.scale.setScalar(scale);
  p.userData.baseAmp = geo.userData.amp;
}


// ── city life: people sitting and standing, dog walkers, cyclists (spots come from js/street-life.js through setRoutes) ──
const SEAT = 0.5, SIT_DROP = SEAT - 0.475 * 1.25;            // seat height of the benches, and how far a sitting figure sinks so its thighs rest on it
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
function bar(parts, [x0, y0, z0], [x1, y1, z1], r, c) {
  const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), g = new THREE.CylinderGeometry(r, r, d.length(), 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); parts.push([g, c]);
}
function mergeCol(parts) {
  const pos = [], nor = [], col = [];
  for (const [g0, c] of parts) { const g = g0.index ? g0.toNonIndexed() : g0, k = new THREE.Color(c); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < g.attributes.position.count; i++) col.push(k.r, k.g, k.b); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return o;
}
const bikeGeos = {};
function bikeGeo(color) {
  if (bikeGeos[color]) return bikeGeos[color];
  const P = [], R = 0.3, tyre = 0x23252b;
  for (const z of [-0.46, 0.46]) P.push([new THREE.TorusGeometry(R, 0.028, 4, 14).rotateY(Math.PI / 2).translate(0, R, z), tyre], [new THREE.TorusGeometry(R * 0.8, 0.006, 3, 10).rotateY(Math.PI / 2).translate(0, R, z), 0xb8bcc2]);
  bar(P, [0, R, -0.46], [0, 0.55, -0.12], 0.022, color); bar(P, [0, 0.55, -0.12], [0, 0.62, 0.34], 0.022, color); bar(P, [0, R, -0.46], [0, 0.62, 0.34], 0.018, color);
  bar(P, [0, 0.3, 0.02], [0, 0.55, -0.12], 0.022, color); bar(P, [0, R, 0.46], [0, 0.66, 0.36], 0.022, 0x3a3d44); bar(P, [-0.2, 0.7, 0.35], [0.2, 0.7, 0.35], 0.016, 0x3a3d44);
  P.push([new THREE.BoxGeometry(0.1, 0.04, 0.22).translate(0, 0.7, -0.16), 0x2a2a2a], [new THREE.BoxGeometry(0.04, 0.05, 0.16).translate(0.12, 0.3, 0.02), 0x2a2a2a], [new THREE.BoxGeometry(0.04, 0.05, 0.16).translate(-0.12, 0.3, 0.02), 0x2a2a2a]);
  return (bikeGeos[color] = mergeCol(P));
}
const BIKE_COLORS = [0x2f6fb0, 0xc6483c, 0x3f8f4a, 0x222428, 0xe0a52a, 0x8a4aa8];
const bikeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
let dogGeo = null;
function dog() {
  if (!dogGeo) {
    const c = rnd([0xb07a45, 0x2a2622, 0xe8dcc4, 0x8a8f94]), P = [[new THREE.BoxGeometry(0.22, 0.2, 0.5).translate(0, 0.33, 0), c], [new THREE.BoxGeometry(0.17, 0.17, 0.2).translate(0, 0.42, 0.33), c], [new THREE.BoxGeometry(0.08, 0.06, 0.08).translate(0, 0.4, 0.45), 0x222222], [new THREE.BoxGeometry(0.04, 0.12, 0.04).translate(0.07, 0.54, 0.3), c], [new THREE.BoxGeometry(0.04, 0.12, 0.04).translate(-0.07, 0.54, 0.3), c], [new THREE.BoxGeometry(0.05, 0.05, 0.22).rotateX(-0.6).translate(0, 0.42, -0.3), c]];
    for (const x of [-0.07, 0.07]) for (const z of [-0.18, 0.18]) P.push([new THREE.BoxGeometry(0.06, 0.24, 0.06).translate(x, 0.12, z), c]);
    dogGeo = mergeCol(P);
  }
  const m = new THREE.Mesh(dogGeo, bikeMat); m.castShadow = true; m.scale.setScalar(1.3); scene.add(m); return m;
}
function inBasin(blockers, x, z) {                        // inside a fountain / pool basin or within 1.2 m of its rim
  for (const b of blockers) {
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    const p = b.p; let c = false;
    for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
      const xi = p[2 * i], zi = p[2 * i + 1], xj = p[2 * j], zj = p[2 * j + 1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
      const dx = xj - xi, dz = zj - zi, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / l2));
      if (Math.hypot(x - xi - dx * t, z - zi - dz * t) < 1.2) return true;
    }
    if (c) return true;
  }
  return false;
}
function polyRoute(p) {
  const cum = [0]; for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
  return { p, cum, len: cum[cum.length - 1] };
}
function nearestS(r, i) {                                // start a cyclist near the square, not out at the far end of the route
  let best = 0, bd = 1e9; for (let k = 0; k < r.p.length / 2; k++) { const d = Math.hypot(r.p[2 * k], r.p[2 * k + 1]); if (d < bd) { bd = d; best = k; } }
  return Math.max(0, Math.min(r.len, r.cum[best] + (((i * 0.37) % 1) - 0.5) * 70));
}
function along(r, s) {                                    // point and unit direction on a route at distance s
  let k = 1; while (k < r.cum.length - 1 && r.cum[k] < s) k++;
  const l = r.cum[k] - r.cum[k - 1] || 1, f = Math.max(0, Math.min(1, (s - r.cum[k - 1]) / l)), x0 = r.p[2 * k - 2], z0 = r.p[2 * k - 1], x1 = r.p[2 * k], z1 = r.p[2 * k + 1];
  return [x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, (x1 - x0) / l, (z1 - z0) / l];
}

// Life density (S0002 06): the quality preset sets the most that can be out, the finished plots of the district (0-5) set how much of it is.
const MAX_LIFE = {     // walkers, seated, standing spots, cyclists, dog walkers, cars (moving), parked cars and trams at 5 finished plots
  low: { walkers: 14, sit: 3, stand: 3, bikes: 3, dogs: 1, cars: 14, parked: 24, trams: 1 },
  medium: { walkers: 26, sit: 6, stand: 5, bikes: 5, dogs: 2, cars: 28, parked: 46, trams: 2 },
  high: { walkers: 36, sit: 8, stand: 7, bikes: 7, dogs: 3, cars: 40, parked: 70, trams: 3 },
};
const LIFE_SHARE = [0.3, 0.45, 0.62, 0.78, 0.9, 1];     // share of the maximum at 0..5 finished plots
export function lifeCount(kind, plots, quality = settings.quality) {
  const max = (MAX_LIFE[quality] || MAX_LIFE.high)[kind], share = LIFE_SHARE[Math.max(0, Math.min(5, Math.round(plots)))];
  return Math.max(kind === 'dogs' ? (plots >= 2 ? 1 : 0) : 1, Math.round(max * share));
}

function place2(P, spot) {            // a person standing still at a spot (vendor, customer, musician, listener)
  const p = makePerson(false); p.userData.u.uAmp.value = 0; p.userData.u.uPhase.value = 0;
  p.position.set(spot.x, 0.05, spot.z); p.rotation.set(spot.tilt || 0, spot.rot, 0); P.folk.push({ p }); return p;
}
const _right = new THREE.Vector3(), _p = new THREE.Vector3();
export const People = {
  flyers: [], walkers: [], parked: [], side: 1, routes: [], life: null, folk: [], cyclists: [], blockers: [], progress: 2, musicians: [], notes: 0,
  // OpenStreetMap levels: street walkers follow the real streets and footpaths (items { p: flat [x, z, ...], off: metres from the centre line }) instead of the procedural grid.
  setRoutes(list) {
    this.life = list.life || null;          // seats, standing spots, bike routes and basins from the near ring (street-life.js)
    this.blockers = (this.life?.basins || []).map((p) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]); } return { p, x0: x0 - 1.3, x1: x1 + 1.3, z0: z0 - 1.3, z1: z1 + 1.3 }; });
    this.buildLife();
    this.routes = list.map(({ p, off }) => {
      const cum = [0]; for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
      return { p, off, cum, len: cum[cum.length - 1] };
    }).filter((r) => r.len > 25);
  },
  // Finished plots of the district (0-5): more people, cars, open shops, market stalls and musicians. Rebuilds the street life when it changed.
  setDistrictLife(plots) {
    const n = Math.max(0, Math.min(5, Math.round(plots)));
    if (n === this.progress) return;
    this.progress = n; this.applyTraffic();
    if (this.walkers.length) this.setWalkers(9); else this.buildLife();
  },
  applyTraffic() {
    traffic.setCount(lifeCount('cars', this.progress)); Trams.setCount(lifeCount('trams', this.progress));
    // parked cars of the near ring: the nearest first, as many as the preset and the finished plots allow (shared between the two car kits)
    const want = lifeCount('parked', this.progress), total = this.parked.reduce((n, k) => n + k.n, 0) || 1;
    for (const k of this.parked) for (const im of k.ims) im.count = Math.min(k.n, Math.ceil(want * k.n / total));
  },
  setParked(list) { this.parked = list || []; this.applyTraffic(); },
  // The city whose clothes people wear (a level id from levels.js); people already walking get new outfits.
  setCity(id) { if (id === city) return; city = id; for (const w of this.walkers) redress(w.p); for (const f of this.folk) redress(f.p); for (const c of this.cyclists) redress(c.rider); },
  // People who sit on benches, stand and chat, and cyclists on the bike lanes; counts follow the quality preset.
  buildLife() {
    this.clearLife();
    const L = this.life; if (!L) return;
    const n = this.progress, pick = (a, n) => a.filter((q) => Math.hypot(q.x, q.z) < 130).sort((u, v) => Math.hypot(u.x, u.z) - Math.hypot(v.x, v.z)).filter((_, i) => i % 2 === 0 || n > 6).slice(0, n);
    const place = (spot, sit) => {
      const p = makePerson(false, sit ? { sit: true } : null); p.userData.u.uAmp.value = 0; p.userData.u.uPhase.value = 0;
      p.position.set(spot.x, (spot.y ?? 0.05) + (sit ? SIT_DROP : 0), spot.z); p.rotation.y = spot.rot; this.folk.push({ p }); return p;
    };
    L.events?.setProgress(n);
    for (const s of pick(L.sit, lifeCount('sit', n))) place(s, true);
    for (const s of pick(L.stand, lifeCount('stand', n))) {
      place({ ...s, y: 0.05 }, false);
      if (s.mate) { const q = place({ x: s.x + Math.sin(s.rot) * 0.9, z: s.z + Math.cos(s.rot) * 0.9, rot: s.rot + Math.PI, y: 0.05 }, false); q.rotation.y += (Math.random() - 0.5) * 0.5; }
    }
    const routes = L.bikeRoutes.map((r) => ({ ...polyRoute(r.p), d: r.d })).filter((r) => r.len > 20 && r.d < 150).sort((a, b) => a.d - b.d);
    const nb = lifeCount('bikes', n);
    for (let i = 0; routes.length && i < nb; i++) {
      const r = routes[i % routes.length], g = new THREE.Group(), bike = new THREE.Mesh(bikeGeo(rnd(BIKE_COLORS)), bikeMat); bike.castShadow = true; g.add(bike);
      const rider = makePerson(false, { noRobe: true }), pivot = new THREE.Group(); rider.scale.setScalar(1); rider.position.set(0, -0.62, 0); rider.userData.body.castShadow = true;
      rider.userData.u.uAmp.value = 0.5; pivot.position.set(0, 0.8, -0.14); pivot.rotation.x = 0.35; pivot.add(rider); g.add(pivot);
      g.scale.setScalar(1.2); scene.add(g);
      this.cyclists.push({ g, rider, r, s: nearestS(r, i), d: i % 2 ? 1 : -1, v: 3 + (i % 3) * 0.6, ph: Math.random() * 6 });
    }
    this.buildEvents();
  },
  // Vendors and customers at the open market stalls, a musician with an audience
  buildEvents() {
    const E = this.life?.events; if (!E) return;
    E.stalls.slice(0, E.shown.stalls).forEach((st, i) => {
      const bx = Math.sin(st.rot), bz = Math.cos(st.rot);               // front of the stall (customers side)
      place2(this, { x: st.x - bx * 0.55, z: st.z - bz * 0.55, rot: st.rot });
      if (i % 2 === 0) place2(this, { x: st.x + bx * 1.2, z: st.z + bz * 1.2, rot: st.rot + Math.PI + (Math.random() - 0.5) * 0.4 });
    });
    this.musicians = E.musicians.slice(0, E.shown.musicians).map((m, i) => {
      const fx = Math.sin(m.rot), fz = Math.cos(m.rot), p = place2(this, { x: m.x - fx * 0.9, z: m.z - fz * 0.9, rot: m.rot, tilt: 0.06 });
      for (let k = 0; k < 3; k++) { const a = (k - 1) * 0.7, d = 3.2 + (k % 2) * 0.6; place2(this, { x: m.x - fx * 0.9 + Math.sin(m.rot + a) * d, z: m.z - fz * 0.9 + Math.cos(m.rot + a) * d, rot: m.rot + a + Math.PI + (Math.random() - 0.5) * 0.3 }); }
      return { x: m.x - fx * 0.9, z: m.z - fz * 0.9, t: i * 1.7 };
    });
  },
  clearLife() {
    for (const f of this.folk) removePerson(f.p); this.folk = []; this.musicians = [];
    for (const c of this.cyclists) { scene.remove(c.g); c.rider.userData.body.geometry.dispose(); c.rider.userData.body.material.dispose(); } this.cyclists = [];
  },
  // Residents glide in with umbrellas from the upper left or right, away from the drop zone, and step in through the side of the new floor.
  arrive(floorMesh, count, camera) {
    _right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    for (let i = 0; i < count && this.flyers.length < 30; i++) {
      this.side *= -1;
      const s = this.side, p = makePerson(true), fp = floorMesh.position;
      const start = new THREE.Vector3().copy(fp).addScaledVector(_right, s * (15 + Math.random() * 5)).add(new THREE.Vector3(0, 7 + Math.random() * 5, (Math.random() - 0.5) * 4));
      p.position.copy(start);
      this.flyers.push({ p, target: floorMesh, s, right: _right.clone(), start, delay: i * 0.35, t: 0, dur: 2.6 + Math.random() * 0.6, oy: (Math.random() - 0.5) * 0.3, done: 0 });
    }
  },
  setWalkers(radius) {
    for (const w of this.walkers) { removePerson(w.p); if (w.dog) scene.remove(w.dog); }
    this.walkers = []; let dogs = 0;
    this.buildLife(); this.applyTraffic();
    const n = lifeCount('walkers', this.progress);
    for (let i = 0; i < n; i++) {
      const p = makePerson(false);
      const kind = i % 3 === 0 ? 'street' : 'plaza';
      const dogW = kind === 'street' && this.routes.length && dogs < lifeCount('dogs', this.progress) ? (dogs++, dog()) : null;
      this.walkers.push({ p, dog: dogW, kind, a: Math.random() * Math.PI * 2, r: radius + Math.random() * 4, sp: (0.15 + Math.random() * 0.2) * (i % 2 ? 1 : -1), ph: Math.random() * 6,
        rt: i, road: i % 4, pos: (Math.random() - 0.5) * 200, off: (i % 2 ? 1 : -1) * 6, v: (1.2 + Math.random()) * (i % 2 ? 1 : -1) });
    }
  },
  update(dt, wind, raining) {
    if (snowNow !== cold) { cold = snowNow; for (const w of this.walkers) redress(w.p); }
    this.flyers = this.flyers.filter((f) => {
      if (!f.target.parent) { removePerson(f.p); return false; }
      if (f.delay > 0) { f.delay -= dt; f.p.visible = false; return true; }
      f.p.visible = true;
      f.p.userData.u.uPhase.value = f.t * 6; const fp = f.target.position;
      const end = _p.copy(fp).addScaledVector(f.right, f.s * (CFG.W * 0.5 + 0.35)); end.y = fp.y - CFG.H * 0.45 + f.oy;
      if (f.done > 0) {
        f.done += dt; const k = Math.min(1, f.done / 0.4);
        f.p.position.copy(end).addScaledVector(f.right, -f.s * k * 0.8);
        f.p.scale.setScalar(1.25 * (1 - k)); f.p.userData.umbrella.scale.setScalar(1 - k);
        if (k >= 1) { removePerson(f.p); return false; }
        return true;
      }
      f.t += dt; const k = Math.min(1, f.t / f.dur);
      // drop height first, out at the side, then drift in sideways at floor level: never through the drop zone above the tower
      const kv = Math.min(1, k * 1.6), ev = 1 - (1 - kv) * (1 - kv) * (1 - kv), eh = k * k;
      f.p.position.set(f.start.x + (end.x - f.start.x) * eh, f.start.y + (end.y - f.start.y) * ev, f.start.z + (end.z - f.start.z) * eh);
      f.p.position.x += wind.x * 0.03 * (1 - k); f.p.position.z += wind.z * 0.03 * (1 - k);
      f.p.rotation.set(Math.cos(f.t * 2.3) * 0.08, 0, Math.sin(f.t * 3) * 0.12 + f.s * 0.25 * (1 - k));
      if (k >= 1) f.done = 0.0001;
      return true;
    });
    this.updateLife(dt, raining);
    for (const w of this.walkers) {
      w.ph += dt * 8;
      if (w.kind === 'plaza') {
        let na = w.a + w.sp * dt * 0.5;
        if (this.blockers.length && inBasin(this.blockers, Math.cos(w.a) * w.r, Math.sin(w.a) * w.r)) { for (let k = 0; k < 80 && inBasin(this.blockers, Math.cos(w.a) * w.r, Math.sin(w.a) * w.r); k++) w.a += Math.sign(w.sp) * 0.03; na = w.a; }   // started inside a basin: step out
        else if (this.blockers.length && inBasin(this.blockers, Math.cos(na) * w.r, Math.sin(na) * w.r) && !inBasin(this.blockers, Math.cos(w.a) * w.r, Math.sin(w.a) * w.r)) w.sp = -w.sp;   // never walk into a basin: turn around
        else w.a = na;
        w.p.position.set(Math.cos(w.a) * w.r, Math.abs(Math.sin(w.ph)) * 0.06, Math.sin(w.a) * w.r);
        w.p.rotation.y = -w.a + (w.sp > 0 ? Math.PI : 0);
      } else if (this.routes.length) {
        const r = this.routes[w.rt % this.routes.length];
        w.s ??= (w.rt * 0.37 % 1) * r.len; w.d ??= w.v > 0 ? 1 : -1;
        const off = r.off * (w.rt % 2 ? 1 : -1), at = (sv, dv) => { const [x, z, ux, uz] = along(r, sv); return [x - uz * dv * off, z + ux * dv * off, ux * dv, uz * dv]; };
        if (this.blockers.length) { for (let k = 0; k < 60; k++) { const q = at(w.s, w.d); if (!inBasin(this.blockers, q[0], q[1])) break; w.s = Math.max(0, Math.min(r.len, w.s + w.d * 0.8)); } }   // started inside a basin: step out
        const s0 = w.s; w.s += w.d * Math.abs(w.v) * 0.6 * dt;
        if (w.s > r.len) { w.s = r.len; w.d = -1; } else if (w.s < 0) { w.s = 0; w.d = 1; }
        if (this.blockers.length) { const q = at(w.s, w.d), q0 = at(s0, w.d); if (inBasin(this.blockers, q[0], q[1]) && !inBasin(this.blockers, q0[0], q0[1])) { w.s = s0; w.d = -w.d; } }
        const [px, pz, tx, tz] = at(w.s, w.d);
        w.p.position.set(px, 0.06 + Math.abs(Math.sin(w.ph)) * 0.06, pz);
        w.p.rotation.y = Math.atan2(tx, tz);
        if (w.dog) { w.dog.position.set(px - tx * 1.1 - tz * 0.5, 0.05 + Math.abs(Math.sin(w.ph * 1.3)) * 0.04, pz - tz * 1.1 + tx * 0.5); w.dog.rotation.y = Math.atan2(tx, tz); w.dog.visible = true; }
      } else {
        w.pos += w.v * dt; if (w.pos > 120) w.pos -= 240; if (w.pos < -120) w.pos += 240;
        const s = w.road < 2 ? (w.road ? 1 : -1) : (w.road === 2 ? 1 : -1), base = 44 * s + w.off;
        if (w.road < 2) { w.p.position.set(w.pos, 0.05, base); w.p.rotation.y = w.v > 0 ? Math.PI / 2 : -Math.PI / 2; }
        else { w.p.position.set(base, 0.05, w.pos); w.p.rotation.y = w.v > 0 ? 0 : Math.PI; }
        w.p.position.y += Math.abs(Math.sin(w.ph)) * 0.06;
      }
      const u = w.p.userData.u; u.uPhase.value = w.ph; u.uAmp.value = w.p.userData.baseAmp * 0.6; u.uRaise.value = raining ? 1 : 0;
      w.p.userData.umbrella.visible = raining;
    }
  },
  updateLife(dt, raining) {
    for (const m of this.musicians) {                  // a few notes drift up from the musician now and then
      m.t -= dt; if (m.t <= 0) { m.t = 1.1 + Math.random() * 0.8; FX.emit(starTex, { x: m.x, y: 1.9, z: m.z }, { n: 1, colors: [0xffd34d, 0xffffff, 0x9ad4ff], size: 0.32, grow: 0.3, life: 1.6, speed: 0.3, up: 0.9, spread: 0.3, add: true }); }
    }
    for (const f of this.folk) f.p.userData.umbrella.visible = raining && !f.p.userData.extra?.sit;
    for (const c of this.cyclists) {
      c.s += c.d * c.v * dt; c.ph += dt * c.v * 2.4;
      if (c.s > c.r.len) { c.s = c.r.len; c.d = -1; } else if (c.s < 0) { c.s = 0; c.d = 1; }
      const [x, z, ux, uz] = along(c.r, c.s);
      c.g.position.set(x, 0.06, z); c.g.rotation.y = Math.atan2(ux * c.d, uz * c.d); c.rider.userData.u.uPhase.value = c.ph;
    }
  },
  clear() { for (const f of this.flyers) removePerson(f.p); this.flyers = []; },
};
