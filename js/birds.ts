// City birds (S0004 16): feral pigeons, common swifts and hooded crows from assets/models/birds.glb (scripts/blender/birds.py).
// Flying birds are instanced (one InstancedMesh per species and level of detail) and flap through morph targets per instance (glide, `up`, `down`).
// Pigeons sit on perches (roof ridges and parapets of the near ring, ledges of the landmarks, the plaza) and take off when the crane comes near,
// circle and land again. Every bird keeps a minimum distance from the camera and from the tower axis: positions inside that sphere are pushed
// to its surface, so nothing ever flies into the lens.
import * as THREE from 'three';
import { loadManifest } from './assets.js';
import { settings } from './settings.js';

type Species = 'pigeon' | 'swift' | 'crow';
interface Perch { x: number; y: number; z: number; yaw: number }
interface Flock { sp: Species; hx: number; hz: number; rx: number; rz: number; y: number; dy: number; w: number; ph: number; fig: number; members: THREE.Vector3[]; flap: number[]; t: number }
interface Pigeon { perch: Perch; state: 'sit' | 'up' | 'loop' | 'down'; t: number; dur: number; loopC: THREE.Vector3; loopR: number; loopA: number; loopW: number; p0: THREE.Vector3; p1: THREE.Vector3; c0: THREE.Vector3; c1: THREE.Vector3; ph: number; idle: number; peck: number; look: number; yaw: number; calm: number }

const SPEC: Record<Species, { hz: number; minCam: number; lodD: number; scale: number }> = {
  pigeon: { hz: 6.5, minCam: 12, lodD: 40, scale: 1.1 },
  swift: { hz: 9, minCam: 10, lodD: 35, scale: 1.2 },
  crow: { hz: 3.2, minCam: 14, lodD: 55, scale: 1.0 },
};
const CAM_KEEP = 12;                                 // metres: no bird nearer to the camera
const TOWER_KEEP = 7.5;                              // metres from the tower axis (crane, hook and the hanging block live there)

let root: THREE.Group | null = null, ready = false, failed = false;
// Three r160 has no per-instance morph targets: the two morph deltas become plain vertex attributes and every instance carries its two weights
// (`aMorph`), blended in the vertex shader of the shared bird material.
type MorphIM = THREE.InstancedMesh & { morph: THREE.InstancedBufferAttribute };
const ims: Record<string, MorphIM> = {};
function morphGeometry(src: THREE.BufferGeometry, n: number): THREE.BufferGeometry {
  const g = src.clone(), mp = g.morphAttributes.position || [], mn = g.morphAttributes.normal || [];
  const zero = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => new THREE.Float32BufferAttribute(new Float32Array(a.count * 3), 3);
  const P = g.attributes.position, rel = g.morphTargetsRelative;
  const delta = (t: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined, base: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
    if (!t) return zero(base);
    const out = new Float32Array(base.count * 3);
    for (let i = 0; i < base.count; i++) { out[3 * i] = t.getX(i) - (rel ? 0 : base.getX(i)); out[3 * i + 1] = t.getY(i) - (rel ? 0 : base.getY(i)); out[3 * i + 2] = t.getZ(i) - (rel ? 0 : base.getZ(i)); }
    return new THREE.Float32BufferAttribute(out, 3);
  };
  g.setAttribute('mUp', delta(mp[0], P)); g.setAttribute('mDown', delta(mp[1], P));
  g.setAttribute('nUp', delta(mn[0], g.attributes.normal)); g.setAttribute('nDown', delta(mn[1], g.attributes.normal));
  g.morphAttributes = {};
  g.setAttribute('aMorph', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage));
  return g;
}
const flocks: Flock[] = [];
let pigeons: Pigeon[] = [];
let perchSrc: { roofs: unknown[] | null; landmarks: THREE.Object3D | null } | null = null, perchDirty = false;
const crane = { hook: new THREE.Vector3(0, -99, 0), jib0: new THREE.Vector3(), jib1: new THREE.Vector3(), tower: new THREE.Vector2() };
let seed = 7;
const rnd = (): number => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), o3 = new THREE.Object3D();

