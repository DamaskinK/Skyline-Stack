// Music director. Plays the menu track and the level track from decoded files, loops them without a gap, and moves
// between states as the game changes: menu, calm, streak, danger, dropout, win.
//   calm     quiet, gentle low-pass (a normal stack)
//   streak   two or more Perfect landings in a row: full and open
//   danger   stability under 30 %: louder, plus a synthesised tension layer (heartbeat, drone, ticks) in the track's
//            tempo and key
//   dropout  short duck and muffle after a collapse or a lost life; the game-over screen keeps it
//   win      sting at the target, then full
// A track that is missing or cannot be decoded is replaced by the old synthesised chiptune loop, so music never goes silent.
// The director reads the game each frame (stability is game.tower.dyn.r, streak is game.combo) and gets events from game.js.
import { Sfx } from './audio.js';
import { settings } from './settings.js';

// Tempo (bpm) and tonic (0 = C) per track, estimated from the audio; they set the tension layer.
export const TRACKS = {
  menu: { bpm: 73, root: 5 }, kosice: { bpm: 98, root: 2 }, prague: { bpm: 115, root: 9 }, berlin: { bpm: 168, root: 5 },
  dubai: { bpm: 86, root: 2 }, 'new-york': { bpm: 100, root: 2 }, tokyo: { bpm: 160, root: 1 },
};
export const STATES = {
  menu:    { g: 0.8,  lp: 12000, tension: 0 },
  calm:    { g: 0.5,  lp: 2200,  tension: 0 },
  streak:  { g: 0.9,  lp: 20000, tension: 0 },
  danger:  { g: 1.0,  lp: 20000, tension: 1 },
  dropout: { g: 0.1,  lp: 320,   tension: 0 },
  win:     { g: 1.0,  lp: 20000, tension: 0 },
};
const DANGER_IN = 0.3, DANGER_OUT = 0.36, DROPOUT_S = 1.8, FADE_S = 0.5;
const UP = Float32Array.from({ length: 64 }, (_, i) => Math.sin((i / 63) * Math.PI / 2));
const DOWN = Float32Array.from({ length: 64 }, (_, i) => Math.cos((i / 63) * Math.PI / 2));
const now = () => performance.now() / 1000;

// Old synthesised loop, kept as the fallback for a missing track.
const CHORDS = [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]];
const LEAD_A = [12, 15, 19, 15, 17, 15, 12, 10, 8, 12, 15, 12, 10, 7, 10, 12];
const LEAD_B = [19, 17, 15, 12, 15, 17, 19, 22, 20, 19, 15, 12, 14, 15, 17, 19];
const hz = (s) => 220 * Math.pow(2, s / 12);
const Chip = {
  next: 0, step: 0,
  update(out, menu, tension) {
    const c = Sfx.ctx;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    const bpm = menu ? 96 : 118 + Math.min(22, tension * 22), sixteenth = 60 / bpm / 4;
    while (this.next < c.currentTime + 0.25) {
      const s = this.step, bar = Math.floor(s / 16) % 4, beat = s % 16, ch = CHORDS[bar], t = this.next - c.currentTime;
      if (beat % 2 === 0) Sfx.tone(hz(ch[0] - 12 + (beat % 8 === 4 ? 7 : 0)) / 2, sixteenth * 1.8, 'triangle', 0.3, null, t, out);
      if (!menu || beat % 2 === 0) Sfx.tone(hz(ch[beat % 3] + 12), sixteenth * 0.9, 'square', 0.035, null, t, out);
      if (beat % 4 === 0 || (!menu && beat % 4 === 3)) {
        const mel = (Math.floor(s / 64) % 2 ? LEAD_B : LEAD_A)[(bar * 4 + Math.floor(beat / 4)) % 16];
        Sfx.tone(hz(mel), sixteenth * 3, 'square', 0.05, null, t, out);
      }
      if (beat % 8 === 0) Sfx.tone(140, 0.12, 'sine', 0.35, 45, t, out);
      if (beat % 8 === 4) Sfx.noise(0.1, 1800, 0.12, 'bandpass', t, out);
      if (!menu && beat % 2 === 1) Sfx.noise(0.03, 7000, 0.04, 'highpass', t, out);
      this.next += sixteenth; this.step++;
    }
  },
};

