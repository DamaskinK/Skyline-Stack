// Game rules: spawning, dropping, scoring, lives and weather events for an Endless run.
// The game never touches the DOM; it reports to `this.ui`, which main.js connects to the interface.
import * as THREE from 'three';
import { CFG, DIFFICULTY, BTYPES, ENDLESS_COLORS, PHASE_LEN, phaseAt, specialFor } from './config.js';
import { windAt, hookAt, Tower } from './physics.js';
import { scene } from './world.js';
import { makeBlockMesh, makeFoundation, makeRoof } from './entities.js';
import { FX, People, strikeBolt } from './fx.js';
import { Sfx } from './audio.js';
import { settings, loadScores } from './settings.js';

export class Game {
  constructor() {
    this.state = 'menu'; this.mode = 'endless'; this.paused = false;
    this.objects = []; this.debris = []; this.keys = {}; this.camMode = 0;
    this.wind = { x: 0, z: 0, speed: 0, angle: 0, trend: 0 };
    this.flashV = 0; this.shake = 0; this.t = 0; this.focus = 1; this.focusIdle = 9;
    this.lives = 3; this.combo = 0; this.anchors = 0; this.score = 0; this.pop = 0;
    this.diffKey = settings.difficulty; this.diff = DIFFICULTY[this.diffKey];
    this.ui = null; this.camera = null;
  }

  start(mode = this.mode, diffKey = settings.difficulty) {
    this.clear();
    this.mode = mode; this.diffKey = diffKey; this.diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    this.t = 0; this.score = 0; this.pop = 0; this.focus = 1; this.focusIdle = 9; this.bestHeight = 0; this.perfects = 0;
    this.prevBest = (loadScores()[mode] || [])[0]?.score || 0;
    this.state = 'play'; this.paused = false; this.saved = false; this.lastPhase = 0; this.drops = 0;
    People.setWalkers(9);
    this.beginTower(0, 0);
  }
  clear() {
    if (this.tower) for (const f of this.tower.f) scene.remove(f.mesh);
    for (const o of this.objects) scene.remove(o);
    for (const d of this.debris) scene.remove(d.mesh);
    if (this.block) scene.remove(this.block.mesh);
    People.clear();
    this.objects = []; this.debris = []; this.block = null; this.tower = null;
  }
  beginTower(bx, bz) {
    this.tower = new Tower(bx, bz, this.diff);
    this.objects.push(makeFoundation(bx, bz));
    this.lives = this.diff.lives; this.combo = 0; this.goldenNext = false;
    this.anchors = CFG.features.anchor ? 1 : 0;
    this.spawnT = 0.4; this.block = null; this.ltT = 0; this.ltWarned = false;
    this.craneY = CFG.FOUND_H; this.lastPhase = 0;
    this.state = 'play';
    this.ui.showHud();
  }
  spawn() {
    const n = this.tower.n;
    let type = specialFor(n + 1);
    if (this.goldenNext && CFG.features.golden) { type = 'golden'; this.goldenNext = false; }
    const bt = BTYPES[type];
    const color = type !== 'normal' ? bt.color : ENDLESS_COLORS[Math.floor(n / 5) % ENDLESS_COLORS.length];
    const mesh = makeBlockMesh(color, bt.golden, n % 3);
    this.block = { state: 'hang', type, m: bt.m, bouncy: !!bt.bouncy, golden: !!bt.golden, mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, lastVrx: 0, lastVrz: 0, appear: 0 };
    this.hangBlock();
  }
  hangBlock() {
    const b = this.block, T = this.tower;
    this.hook = hookAt(this.t, T.n, this.wind, b.m, T.bx, T.bz, this.diff);
    b.x = this.hook.x; b.y = Math.max(this.craneY, T.topY()) + CFG.dropGap + CFG.H / 2; b.z = this.hook.z;
  }
  drop() {
    if (this.state !== 'play' || this.paused || !this.block || this.block.state !== 'hang') return;
    const b = this.block; b.state = 'fall'; b.vx = this.hook.vx; b.vz = this.hook.vz; b.vy = 0;
    this.tower.release(b); this.drops++; Sfx.drop();
  }
  useAnchor() {
    if (this.state !== 'play' || this.paused || !this.tower || this.anchors <= 0 || this.tower.anchor > 0) return;
    this.anchors--; this.tower.anchor = CFG.anchorTime; this.ui.popup('ANCHOR', '#52d9ff'); Sfx.anchor();
  }
  focusActive() { return CFG.features.focus && this.keys.focus && this.focus > 0 && this.state === 'play' && !this.paused; }

  // Advance the slow-mo meter by real time and return how much game time passes.
  timeScale(rdt) {
    const f = this.focusActive();
    if (f) { this.focus = Math.max(0, this.focus - CFG.focusDrain * rdt); this.focusIdle = 0; }
    else { this.focusIdle += rdt; if (this.focusIdle > CFG.focusRegenDelay) this.focus = Math.min(1, this.focus + CFG.focusRegen * rdt); }
    return f ? CFG.focusScale : 1;
  }

