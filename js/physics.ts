// Game physics: wind, crane swing, tower sway and the stability rule.
// Everything is deterministic: the same time, height and player input always give the same result.
import { CFG, phaseAt } from './config.js';
import type { Block, BlockKind, CollapseInfo, Difficulty, FlyResult, Hook, Pose, StaticPose, TowerFloor, Vec2, Wind, WeatherCycle } from './types.js';

// Smooth, seeded gusts, so the player can read the trend and wait for a lull.
export function gustAt(t: number): number { return 0.5 * Math.sin(0.37 * t) + 0.3 * Math.sin(0.91 * t + 1.3) + 0.2 * Math.sin(2.1 * t + 0.4); }

export function windAt(t: number, n: number, diff: Difficulty, ph: WeatherCycle = phaseAt(n), scale = 1): Wind {
  const speed = Math.max(0, ph.base + ph.gust * gustAt(t)) * ph.mult * diff.wind * scale;
  const a = 1.2 * Math.sin(0.031 * t) + 0.4 * Math.sin(0.13 * t + 2);
  return { x: speed * Math.cos(a), z: speed * Math.sin(a), speed, angle: a, trend: gustAt(t + 1.5) - gustAt(t) };
}

// The hook swings as a pendulum. It gets wider and faster with height; from floor 15 it also swings in depth.
export function hookAt(t: number, n: number, wind: Wind, m: number, bx: number, bz: number, diff: Difficulty): Hook {
  const k = Math.min(1, n / 60);
  const Ax = CFG.W * (0.55 + 0.95 * k) * diff.swingAmp;
  const T = (2.4 - 1.1 * k) / diff.swingSpeed, w = 2 * Math.PI / T;
  const zA = n >= 15 ? CFG.W * (0.15 + 0.35 * Math.min(1, (n - 15) / 40)) * diff.swingAmp : 0, wz = w / 1.37;
  const sh = CFG.windHook / m;
  return {
    x: bx + Ax * Math.sin(w * t) + sh * wind.x, z: bz + zA * Math.sin(wz * t + 0.5) + sh * wind.z,
    vx: Ax * w * Math.cos(w * t), vz: zA * wz * Math.cos(wz * t + 0.5),
  };
}

// Stability: for each support level k, the centre of mass of everything above k must stay over floor k.
// r = offset / half-width. r > 1 means that part of the tower tips over.
export function ratios(n: number, poseFn: (i: number) => StaticPose, massFn: (i: number) => number, base: StaticPose): Ratios {
  let M = 0, SX = 0, SZ = 0, best = 0, bk = -1, dir: Vec2 = { x: 0, z: 0 };
  for (let i = n - 1; i >= 0; i--) {
    const p = poseFn(i), m = massFn(i);
    M += m; SX += m * p.x; SZ += m * p.z;
    const s = i > 0 ? poseFn(i - 1) : base;
    const dx = SX / M - s.x, dz = SZ / M - s.z;
    const r = Math.max(Math.abs(dx), Math.abs(dz)) / (CFG.W / 2);
    if (r > best) { best = r; bk = i - 1; dir = { x: dx, z: dz }; }
  }
  return { r: best, k: bk, dir };
}

export interface Ratios { r: number; k: number; dir: Vec2 }

// Floors are stored as static offsets; the sway is a damped spring s(t) applied with a (y/H)^2 mode shape.
export class Tower {
  bx: number; bz: number; diff: Difficulty; f: TowerFloor[]; s: Vec2; v: Vec2;
  wx: WeatherCycle | null; calm: number; anchor: number; quakeT: number; quakePh: number; unstableT: number;
  dyn: Ratios; staticR = 0;

  constructor(bx: number, bz: number, diff: Difficulty) {
    this.bx = bx; this.bz = bz; this.diff = diff; this.f = [];
    this.s = { x: 0, z: 0 }; this.v = { x: 0, z: 0 };
    this.wx = null; this.calm = 0; this.anchor = 0; this.quakeT = 0; this.quakePh = 0; this.unstableT = 0;
    this.dyn = { r: 0, k: -1, dir: { x: 0, z: 0 } };
  }
  get n(): number { return this.f.length; }
  topY(): number { return CFG.FOUND_H + CFG.H * this.f.length; }
  yc(i: number): number { return CFG.FOUND_H + CFG.H * (i + 0.5); }
  shape(i: number): number { const h = Math.max(CFG.H, CFG.H * this.n); const yr = CFG.H * (i + 0.5); return (yr / h) ** 2; }
  pose(i: number): Pose {
    if (i < 0) return { x: this.bx, z: this.bz, vx: 0, vz: 0 };
    const f = this.f[i], sh = this.shape(i);
    return { x: this.bx + f.x + this.s.x * sh, z: this.bz + f.z + this.s.z * sh, vx: this.v.x * sh, vz: this.v.z * sh };
  }
  top(): Pose { return this.pose(this.n - 1); }
  staticRatios(): Ratios { return ratios(this.n, (i) => ({ x: this.bx + this.f[i].x, z: this.bz + this.f[i].z }), (i) => this.f[i].m, { x: this.bx, z: this.bz }); }
  dynRatios(): Ratios { return ratios(this.n, (i) => this.pose(i), (i) => this.f[i].m, { x: this.bx, z: this.bz }); }
  kick(vx: number, vz: number): void { this.v.x += vx; this.v.z += vz; }
  quake(): void { this.quakeT = CFG.quakeTime; }