export const Music = {
  state: 'menu', trackId: null, usingChip: false, log: [],
  game: null, raw: {}, buf: {}, cur: null, old: [], danger: false, won: false, dropUntil: 0, runRef: null, tens: { next: 0, step: 0 },

  bind(game) { this.game = game; },
  // A level track as loaded bytes (ArrayBuffer) from the level manifest. Decoded as soon as the AudioContext exists.
  provide(id, raw) { if (raw && !this.buf[id]) { this.raw[id] = raw; this.decodePending(); } },
  async decodePending() {
    if (!Sfx.ctx) return;
    for (const id of Object.keys(this.raw)) {
      const raw = this.raw[id]; delete this.raw[id];
      const b = await Sfx.decode(raw); if (b) this.buf[id] = b;
    }
  },
  setup() {
    const c = Sfx.ctx;
    this.pre = c.createGain();                         // tracks and the chiptune enter here
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 12000;
    this.duck = c.createGain(); this.duck.gain.value = STATES.menu.g;
    this.tensG = c.createGain(); this.tensG.gain.value = 0;
    this.meter = c.createAnalyser(); this.meter.fftSize = 2048;
    this.pre.connect(this.lp).connect(this.duck); this.tensG.connect(this.duck);
    this.duck.connect(Sfx.mus); this.duck.connect(this.meter);
    this.apply(); this.decodePending();
  },
  // Level of the music alone (before the volume setting), for checks.
  rms() {
    if (!this.meter) return 0;
    const d = new Float32Array(this.meter.fftSize); this.meter.getFloatTimeDomainData(d);
    let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length);
  },

  // Events from game.js.
  event(type) {
    if (type === 'collapse' || type === 'lifeLost') this.dropUntil = now() + DROPOUT_S;
    else if (type === 'target') { this.won = true; this.sting(); }
    this.evaluate();
  },
  sting() {
    if (!Sfx.ctx || !this.pre) return;
    const root = 261.63 * Math.pow(2, (TRACKS[this.trackId]?.root ?? 0) / 12);
    [0, 4, 7, 12, 16, 19, 24].forEach((st, i) => {
      const f = root * Math.pow(2, st / 12);
      Sfx.tone(f, 0.9, 'triangle', 0.14, null, i * 0.09, Sfx.mus);
      Sfx.tone(f * 2, 0.5, 'sine', 0.05, null, i * 0.09, Sfx.mus);
    });
  },

  // Which state now.
  evaluate() {
    const g = this.game; if (!g) return;
    const run = g.run;
    if (run !== this.runRef) { this.runRef = run; this.danger = false; this.won = false; this.dropUntil = 0; }
    let want, id;
    if (g.state === 'menu' || !run) { want = 'menu'; id = 'menu'; }
    else {
      id = g.cityId || 'kosice';
      const T = g.tower, stab = T && T.n ? 1 - T.dyn.r : 1;
      if (stab < DANGER_IN) this.danger = true; else if (stab > DANGER_OUT) this.danger = false;
      if (g.state === 'over') want = this.won ? 'win' : 'dropout';
      else if (this.won) want = 'win';
      else if (now() < this.dropUntil) want = 'dropout';
      else if (this.danger) want = 'danger';
      else want = g.combo >= 2 ? 'streak' : 'calm';
    }
    this.want = want;
    if (id !== this.trackId) this.playTrack(id);
    if (want !== this.state) {
      this.log.push({ t: +now().toFixed(2), from: this.state, to: want, stability: g.tower && g.tower.n ? +(1 - g.tower.dyn.r).toFixed(2) : null, track: id });
      if (this.log.length > 300) this.log.shift();
      this.state = want;
      this.apply();
    }
  },
  apply() {
    const c = Sfx.ctx; if (!c || !this.duck) return;
    const s = STATES[this.state], t = c.currentTime, tau = this.state === 'dropout' ? 0.06 : FADE_S;
    this.duck.gain.setTargetAtTime(s.g, t, tau);
    this.lp.frequency.setTargetAtTime(s.lp, t, tau);
    this.tensG.gain.setTargetAtTime(s.tension * 0.9, t, this.state === 'danger' ? 0.4 : 0.25);
  },

  playTrack(id) {
    this.trackId = id;
    const c = Sfx.ctx; if (!c || !this.pre) return;
    const t = c.currentTime, buf = id === 'menu' ? Sfx.menuTrack : this.buf[id];
    if (this.cur && !this.cur.chip) { this.cur.gain.gain.setTargetAtTime(0, t, 0.6); this.cur.dyingAt = t + 4; this.cur.dead = true; this.old.push(this.cur); }
    if (!buf) { this.cur = { id, chip: true }; this.usingChip = true; return; }
    this.usingChip = false;
    const gain = c.createGain(); gain.gain.value = 0; gain.gain.setTargetAtTime(1, t, 0.5); gain.connect(this.pre);
    this.cur = { id, buf, gain, next: t + 0.05, first: true, passes: [] };
  },
  pass(tr) {
    const c = Sfx.ctx, dur = tr.buf.duration, xf = Math.min(2, dur * 0.08), t = tr.next;
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = tr.buf; g.gain.value = 0; s.connect(g).connect(tr.gain);
    const fin = tr.first ? 0.3 : xf;
    g.gain.setValueCurveAtTime(UP, t, fin);
    g.gain.setValueCurveAtTime(DOWN, t + dur - xf, xf);
    s.start(t); s.onended = () => { try { g.disconnect(); } catch { /* gone */ } };
    tr.passes.push(s); tr.first = false; tr.next = t + dur - xf;
  },

  // Heartbeat, drone and ticks in the track's tempo and key, only while the danger state is on.
  tension() {
    const c = Sfx.ctx, tn = this.tens, info = TRACKS[this.trackId] || TRACKS.kosice, out = this.tensG;
    if (tn.next < c.currentTime) { tn.next = c.currentTime + 0.05; tn.step = 0; }
    const beat = 60 / info.bpm, eighth = beat / 2, f0 = 65.41 * Math.pow(2, info.root / 12);
    while (tn.next < c.currentTime + 0.4) {
      const k = tn.step % 8, t = tn.next - c.currentTime;
      if (k % 2 === 0) { const acc = k === 0; Sfx.tone(acc ? 95 : 80, 0.22, 'sine', acc ? 0.9 : 0.6, 38, t, out); }
      if (k === 3 || k === 7) Sfx.tone(70, 0.14, 'sine', 0.4, 35, t, out);            // second half of the heartbeat
      Sfx.noise(0.04, 7000, k % 2 ? 0.07 : 0.04, 'highpass', t, out);                  // tick
      if (k === 0 || k === 4) Sfx.tone(k === 0 ? f0 : f0 * 1.5, beat * 1.8, 'sawtooth', 0.12, null, t, out);   // root and fifth drone
      tn.next += eighth; tn.step++;
    }
  },

  update() {
    const c = Sfx.ctx; if (!c || !this.pre) return;
    this.evaluate();
    const t = c.currentTime;
    if (!this.cur && this.trackId) this.playTrack(this.trackId);
    if (this.cur && this.cur.chip) {
      const b = this.trackId === 'menu' ? Sfx.menuTrack : this.buf[this.trackId];
      if (b) this.playTrack(this.trackId);                      // the file arrived late
      else if (settings.music > 0 && !settings.muted) Chip.update(this.pre, this.trackId === 'menu', this.state === 'danger' ? 1 : 0.3);
      else Chip.next = t + 0.05;
    } else if (this.cur) while (this.cur.next < t + 0.8) this.pass(this.cur);
    for (const o of this.old) if (t > o.dyingAt) { for (const s of o.passes) { try { s.stop(); } catch { /* done */ } } try { o.gain.disconnect(); } catch { /* gone */ } o.gone = true; }
    this.old = this.old.filter((o) => !o.gone);
    if (this.state === 'danger') this.tension();
  },
};

Sfx.onReady.push(() => Music.setup());
Sfx.onShared.push(() => Music.update());
setInterval(() => Music.update(), 200);   // keeps the loop scheduled while the tab is in the background