/** The crane this frame (js/entities.ts): the hook and the jib. Pigeons near them take off. */
export function setCraneHint(hx: number, hy: number, hz: number, mastX: number, jibY: number, cz: number, tx: number, tz: number): void {
  crane.hook.set(hx, hy, hz); crane.jib0.set(mastX - 9, jibY, cz); crane.jib1.set(mastX + 32, jibY, cz); crane.tower.set(tx, tz);
}

/** Where pigeons may sit, for the level just built: `roofs` from the near ring (userData.roofs), `landmarks` the landmark group (ledges are found in its meshes). */
export function setPerchSources(roofs: unknown[] | null, landmarks: THREE.Object3D | null): void { perchSrc = { roofs, landmarks }; perchDirty = true; }

function load(sc: THREE.Scene): void {
  root = new THREE.Group(); root.name = 'birds'; sc.add(root);
  loadManifest('assets/models/manifest.json').then(({ assets }) => {
    const g = assets.birds as THREE.Object3D | undefined; if (!g || !root) { failed = true; return; }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.0 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute vec3 mUp;\nattribute vec3 mDown;\nattribute vec3 nUp;\nattribute vec3 nDown;\nattribute vec2 aMorph;\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n objectNormal = normalize(objectNormal + nUp * aMorph.x + nDown * aMorph.y);')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += mUp * aMorph.x + mDown * aMorph.y;');
    };
    g.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const n = settings.quality === 'low' ? 24 : 64;
      const geo = morphGeometry(m.geometry, n);
      const im = new THREE.InstancedMesh(geo, mat, n) as unknown as MorphIM; im.morph = geo.attributes.aMorph as THREE.InstancedBufferAttribute;
      im.name = 'bird-' + m.name; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; im.count = 0;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      ims[m.name.replace(/\.\d+$/, '')] = im; root!.add(im);
    });
    ready = !!(ims.pigeon_fly0 && ims.pigeon_sit0);
    if (!ready) failed = true;
  }, () => { failed = true; });
}

function makeFlocks(): void {
  flocks.length = 0;
  const low = settings.quality === 'low';
  const add = (sp: Species, n: number, ang: number, d: number, r: number, y: number, spread: number, speed: number) => {
    const members: THREE.Vector3[] = [], flap: number[] = [];
    for (let i = 0; i < n; i++) { members.push(new THREE.Vector3((rnd() - 0.5) * spread, (rnd() - 0.5) * spread * 0.35, (rnd() - 0.5) * spread)); flap.push(rnd() * 6.28); }
    flocks.push({ sp, hx: Math.cos(ang) * d, hz: Math.sin(ang) * d, rx: r, rz: r * (0.6 + rnd() * 0.5), y, dy: 3 + rnd() * 4, w: speed / r, ph: rnd() * 6.28, fig: sp === 'swift' ? 2 : 1, members, flap, t: 0 });
  };
  add('pigeon', low ? 6 : 11, 0.6, 45, 22, 24, 7, 11);
  add('pigeon', low ? 5 : 8, 3.4, 60, 28, 32, 6, 12);
  add('swift', low ? 5 : 9, 2.0, 40, 34, 38, 12, 16);
  if (!low) add('swift', 7, 4.9, 55, 30, 55, 14, 17);
  add('crow', 2, 5.6, 90, 55, 62, 10, 8);
  if (!low) add('crow', 1, 1.2, 110, 70, 75, 0, 7.5);
}

