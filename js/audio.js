// Synthesised sound effects and a small chiptune loop. No audio files; volumes come from settings.
import { settings, onSettings } from './settings.js';

export const Sfx = {
  ctx: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createDynamicsCompressor(); this.out.connect(c.destination);
    this.fx = c.createGain(); this.fx.connect(this.out);
    this.mus = c.createGain(); this.mus.connect(this.out);
    this.applyVolumes();
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const loop = (type, freq) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(this.fx); s.start(); return { f, g }; };
    this.windL = loop('lowpass', 400); this.rainL = loop('highpass', 2500);
    Music.next = c.currentTime + 0.1;
  },
  applyVolumes() {
    if (!this.ctx) return;
    const on = settings.muted ? 0 : 1;
    this.fx.gain.value = settings.sfx * 0.85 * on;
    this.mus.gain.value = settings.music * 0.5 * on;
  },
  tone(f, dur, type = 'sine', vol = 0.25, f2 = null, when = 0, dest = null) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest || this.fx); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, freq, vol = 0.3, type = 'lowpass', when = 0, dest = null) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(dest || this.fx); s.start(t); s.stop(t + dur + 0.05);
  },
  ui() { this.tone(660, 0.06, 'square', 0.06); },
  uiOk() { this.tone(880, 0.08, 'square', 0.07); this.tone(1320, 0.1, 'square', 0.05, null, 0.06); },
  uiBack() { this.tone(440, 0.08, 'square', 0.06, 330); },
  drop() { this.noise(0.25, 900, 0.12, 'bandpass'); },
  land(perfect, combo) {
    this.tone(110, 0.22, 'sine', 0.5, 45); this.noise(0.1, 500, 0.25);
    if (perfect) { const base = 523 * Math.pow(2, Math.min(combo, 12) / 12); [1, 1.26, 1.5, 2].forEach((m, i) => this.tone(base * m, 0.25, 'square', 0.06, null, i * 0.06)); }
  },
  bounce() { this.tone(180, 0.25, 'square', 0.12, 620); },
  miss() { this.tone(330, 0.6, 'sawtooth', 0.12, 70); },
  thud() { this.tone(70, 0.3, 'sine', 0.4, 35); this.noise(0.25, 300, 0.2); },
  crash() { this.noise(1.6, 350, 0.6); this.tone(60, 1.2, 'sawtooth', 0.15, 30); },
  thunder() { this.noise(2.5, 180, 0.8); this.noise(0.3, 3000, 0.3, 'highpass'); },
  rumble() { this.noise(1.2, 120, 0.25); },
  anchor() { this.tone(200, 0.5, 'triangle', 0.25, 420); },
  golden() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.1, null, i * 0.08)); },
  whoosh() { this.noise(0.6, 600, 0.2, 'bandpass'); },
  fanfare() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'square', 0.08, null, i * 0.12)); },
  over() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'square', 0.08, null, i * 0.2)); },
  ambience(wind, ph, active) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.windL.g.gain.setTargetAtTime(active ? Math.min(0.35, 0.02 + wind.speed * 0.022) : 0.015, t, 0.3);
    this.windL.f.frequency.setTargetAtTime(250 + wind.speed * 45, t, 0.3);
    this.rainL.g.gain.setTargetAtTime(active && ph.rain ? 0.09 : 0, t, 0.6);
  },
};
onSettings((k) => { if (k === 'sfx' || k === 'music' || k === 'muted') Sfx.applyVolumes(); });

// ── music: a four-chord chiptune loop scheduled a little ahead of time ──
// Notes are semitones from A3. Two moods: a relaxed menu groove and a busier in-game one that speeds up with height.
const CHORDS = [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]];        // Am  F  C  G (relative to A)
const LEAD_A = [12, 15, 19, 15, 17, 15, 12, 10, 8, 12, 15, 12, 10, 7, 10, 12];
const LEAD_B = [19, 17, 15, 12, 15, 17, 19, 22, 20, 19, 15, 12, 14, 15, 17, 19];
const hz = (s) => 220 * Math.pow(2, s / 12);
export const Music = {
  next: 0, step: 0, mood: 'menu', tension: 0,
  setMood(m) { this.mood = m; },
  update() {
    const c = Sfx.ctx; if (!c || settings.music <= 0 || settings.muted) { if (c) this.next = c.currentTime + 0.05; return; }
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    const bpm = this.mood === 'menu' ? 96 : 118 + Math.min(22, this.tension * 22);
    const sixteenth = 60 / bpm / 4;
    while (this.next < c.currentTime + 0.25) {
      const s = this.step, bar = Math.floor(s / 16) % 4, beat = s % 16, ch = CHORDS[bar], t = this.next - c.currentTime;
      const out = Sfx.mus;
      // bass on every eighth, root and fifth
      if (beat % 2 === 0) Sfx.tone(hz(ch[0] - 12 + (beat % 8 === 4 ? 7 : 0)) / 2, sixteenth * 1.8, 'triangle', 0.3, null, t, out);
      // arpeggio
      if (this.mood !== 'menu' || beat % 2 === 0) Sfx.tone(hz(ch[beat % 3] + 12), sixteenth * 0.9, 'square', 0.035, null, t, out);
      // lead melody on quarter and offbeat notes
      if (beat % 4 === 0 || (this.mood !== 'menu' && beat % 4 === 3)) {
        const mel = (Math.floor(s / 64) % 2 ? LEAD_B : LEAD_A)[(bar * 4 + Math.floor(beat / 4)) % 16];
        Sfx.tone(hz(mel), sixteenth * 3, 'square', 0.05, null, t, out);
      }
      // drums
      if (beat % 8 === 0) Sfx.tone(140, 0.12, 'sine', 0.35, 45, t, out);
      if (beat % 8 === 4) Sfx.noise(0.1, 1800, 0.12, 'bandpass', t, out);
      if (this.mood !== 'menu' && beat % 2 === 1) Sfx.noise(0.03, 7000, 0.04, 'highpass', t, out);
      this.next += sixteenth; this.step++;
    }
  },
};
