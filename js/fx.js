// Particle effects, weather particles, lightning, and the residents who move into each new floor.
import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, mergeColored } from './world.js';
import { puffTex, starTex, canvas2d, toTex } from './textures.js';
import { settings } from './settings.js';

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

export function updateWeather(dt, ph, w, c, active, clock) {
  const lo = settings.quality === 'low';
  rain.visible = !!ph.rain && active; snow.visible = !!ph.snow && active;
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
const skin = [0xffd2a6, 0xe0a87a, 0x9a6440, 0xffe0bd];
const shirts = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xff7f50, 0xffffff, 0x1abc9c];
const personGeos = new Map();
function personGeo(si, ki) {
  const key = si * 10 + ki;
  if (!personGeos.has(key)) {
    personGeos.set(key, mergeColored([
      [new THREE.BoxGeometry(0.3, 0.42, 0.16).translate(0, 0.21, 0), 0x2c3e66],
      [new THREE.CylinderGeometry(0.16, 0.2, 0.55, 7).translate(0, 0.68, 0), shirts[si]],
      [new THREE.SphereGeometry(0.16, 8, 6).translate(0, 1.1, 0), skin[ki]],
      [new THREE.BoxGeometry(0.08, 0.45, 0.08).translate(0.22, 1.1, 0), shirts[si]],   // raised arm holding the umbrella
    ]));
  }
  return personGeos.get(key);
}
const personMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const umbrellaTexs = [[0xe74c3c, 0xffffff], [0x3498db, 0xffffff], [0xf1c40f, 0xe67e22], [0x2ecc71, 0xffffff], [0x9b59b6, 0xffd34d]].map(([a, b]) => {
  const [c, x] = canvas2d(128, 8);
  for (let i = 0; i < 8; i++) { x.fillStyle = '#' + new THREE.Color(i % 2 ? b : a).getHexString(); x.fillRect(i * 16, 0, 16, 8); }
  return toTex(c);
});
const umbrellaGeo = new THREE.ConeGeometry(1.0, 0.45, 8, 1, true).translate(0, 1.95, 0);
const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4).translate(0.22, 1.5, 0);
const umbrellaMats = umbrellaTexs.map((t) => new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.7 }));
const handleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

function makePerson(withUmbrella) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(personGeo(Math.floor(Math.random() * shirts.length), Math.floor(Math.random() * skin.length)), personMat);
  body.castShadow = true; g.add(body);
  const um = new THREE.Group();
  const canopy = new THREE.Mesh(umbrellaGeo, umbrellaMats[Math.floor(Math.random() * umbrellaMats.length)]); canopy.position.x = 0.22; canopy.geometry = umbrellaGeo;
  um.add(canopy, new THREE.Mesh(handleGeo, handleMat)); um.visible = withUmbrella; g.add(um);
  g.userData.umbrella = um; g.userData.body = body;
  g.scale.setScalar(1.25); scene.add(g); return g;
}

const _right = new THREE.Vector3(), _p = new THREE.Vector3();
export const People = {
  flyers: [], walkers: [], side: 1, routes: [],
  // OpenStreetMap levels: street walkers follow the real streets and footpaths (items { p: flat [x, z, ...], off: metres from the centre line }) instead of the procedural grid.
  setRoutes(list) {
    this.routes = list.map(({ p, off }) => {
      const cum = [0]; for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
      return { p, off, cum, len: cum[cum.length - 1] };
    }).filter((r) => r.len > 25);
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
    for (const w of this.walkers) scene.remove(w.p);
    this.walkers = [];
    const n = settings.quality === 'low' ? 12 : 26;
    for (let i = 0; i < n; i++) {
      const p = makePerson(false);
      const kind = i % 3 === 0 ? 'street' : 'plaza';
      this.walkers.push({ p, kind, a: Math.random() * Math.PI * 2, r: radius + Math.random() * 4, sp: (0.15 + Math.random() * 0.2) * (i % 2 ? 1 : -1), ph: Math.random() * 6,
        rt: i, road: i % 4, pos: (Math.random() - 0.5) * 200, off: (i % 2 ? 1 : -1) * 6, v: (1.2 + Math.random()) * (i % 2 ? 1 : -1) });
    }
  },
  update(dt, wind, raining) {
    this.flyers = this.flyers.filter((f) => {
      if (!f.target.parent) { scene.remove(f.p); return false; }
      if (f.delay > 0) { f.delay -= dt; f.p.visible = false; return true; }
      f.p.visible = true;
      const fp = f.target.position;
      const end = _p.copy(fp).addScaledVector(f.right, f.s * (CFG.W * 0.5 + 0.35)); end.y = fp.y - CFG.H * 0.45 + f.oy;
      if (f.done > 0) {
        f.done += dt; const k = Math.min(1, f.done / 0.4);
        f.p.position.copy(end).addScaledVector(f.right, -f.s * k * 0.8);
        f.p.scale.setScalar(1.25 * (1 - k)); f.p.userData.umbrella.scale.setScalar(1 - k);
        if (k >= 1) { scene.remove(f.p); return false; }
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
    for (const w of this.walkers) {
      w.ph += dt * 8;
      if (w.kind === 'plaza') {
        w.a += w.sp * dt * 0.5;
        w.p.position.set(Math.cos(w.a) * w.r, Math.abs(Math.sin(w.ph)) * 0.06, Math.sin(w.a) * w.r);
        w.p.rotation.y = -w.a + (w.sp > 0 ? Math.PI : 0);
      } else if (this.routes.length) {
        const r = this.routes[w.rt % this.routes.length];
        w.s ??= (w.rt * 0.37 % 1) * r.len; w.d ??= w.v > 0 ? 1 : -1;
        w.s += w.d * Math.abs(w.v) * 0.6 * dt;
        if (w.s > r.len) { w.s = r.len; w.d = -1; } else if (w.s < 0) { w.s = 0; w.d = 1; }
        let k = 1; while (k < r.cum.length - 1 && r.cum[k] < w.s) k++;
        const l = r.cum[k] - r.cum[k - 1] || 1, f = (w.s - r.cum[k - 1]) / l, x0 = r.p[2 * k - 2], z0 = r.p[2 * k - 1], x1 = r.p[2 * k], z1 = r.p[2 * k + 1];
        const tx = (x1 - x0) / l * w.d, tz = (z1 - z0) / l * w.d, off = r.off * (w.rt % 2 ? 1 : -1);
        w.p.position.set(x0 + (x1 - x0) * f - tz * off, 0.06 + Math.abs(Math.sin(w.ph)) * 0.06, z0 + (z1 - z0) * f + tx * off);
        w.p.rotation.y = Math.atan2(tx, tz);
      } else {
        w.pos += w.v * dt; if (w.pos > 120) w.pos -= 240; if (w.pos < -120) w.pos += 240;
        const s = w.road < 2 ? (w.road ? 1 : -1) : (w.road === 2 ? 1 : -1), base = 44 * s + w.off;
        if (w.road < 2) { w.p.position.set(w.pos, 0.05, base); w.p.rotation.y = w.v > 0 ? Math.PI / 2 : -Math.PI / 2; }
        else { w.p.position.set(base, 0.05, w.pos); w.p.rotation.y = w.v > 0 ? 0 : Math.PI; }
        w.p.position.y += Math.abs(Math.sin(w.ph)) * 0.06;
      }
      w.p.userData.umbrella.visible = raining;
    }
  },
  clear() { for (const f of this.flyers) scene.remove(f.p); this.flyers = []; },
};