// ── perches ──
interface RoofLike { kind: string; h: number; p?: number[]; sign?: number; gable?: boolean; roof?: { cx: number; cz: number; ax: [number, number]; rl: number; rh: number; h: number; hv: number } }
function findPerches(): Perch[] {
  const out: Perch[] = [];
  const roofs = (perchSrc?.roofs || []) as RoofLike[];
  // ridges of the tiled roofs and the parapets of flat roofs, nearest first
  const cand: { d: number; f: () => void }[] = [];
  for (const r of roofs) {
    if (r.roof) {
      const R = r.roof, d = Math.hypot(R.cx, R.cz); if (R.rl < 1.2) continue;
      cand.push({ d, f: () => {
        const n = 1 + Math.floor(rnd() * 3), u0 = (rnd() - 0.5) * R.rl * 1.4, yaw = Math.atan2(R.ax[0], R.ax[1]) + Math.PI / 2 + (rnd() < 0.5 ? Math.PI : 0);
        for (let k = 0; k < n; k++) { const u = u0 + k * 0.45; out.push({ x: R.cx + R.ax[0] * u, y: R.h + R.rh + (r.gable ? 0.2 * R.rh / (R.hv + 0.45) : 0) + 0.02, z: R.cz + R.ax[1] * u, yaw: yaw + (rnd() - 0.5) * 0.6 }); }
      } });
    } else if (r.p && r.p.length >= 6) {
      const p = r.p, n = p.length / 2, top = r.kind === 'panel' ? 0.82 : 0.5, out0 = r.kind === 'panel' ? 0.06 : 0.07;
      let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += p[2 * i] / n; cz += p[2 * i + 1] / n; }
      cand.push({ d: Math.hypot(cx, cz), f: () => {
        const i = Math.floor(rnd() * n), j = (i + 1) % n, ex = p[2 * j] - p[2 * i], ez = p[2 * j + 1] - p[2 * i + 1], l = Math.hypot(ex, ez); if (l < 3) return;
        const sg = r.sign ?? 1, nx = ez / l * sg, nz = -ex / l * sg, k = 1 + Math.floor(rnd() * 3), t0 = 0.15 + rnd() * 0.6;
        for (let q = 0; q < k; q++) { const t = Math.min(0.95, t0 + q * 0.5 / l); out.push({ x: p[2 * i] + ex * t + nx * out0, y: r.h + top + 0.01, z: p[2 * i + 1] + ez * t + nz * out0, yaw: Math.atan2(nx, nz) + (rnd() - 0.5) * 0.8 }); }
      } });
    }
  }
  cand.sort((a, b) => a.d - b.d);
  const want = settings.quality === 'low' ? 16 : 40;
  for (const c of cand) { if (out.length >= want * 0.7) break; if (c.d < 22 || rnd() < 0.5) continue; c.f(); }
  // ledges of the landmarks: up-facing triangles above 6 m (galleries, cornices, the gallery of the cathedral tower)
  const lm = perchSrc?.landmarks;
  if (lm) {
    lm.updateMatrixWorld(true);
    const tris: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; w: number }[] = []; let total = 0;
    const visit = (o: THREE.Object3D) => {
      if ((o as THREE.LOD).isLOD) { const l = (o as THREE.LOD).levels[0]; if (l) visit(l.object); return; }
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh) {
        const g = m.geometry, pos = g.attributes.position, idx = g.index; if (!pos) return;
        const cnt = idx ? idx.count : pos.count; if (cnt > 600000) return;
        const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), N = new THREE.Vector3();
        for (let t = 0; t < cnt; t += 3) {
          const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
          A.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); B.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); Cc.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
          if (A.y < 6 || B.y < 6 || Cc.y < 6) continue;
          N.subVectors(B, A).cross(v1.subVectors(Cc, A)); const ar = N.length() / 2; if (ar < 0.03) continue;
          if (N.y / (2 * ar) < 0.95) continue;
          tris.push({ a: A.clone(), b: B.clone(), c: Cc.clone(), w: Math.min(ar, 2) }); total += Math.min(ar, 2);
        }
      }
      for (const c of o.children) visit(c);
    };
    visit(lm);
    const n = Math.min(tris.length ? want - out.length : 0, Math.round(want * 0.45));
    for (let k = 0; k < n; k++) {
      let r = rnd() * total, t = tris[0]; for (const q of tris) { r -= q.w; if (r <= 0) { t = q; break; } }
      let s = rnd(), u = rnd(); if (s + u > 1) { s = 1 - s; u = 1 - u; }
      const p = t.a.clone().addScaledVector(v1.subVectors(t.b, t.a), s).addScaledVector(v2.subVectors(t.c, t.a), u);
      out.push({ x: p.x, y: p.y + 0.01, z: p.z, yaw: rnd() * 6.28 });
    }
  }
  // the plaza: a few on the paving between the tower and the streets (14 m half size), on the far side from the crane mast
  const g = settings.quality === 'low' ? 5 : 9, a0 = 0.5 + rnd() * 0.6;
  for (let k = 0; k < g; k++) { const a = a0 + (rnd() - 0.5) * 0.7, d = 10.5 + rnd() * 2.6; out.push({ x: Math.cos(a) * d, y: 0.07, z: Math.sin(a) * d, yaw: rnd() * 6.28 }); }
  return out;
}

