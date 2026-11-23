// Simulation core: the rules and physics of one run. No Three.js, DOM or audio, so it runs in Node for tests.
// Input: drop(), useAnchor(), timeScale(realDt, slowMoHeld). Advance with step(dt) at CFG.DT.
// Output: readable state on this object, and events collected with drain(). Same input, same events.
import { CFG, BTYPES, specialFor } from '../config.js';
import { weatherAt, nextWeather } from './weather.js';
import { windAt, hookAt, Tower } from '../physics.js';
import { starsFor } from './stars.js';
import { applyTrait } from '../building-types.js';

export const CALM_WIND = Object.freeze({ x: 0, z: 0, speed: 0, angle: 0, trend: 0 });

export class Run {
  // `level` is a definition from js/levels.js: reaching level.target ends the run with stars, unless `endless` is set
  // (Endless on a city: no target, the city's weather segments loop with growing strength). No level at all = plain
  // Endless with the old global weather cycle and its quake every CFG.quakeEvery floors.
  // The level's `events` list decides which events can happen; core emits no other.
  constructor(diff, { bx = 0, bz = 0, level = null, endless = false, buildingType = null, windScale = 1 } = {}) {
    // buildingType (Endless picks one) overrides the level's own; the trait multipliers are folded into the difficulty
    this.buildingType = buildingType || (level && level.buildingType) || null;
    this.diff = applyTrait(diff, this.buildingType); this.level = level; this.windScale = windScale; this.endless = !!(level && endless); this.landings = 0;
    this.allowedEvents = level ? level.events || [] : ['lightning', 'quake'];
    this.wx = weatherAt(level, 0, this.endless);
    this.tower = new Tower(bx, bz, this.diff);
    this.t = 0; this.events = []; this.over = false; this.result = null;
    this.wind = CALM_WIND; this.hook = null; this.block = null;
    this.lives = this.diff.lives; this.combo = 0; this.goldenNext = false;
    this.anchors = CFG.features.anchor ? 1 : 0;
    this.score = 0; this.pop = 0; this.perfects = 0; this.bestHeight = 0; this.drops = 0;
    this.focus = 1; this.focusIdle = 9;
    this.spawnT = 0.4; this.ltT = 0; this.ltWarned = false;
    this.craneY = CFG.FOUND_H;
  }

  hasEvent(kind) { return this.allowedEvents.includes(kind); }
  // The next weather change from the current floor ({ at, left, wx }) or null.
  nextWeather() { return nextWeather(this.level, this.tower.n, this.endless); }

  emit(type, data = {}) { this.events.push({ type, t: this.t, ...data }); }
  drain() { const e = this.events; this.events = []; return e; }

  // Advance the slow-mo meter by real time and return how much game time passes.
  timeScale(rdt, held) {
    const on = CFG.features.focus && held && this.focus > 0 && !this.over;
    if (on) { this.focus = Math.max(0, this.focus - CFG.focusDrain * rdt); this.focusIdle = 0; }
    else { this.focusIdle += rdt; if (this.focusIdle > CFG.focusRegenDelay) this.focus = Math.min(1, this.focus + CFG.focusRegen * rdt); }
    return on ? CFG.focusScale : 1;
  }

  drop() {
    const b = this.block;
    if (this.over || !b || b.state !== 'hang') return false;
    b.state = 'fall'; b.vx = this.hook.vx; b.vz = this.hook.vz; b.vy = 0;
    this.tower.release(b); this.drops++;
    this.emit('drop');
    return true;
  }

  useAnchor() {
    if (this.over || this.anchors <= 0 || this.tower.anchor > 0) return false;
    this.anchors--; this.tower.anchor = CFG.anchorTime;
    this.emit('anchor');
    return true;
  }

  step(dt) {
    const T = this.tower;
    this.t += dt;
    const n = T.n, ph = weatherAt(this.level, n, this.endless);
    if (ph.seg !== this.wx.seg) this.emit('weather', { floor: n, kind: ph.kind });
    this.wx = ph; T.wx = ph;
    this.wind = windAt(this.t, n, this.diff, ph, this.windScale);
    // lightning and sandstorm gusts: telegraphed by a warning, then a fixed kick in the wind direction
    const strike = CFG.features.lightning && ph.lightning && this.hasEvent('lightning') ? 'lightning'
      : CFG.features.lightning && ph.gustEvent && this.hasEvent('sandstormGust') ? 'gust' : null;
    if (strike) {
      this.ltT += dt;
      if (!this.ltWarned && this.ltT > CFG.lightningEvery - CFG.lightningWarn) { this.ltWarned = true; this.emit(strike === 'gust' ? 'gustWarning' : 'lightningWarning'); }
      if (this.ltT >= CFG.lightningEvery) {
        this.ltT = 0; this.ltWarned = false;
        const s = this.wind.speed || 1; T.kick(CFG.lightningKick * this.wind.x / s, CFG.lightningKick * this.wind.z / s);
        const top = T.n ? T.top() : { x: T.bx, z: T.bz };
        this.emit(strike, { x: top.x, y: T.topY(), z: top.z });
      }
    } else { this.ltT = 0; this.ltWarned = false; }
    T.step(dt, this.wind);
    const col = T.checkCollapse(dt);
    if (col) this.onCollapse(col);
    if (this.over) return;

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
  }