  step(dt: number, wind: Wind): void {
    const n = this.n; if (!n) return;
    const st = this.staticRatios(); this.staticR = st.r;
    const w0 = 2 * Math.PI / (1.6 + n * 0.035);
    const w = w0 * Math.max(0.4, 1 - 0.6 * Math.min(1, st.r));   // a crooked tower is softer
    let M = 0, cx = 0, cz = 0;
    for (const f of this.f) { M += f.m; cx += f.m * f.x; cz += f.m * f.z; }
    cx /= M; cz /= M;
    const pd = CFG.pDelta * n / 30, hf = n / 50, ws = CFG.windSway * this.diff.sway;
    let eqx = pd * cx, eqz = pd * cz, zeta = CFG.swayZeta;
    if (this.calm > 0) { this.calm -= dt; zeta = 0.6; }
    else { eqx += ws * wind.x * wind.speed * hf; eqz += ws * wind.z * wind.speed * hf; }
    if (this.anchor > 0) { this.anchor -= dt; this.v.x = 0; this.v.z = 0; return; }
    let ax = -w * w * (this.s.x - eqx) - 2 * zeta * w * this.v.x;
    let az = -w * w * (this.s.z - eqz) - 2 * zeta * w * this.v.z;
    if (this.quakeT > 0) {   // resonant shaking: a straight tower rides it out, a crooked one may not
      this.quakeT -= dt; this.quakePh += w * dt;
      ax += CFG.quakeAcc * w * Math.sin(this.quakePh);
      az += CFG.quakeAcc * 0.6 * w * Math.sin(this.quakePh * 1.07 + 1);
    }
    this.v.x += ax * dt; this.v.z += az * dt;
    this.s.x += this.v.x * dt; this.s.z += this.v.z * dt;
  }

  // Returns the floors that fall when the weight above some floor stays past its edge for collapseDelay.
  checkCollapse(dt: number): CollapseInfo | null {
    if (!this.n) return null;
    this.dyn = this.dynRatios();
    if (this.dyn.r <= 1) { this.unstableT = 0; return null; }
    this.unstableT += dt;
    if (this.unstableT <= CFG.collapseDelay) return null;
    this.unstableT = 0;
    const k = this.dyn.k, dir = this.dyn.dir, items: CollapseInfo['items'] = [];
    const len = Math.hypot(dir.x, dir.z) || 1;
    for (let i = k + 1; i < this.n; i++) {
      const p = this.pose(i), f = this.f[i], push = 1 + 0.15 * (i - k);
      items.push({
        index: i, type: f.type, p: { x: p.x, y: this.yc(i), z: p.z },
        v: { x: p.vx + dir.x / len * push, y: 0, z: p.vz + dir.z / len * push },
        av: { x: dir.z / len * 2, y: ((i % 3) - 1) * 0.8, z: -dir.x / len * 2 },
      });
    }
    this.f.splice(k + 1);
    return { from: k + 1, count: items.length, items };
  }

  release(b: Block): void { b.vx *= CFG.inherit; b.vz *= CFG.inherit; }

  // Ballistic flight with wind drift. On contact: bounce, slide on wet or icy roofs, or report a miss.
  fly(b: Block, dt: number, wind: Wind): FlyResult | null {
    b.vy -= CFG.G * dt;
    b.vx += CFG.windDrift * wind.x / b.m * dt; b.vz += CFG.windDrift * wind.z / b.m * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    const ts = this.topY(), bottom = b.y - CFG.H / 2;
    if (!(b.vy < 0 && bottom <= ts && bottom > ts - CFG.H * 0.5)) return null;
    const top = this.top(), dx = b.x - top.x, dz = b.z - top.z;
    const dist = Math.max(Math.abs(dx), Math.abs(dz));
    if (dist >= CFG.W * 0.98) return { type: 'miss', how: 'wide' };
    if (b.bouncy && !b.bounced && dist <= CFG.W * 0.5) {
      b.bounced = true; b.y = ts + CFG.H / 2; b.vy = -0.45 * b.vy; b.vx *= 0.5; b.vz *= 0.5;
      return { type: 'bounce' };
    }
    const vrx = b.vx - top.vx, vrz = b.vz - top.vz, vr = Math.hypot(vrx, vrz);
    let sx = 0, sz = 0;
    if (vr > 0.01) {
      const sl = Math.min(CFG.slideCap * CFG.W, CFG.slideK * this.diff.slide * vr * vr / (this.wx || phaseAt(this.n)).mu);
      sx = vrx / vr * sl; sz = vrz / vr * sl;
    }
    return { type: 'land', dx: dx + sx, dz: dz + sz, vrx, vrz };
  }

  place(b: Block, dx: number, dz: number, perfect: boolean): void {
    const prev = this.n ? this.f[this.n - 1] : { x: 0, z: 0 };
    if (perfect) { dx = 0; dz = 0; }
    this.f.push({ x: prev.x + dx, z: prev.z + dz, m: b.m, type: b.type });
    if (perfect) { this.v.x *= CFG.perfectDamp; this.v.z *= CFG.perfectDamp; }
    else { const k = CFG.swayImpulse * this.diff.sway * b.m * (1 + this.n / 25); this.kick(k * b.lastVrx, k * b.lastVrz); }
    if (b.golden) this.calm = CFG.goldenCalm;
  }

  // Tilt of floor i caused by the sway (the slope of the (y/H)^2 mode shape), for drawing.
  slope(i: number): number { const h = Math.max(CFG.H, CFG.H * this.n); return 2 * CFG.H * (i + 0.5) / (h * h); }
}