function makePigeons(): void {
  pigeons = findPerches().map((perch) => ({ perch, state: 'sit', t: 0, dur: 0, loopC: new THREE.Vector3(), loopR: 10, loopA: 0, loopW: 1, p0: new THREE.Vector3(), p1: new THREE.Vector3(), c0: new THREE.Vector3(), c1: new THREE.Vector3(), ph: rnd() * 6.28, idle: rnd() * 4, peck: 0, look: 0, yaw: perch.yaw, calm: 0 } as Pigeon));
}

// distance from a point to the jib segment
function nearCrane(p: Perch): boolean {
  const dh = Math.hypot(p.x - crane.hook.x, p.y - crane.hook.y, p.z - crane.hook.z);
  if (dh < 13) return true;
  const L = v1.subVectors(crane.jib1, crane.jib0), t = Math.max(0, Math.min(1, v2.set(p.x, p.y, p.z).sub(crane.jib0).dot(L) / L.lengthSq()));
  return v2.copy(crane.jib0).addScaledVector(L, t).distanceTo(o3.position.set(p.x, p.y, p.z)) < 8;
}

const bez = (o: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, t: number): THREE.Vector3 => {
  const u = 1 - t; return o.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
};

function takeOff(q: Pigeon): void {
  const P = q.perch; q.state = 'up'; q.t = 0; q.dur = 1.6 + rnd() * 0.6;
  // loop over the roofs, away from the crane: its centre 10-16 m from the perch, 8-14 m higher
  const ax = P.x - crane.hook.x, az = P.z - crane.hook.z, al = Math.hypot(ax, az) || 1, a = Math.atan2(az / al, ax / al) + (rnd() - 0.5) * 1.2;
  q.loopR = 9 + rnd() * 6; q.loopW = (rnd() < 0.5 ? 1 : -1) * (10 + rnd() * 2) / q.loopR;
  q.loopC.set(P.x + Math.cos(a) * 12, Math.max(P.y + 9 + rnd() * 5, 16), P.z + Math.sin(a) * 12);
  q.loopA = Math.atan2(P.z - q.loopC.z, P.x - q.loopC.x) + q.loopW * 0.4;
  q.p0.set(P.x, P.y, P.z); q.c0.set(P.x, P.y + 2.5, P.z);
  q.p1.set(q.loopC.x + Math.cos(q.loopA) * q.loopR, q.loopC.y, q.loopC.z + Math.sin(q.loopA) * q.loopR);
  q.c1.set(q.p1.x - Math.sin(q.loopA) * Math.sign(q.loopW) * 5, q.p1.y - 2, q.p1.z + Math.cos(q.loopA) * Math.sign(q.loopW) * 5);
}

function avoid(p: THREE.Vector3, cam: THREE.Vector3, keep: number): void {
  v1.subVectors(p, cam); const d = v1.length();
  if (d < keep) p.copy(cam).addScaledVector(d > 1e-3 ? v1.divideScalar(d) : v1.set(0, 1, 0), keep);
  const tx = p.x - crane.tower.x, tz = p.z - crane.tower.y, th = Math.hypot(tx, tz);
  if (th < TOWER_KEEP && p.y > 1) { const k = TOWER_KEEP / Math.max(th, 1e-3); p.x = crane.tower.x + tx * k; p.z = crane.tower.y + tz * k; }
}

const prev = new Map<object, THREE.Vector3>();
const counts: Record<string, number> = {};
function put(name: string, p: THREE.Vector3, yaw: number, pitch: number, roll: number, s: number, m0: number, m1: number): void {
  const im = ims[name]; if (!im) return;
  const i = counts[name] = (counts[name] ?? 0); if (i >= im.instanceMatrix.count) return;
  o3.position.copy(p); o3.rotation.set(pitch, yaw, roll, 'YXZ'); o3.scale.setScalar(s); o3.updateMatrix();
  im.setMatrixAt(i, o3.matrix);
  im.morph.setXY(i, m0, m1);
  counts[name] = i + 1;
}