  step(dt) {
    const T = this.tower; if (!T) { this.stepDebris(dt); return; }
    this.t += dt;
    const n = T.n, ph = phaseAt(n);
    this.wind = windAt(this.t, n, this.diff);
    // lightning: telegraphed by a dim flash, then a fixed kick in the wind direction
    if (ph.lightning && CFG.features.lightning) {
      this.ltT += dt;
      if (!this.ltWarned && this.ltT > CFG.lightningEvery - CFG.lightningWarn) { this.ltWarned = true; this.flashV = Math.max(this.flashV, 0.25); this.ui.banner('Lightning incoming', 1.5); Sfx.rumble(); }
      if (this.ltT >= CFG.lightningEvery) {
        this.ltT = 0; this.ltWarned = false; this.flashV = 1;
        const s = this.wind.speed || 1; T.kick(CFG.lightningKick * this.wind.x / s, CFG.lightningKick * this.wind.z / s);
        const top = T.n ? T.top() : { x: T.bx, z: T.bz };
        strikeBolt(top.x, T.topY(), top.z); Sfx.thunder();
      }
    } else { this.ltT = 0; this.ltWarned = false; }
    T.step(dt, this.wind);
    const col = T.checkCollapse(dt);
    if (col) this.onCollapse(col);
    if (this.state !== 'play' || this.tower !== T) { this.stepDebris(dt); return; }

    const m = this.block ? this.block.m : 1;
    this.craneY += (T.topY() - this.craneY) * Math.min(1, dt * 3);
    this.hook = hookAt(this.t, T.n, this.wind, m, T.bx, T.bz, this.diff);
    const b = this.block;
    if (!b) { this.spawnT -= dt; if (this.spawnT <= 0) this.spawn(); }
    else if (b.state === 'hang') this.hangBlock();
    else if (b.state === 'fall') {
      let ev = T.fly(b, dt, this.wind);
      if (!ev && b.y < -3) ev = { type: 'miss', how: 'lost' };
      if (ev) this.onBlockEvent(ev);
    }
    this.stepDebris(dt);
  }
  stepDebris(dt) {
    for (const d of this.debris) {
      d.t += dt;
      d.v.y -= CFG.G * dt;
      d.p.x += d.v.x * dt; d.p.y += d.v.y * dt; d.p.z += d.v.z * dt;
      d.mesh.rotation.x += d.av.x * dt; d.mesh.rotation.y += d.av.y * dt; d.mesh.rotation.z += d.av.z * dt;
      if (d.p.y < CFG.H / 2) {
        if (!d.landed) { d.landed = true; FX.dust(d.p, 1.2); Sfx.thud(); }
        d.p.y = CFG.H / 2; d.v.y *= -0.2; d.v.x *= 0.7; d.v.z *= 0.7; d.av.x *= 0.5; d.av.y *= 0.5; d.av.z *= 0.5;
      }
    }
    this.debris = this.debris.filter((d) => { if (d.t < 9) return true; scene.remove(d.mesh); return false; });
  }
  addDebris(it) {
    it.mesh.position.set(it.p.x, it.p.y, it.p.z); it.mesh.userData.warn.visible = false;
    this.debris.push({ mesh: it.mesh, p: it.mesh.position, v: it.v, av: it.av, t: 0 });
  }
  onBlockEvent(ev) {
    const b = this.block, T = this.tower;
    if (ev.type === 'bounce') { this.ui.popup('BOING', '#ff5fa2', true); Sfx.bounce(); FX.dust({ x: b.x, y: T.topY(), z: b.z }, 0.5); return; }
    if (ev.type === 'land') {
      const dist = Math.max(Math.abs(ev.dx), Math.abs(ev.dz)) / CFG.W;
      b.lastVrx = ev.vrx; b.lastVrz = ev.vrz;
      if (dist > CFG.risky) {   // too far over the edge: the block tips off
        const top = T.top(), sx = Math.sign(ev.dx), sz = Math.sign(ev.dz);
        this.addDebris({ mesh: b.mesh, p: { x: top.x + ev.dx, y: T.topY() + CFG.H / 2, z: top.z + ev.dz }, v: { x: sx * 1.5, y: 0, z: sz * 1.5 }, av: { x: sz * 3, y: 0, z: -sx * 3 } });
        this.block = null; this.spawnT = 0.6; this.combo = 0;
        Sfx.miss(); this.loseLife('SLIPPED OFF');
        return;
      }
      const perfect = dist <= this.diff.perfect, good = dist <= this.diff.good;
      T.place(b, ev.dx, ev.dz, perfect);
      this.block = null; this.spawnT = 0.35;
      this.scoreLanding(perfect, good, b);
      return;
    }
    if (ev.type === 'miss') {
      this.addDebris({ mesh: b.mesh, p: { x: b.x, y: b.y, z: b.z }, v: { x: b.vx, y: b.vy, z: b.vz }, av: { x: 1, y: 0.5, z: -1.5 } });
      this.block = null; this.spawnT = 0.6; this.combo = 0;
      Sfx.miss(); this.loseLife('MISS');
    }
  }
  scoreLanding(perfect, good, b) {
    const T = this.tower, golden = b.golden;
    if (perfect) { this.combo++; this.perfects++; if (CFG.features.focus) this.focus = Math.min(1, this.focus + CFG.focusGain); }
    else this.combo = 0;
    const mult = Math.min(5, 1 + 0.5 * this.combo);
    const gm = golden ? 2 : 1;
    this.score += Math.round((10 + (perfect ? 15 : 0)) * mult * gm * this.diff.score);
    this.pop += Math.round((perfect ? 25 : 10) * mult * gm * this.diff.score);

    const roof = { x: b.mesh.position.x, y: T.topY(), z: b.mesh.position.z };
    FX.dust({ x: roof.x, y: roof.y - CFG.H, z: roof.z }, perfect ? 0.7 : 1);
    Sfx.land(perfect, this.combo);
    People.arrive(b.mesh, perfect ? 4 : good ? 2 : 1, this.camera);
    this.ui.bumpFloor();
    if (perfect) {
      FX.sparks(roof); FX.ring(new THREE.Vector3(roof.x, roof.y + 0.05, roof.z), 0xffd34d);
      this.ui.popup(this.combo > 1 ? `PERFECT ×${this.combo}` : 'PERFECT', '#ffb627');
    } else if (good) this.ui.popup('GOOD', '#5dff9b');
    else { this.ui.popup('RISKY', '#ff4d5e'); this.shake = Math.max(this.shake, 0.25); }
    if (golden) { this.ui.popup('GOLDEN · CALM', '#ffd34d', true); Sfx.golden(); FX.ring(new THREE.Vector3(roof.x, roof.y + 0.05, roof.z), 0xffffff); }
    if (perfect && this.combo > 0 && this.combo % CFG.goldenEvery === 0) { this.goldenNext = true; this.ui.banner('Golden block next', 2); }
    const n = T.n, record = n > this.bestHeight;
    this.bestHeight = Math.max(this.bestHeight, n);
    if (CFG.features.anchor && record && n > 0 && n % CFG.anchorEvery === 0) { this.anchors++; this.ui.banner('+1 anchor', 2); }
    if (n % PHASE_LEN === 0 && n > 0 && Math.floor(n / PHASE_LEN) !== this.lastPhase) { this.lastPhase = Math.floor(n / PHASE_LEN); this.ui.weather(phaseAt(n)); Sfx.whoosh(); }
    if (CFG.features.quake) {
      if (n % CFG.quakeEvery === CFG.quakeEvery - 2) this.ui.banner(`Earthquake at floor ${n + 2}`, 3);
      if (n > 0 && n % CFG.quakeEvery === 0) { T.quake(); this.shake = CFG.quakeTime; this.ui.banner('EARTHQUAKE', CFG.quakeTime); Sfx.crash(); }
    }
  }
  onCollapse(col) {
    for (const it of col.items) this.addDebris(it);
    this.combo = 0; this.shake = 0.8; this.flashV = Math.max(this.flashV, 0.3);
    if (col.items[0]) FX.dust(col.items[0].p, 2);
    Sfx.crash();
    this.ui.popup(`COLLAPSE −${col.count}`, '#ff4d5e');
    if (CFG.collapseEndsGame) { this.lives = 0; this.gameOver(); return; }
    this.loseLife(null);
  }
  loseLife(msg) {
    if (msg) this.ui.popup(msg, '#ff4d5e');
    this.lives--;
    if (this.lives <= 0) this.gameOver();
  }
  gameOver() {
    if (this.state === 'over' || this.state === 'menu') return;
    this.state = 'over';
    const floors = Math.max(this.bestHeight, this.tower ? this.tower.n : 0);
    this.lastResult = { score: this.score, floors, pop: this.pop, perfects: this.perfects, diff: this.diffKey };
    Sfx.over();
    setTimeout(() => { if (this.state === 'over') this.ui.gameOver(this.lastResult, this.lastResult.score > this.prevBest && this.lastResult.score > 0); }, 1400);
  }
}

// Tower shown behind the main menu.
let demo = [];
export function buildDemo() {
  clearDemo();
  demo.push(makeFoundation(0, 0));
  for (let i = 0; i < 18; i++) {
    const m = makeBlockMesh(ENDLESS_COLORS[Math.floor(i / 5) % ENDLESS_COLORS.length], i === 9, i % 3);
    m.position.set(Math.sin(i * 1.7) * 0.25, CFG.FOUND_H + CFG.H * (i + 0.5), Math.cos(i * 1.3) * 0.2); demo.push(m);
  }
  demo.push(makeRoof(new THREE.Vector3(0, CFG.FOUND_H + CFG.H * 18, 0)));
}
export function clearDemo() { for (const o of demo) scene.remove(o); demo = []; }