  spawn() {
    const n = this.tower.n;
    let type = specialFor(n + 1);
    if (this.goldenNext && CFG.features.golden) { type = 'golden'; this.goldenNext = false; }
    const bt = BTYPES[type];
    this.block = { state: 'hang', type, m: bt.m * (this.diff.mass || 1), bouncy: !!bt.bouncy, golden: !!bt.golden, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, lastVrx: 0, lastVrz: 0 };
    this.hangBlock();
    this.emit('spawn', { block: type, floor: n });
  }

  hangBlock() {
    const b = this.block, T = this.tower;
    this.hook = hookAt(this.t, T.n, this.wind, b.m, T.bx, T.bz, this.diff);
    b.x = this.hook.x; b.y = Math.max(this.craneY, T.topY()) + CFG.dropGap + CFG.H / 2; b.z = this.hook.z;
  }

  onBlockEvent(ev) {
    const b = this.block, T = this.tower;
    if (ev.type === 'bounce') { this.emit('bounce', { x: b.x, y: T.topY(), z: b.z }); return; }
    if (ev.type === 'land') {
      const offset = Math.max(Math.abs(ev.dx), Math.abs(ev.dz)) / CFG.W;
      b.lastVrx = ev.vrx; b.lastVrz = ev.vrz;
      if (offset > CFG.risky) {   // too far over the edge: the block tips off
        const top = T.top(), sx = Math.sign(ev.dx), sz = Math.sign(ev.dz);
        this.block = null; this.spawnT = 0.6; this.combo = 0;
        this.emit('slip', {
          offset,
          p: { x: top.x + ev.dx, y: T.topY() + CFG.H / 2, z: top.z + ev.dz },
          v: { x: sx * 1.5, y: 0, z: sz * 1.5 }, av: { x: sz * 3, y: 0, z: -sx * 3 },
        });
        this.loseLife('SLIPPED OFF');
        return;
      }
      const perfect = offset <= this.diff.perfect, good = offset <= this.diff.good;
      T.place(b, ev.dx, ev.dz, perfect);
      this.block = null; this.spawnT = 0.35;
      this.scoreLanding(perfect, good, b, offset);
      return;
    }
    if (ev.type === 'miss') {
      this.block = null; this.spawnT = 0.6; this.combo = 0;
      this.emit('miss', { p: { x: b.x, y: b.y, z: b.z }, v: { x: b.vx, y: b.vy, z: b.vz } });
      this.loseLife('MISS');
    }
  }

  scoreLanding(perfect, good, b, offset) {
    const T = this.tower, golden = b.golden;
    if (perfect) { this.combo++; this.perfects++; if (CFG.features.focus) this.focus = Math.min(1, this.focus + CFG.focusGain); }
    else this.combo = 0;
    const mult = Math.min(5, 1 + 0.5 * this.combo), gm = golden ? 2 : 1;
    this.score += Math.round((10 + (perfect ? 15 : 0)) * mult * gm * this.diff.score);
    this.pop += Math.round((perfect ? 25 : 10) * mult * gm * this.diff.score);
    const n = T.n;
    this.landings++;
    this.emit('land', {
      kind: perfect ? 'perfect' : good ? 'good' : 'risky', offset, golden, combo: this.combo,
      floor: n - 1, x: b.x, z: b.z, roofY: T.topY(),
    });
    if (perfect && this.combo > 0 && this.combo % CFG.goldenEvery === 0) { this.goldenNext = true; this.emit('goldenNext'); }
    const record = n > this.bestHeight;
    this.bestHeight = Math.max(this.bestHeight, n);
    if (CFG.features.anchor && record && n > 0 && n % CFG.anchorEvery === 0) { this.anchors++; this.emit('anchorGained'); }
    if (this.level && !this.endless && n >= this.level.target) { this.completeLevel(); return; }
    if (CFG.features.quake && this.hasEvent('quake')) {
      if (n % CFG.quakeEvery === CFG.quakeEvery - 2) this.emit('quakeWarning', { floor: n + 2 });
      if (n > 0 && n % CFG.quakeEvery === 0) { T.quake(); this.emit('quake'); }
    }
  }

  onCollapse(col) {
    this.combo = 0;
    this.emit('collapse', { from: col.from, count: col.count, items: col.items });
    if (this.over) return;
    if (CFG.collapseEndsGame) { this.lives = 0; this.end(); return; }
    this.loseLife(null);
  }

  loseLife(reason) {
    this.lives--;
    this.emit('lifeLost', { reason, lives: this.lives });
    if (this.lives <= 0) this.end();
  }

  completeLevel() {
    const livesLost = this.diff.lives - this.lives;
    const stars = starsFor({ reached: true, livesLost, perfects: this.perfects, landings: this.landings });
    this.emit('target', { target: this.level.target, stars, livesLost });
    this.end({ completed: true, stars });
  }

  end(extra = {}) {
    if (this.over) return;
    this.over = true;
    this.result = {
      score: this.score, floors: Math.max(this.bestHeight, this.tower.n), pop: this.pop, perfects: this.perfects,
      landings: this.landings, completed: false, stars: 0, livesLost: this.diff.lives - this.lives, ...extra,
    };
    this.emit('over', { result: this.result });
  }
}