/** Per frame (js/world.ts). `night` 0..1: swifts and most flocks go to roost after dusk. */
export function updateBirds(dt: number, clock: number, sc: THREE.Scene, cam: THREE.Camera, night: number): void {
  if (!root) load(sc);
  if (!ready || failed) return;
  if (!flocks.length) makeFlocks();
  if (perchDirty) { perchDirty = false; prev.clear(); makePigeons(); }
  for (const k in counts) counts[k] = 0;
  const cp = cam.position, day = night < 0.6;
  // flocks: the centre runs a loop (an ellipse; swifts a figure of eight) around a home point, the members keep loose offsets
  for (const f of flocks) {
    if (!day && f.sp !== 'crow') continue;
    f.t += dt;
    const S = SPEC[f.sp], a = f.ph + f.t * f.w;
    const cx = f.hx + Math.cos(a) * f.rx, cz = f.hz + Math.sin(a * f.fig) * f.rz, cy = f.y + Math.sin(a * 0.7 + f.ph) * f.dy;
    const vx = -Math.sin(a) * f.rx, vz = Math.cos(a * f.fig) * f.rz * f.fig, vy = Math.cos(a * 0.7 + f.ph) * f.dy * 0.7, sp = Math.hypot(vx, vz);
    const yaw = Math.atan2(vx * Math.sign(f.w), vz * Math.sign(f.w)), pitch = -Math.atan2(vy, sp) * 0.6;
    const ax2 = -Math.cos(a) * f.rx, az2 = -Math.sin(a * f.fig) * f.rz * f.fig * f.fig, turn = (vx * az2 - vz * ax2) / Math.max(1e-3, sp * sp);
    const roll = Math.max(-0.7, Math.min(0.7, -turn * 0.9));
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    f.members.forEach((o, i) => {
      const wob = f.t * 0.6 + i * 1.7;
      v2.set(cx + o.x * cyw + o.z * syw + Math.sin(wob) * 0.8, cy + o.y + Math.sin(wob * 1.3) * 0.5, cz - o.x * syw + o.z * cyw + Math.cos(wob * 0.8) * 0.8);
      avoid(v2, cp, Math.max(CAM_KEEP, S.minCam));
      // flap: pigeons flap with short glides, swifts flicker and glide, crows row slowly with long glides
      f.flap[i] += dt * S.hz * 6.283 * (0.9 + 0.2 * Math.sin(i));
      const g = f.sp === 'pigeon' ? 0.5 + 0.5 * Math.sin(f.t * 0.5 + i) : f.sp === 'swift' ? 0.5 + 0.5 * Math.sin(f.t * 0.9 + i * 2.1) : 0.5 + 0.5 * Math.sin(f.t * 0.3 + i);
      const amp = g > 0.35 ? 1 : g / 0.35, s = Math.sin(f.flap[i]) * amp;
      const lod = v2.distanceTo(cp) > S.lodD ? 1 : 0;
      put(`${f.sp}_fly${lod}`, v2, yaw, pitch, roll, S.scale, Math.max(0, s), Math.max(0, -s) + (1 - amp) * 0.0);
    });
  }
  // pigeons on perches: idle (peck, look about), take off near the crane, circle, land
  for (const q of pigeons) {
    const P = q.perch;
    if (q.state === 'sit') {
      q.calm -= dt;
      if (q.calm <= 0 && (nearCrane(P) || rnd() < dt / 120)) { takeOff(q); }      // the crane comes near, or now and then for no reason
      else {
        q.idle -= dt;
        if (q.idle <= 0) { q.idle = 1 + rnd() * 4; const r = rnd(); q.peck = P.y < 1 && r < 0.6 ? 1 : 0; q.look = r > 0.7 ? (rnd() - 0.5) * 2 : 0; if (r < 0.15) q.yaw += (rnd() - 0.5) * 1.2; }
        q.ph += dt * (q.peck ? 7 : 0);
        const pk = q.peck ? 0.5 + 0.5 * Math.sin(q.ph) : 0;
        v2.set(P.x, P.y, P.z);
        put('pigeon_sit0', v2, q.yaw, 0, 0, 1.0, pk, q.look);           // a negative `look` turns the head the other way
        continue;
      }
    }
    q.t += dt;
    const prevP = (prev.get(q) ?? prev.set(q, new THREE.Vector3(P.x, P.y, P.z)).get(q)!);
    let flap = 1, up = 0;
    if (q.state === 'up') {
      bez(v2, q.p0, q.c0, q.c1, q.p1, Math.min(1, q.t / q.dur));
      if (q.t >= q.dur) { q.state = 'loop'; q.t = 0; q.dur = 6 + rnd() * 8; }
    } else if (q.state === 'loop') {
      q.loopA += q.loopW * dt;
      v2.set(q.loopC.x + Math.cos(q.loopA) * q.loopR, q.loopC.y + Math.sin(q.t * 0.8) * 1.2, q.loopC.z + Math.sin(q.loopA) * q.loopR);
      flap = 0.5 + 0.5 * Math.sin(q.t * 0.7 + q.ph) > 0.4 ? 1 : 0;
      if (q.t >= q.dur && !nearCrane(P)) {                  // back to the perch: glide in from the loop, wings raised
        q.state = 'down'; q.t = 0; q.dur = 2.4 + rnd() * 0.8; q.p0.copy(v2);
        q.c0.set(v2.x - Math.sin(q.loopA) * Math.sign(q.loopW) * 6, v2.y, v2.z + Math.cos(q.loopA) * Math.sign(q.loopW) * 6);
        q.p1.set(P.x, P.y, P.z); q.c1.set(P.x - Math.sin(q.yaw) * 3, P.y + 1.5, P.z - Math.cos(q.yaw) * 3);
      }
    } else {
      const k = Math.min(1, q.t / q.dur); bez(v2, q.p0, q.c0, q.c1, q.p1, k * (2 - k) * 0.5 + k * 0.5);
      flap = k > 0.8 ? 1 : 0.2; up = k > 0.8 ? 0 : 0.45;
      if (q.t >= q.dur) { q.state = 'sit'; q.calm = 4; q.yaw = Math.atan2(v2.x - prevP.x, v2.z - prevP.z); prevP.copy(v2); continue; }
    }
    if (q.state !== 'down' || q.t < q.dur * 0.85) avoid(v2, cp, CAM_KEEP);
    v1.subVectors(v2, prevP); const hs = Math.hypot(v1.x, v1.z);
    const yaw = hs > 1e-4 ? Math.atan2(v1.x, v1.z) : q.yaw, pitch = -Math.atan2(v1.y, Math.max(hs, 1e-4)) * 0.5;
    const dyaw = Math.atan2(Math.sin(yaw - q.yaw), Math.cos(yaw - q.yaw)); q.yaw = yaw;
    prevP.copy(v2);
    q.ph += dt * SPEC.pigeon.hz * 6.283;
    const s = Math.sin(q.ph) * flap;
    const lod = v2.distanceTo(cp) > SPEC.pigeon.lodD ? 1 : 0;
    put(`pigeon_fly${lod}`, v2, yaw, pitch, Math.max(-0.6, Math.min(0.6, -dyaw / Math.max(dt, 1e-3) * 0.25)), SPEC.pigeon.scale, Math.max(0, s) + up, Math.max(0, -s));
  }
  for (const name in ims) {
    const im = ims[name]; im.count = counts[name] ?? 0;
    if (im.count) { im.instanceMatrix.needsUpdate = true; im.morph.needsUpdate = true; }
  }
  void clock;
}

/** Debug: counts per mesh and the pigeons' states. */
export function birdStats(): { ready: boolean; meshes: Record<string, number>; perched: number; flying: number } {
  return { ready, meshes: Object.fromEntries(Object.entries(ims).map(([k, v]) => [k, v.count])), perched: pigeons.filter((q) => q.state === 'sit').length, flying: pigeons.filter((q) => q.state !== 'sit').length };
}
/** Debug: where the pigeons sit and where the flock members are this frame (tests/browser/bird-poses.mjs). */
export function birdSpots(): { perches: number[][]; flying: number[][] } {
  const fly: number[][] = [];
  for (const name in ims) if (name.includes('fly')) { const im = ims[name], m = new THREE.Matrix4(), p = new THREE.Vector3(); for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); p.setFromMatrixPosition(m); fly.push([p.x, p.y, p.z]); } }
  return { perches: pigeons.filter((q) => q.state === 'sit').map((q) => [q.perch.x, q.perch.y, q.perch.z, q.perch.y < 1 ? 0 : 1]), flying: fly };
}
(globalThis as unknown as { __birds: unknown }).__birds = { stats: birdStats, spots: birdSpots };
