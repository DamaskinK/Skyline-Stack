// Sound effects: recorded files from assets/audio/manifest.json where they loaded, synthesised ones as the fallback.
// Volumes come from settings. The music director lives in js/music.js.
import { settings, onSettings } from './settings.js';
import { loadManifest } from './assets.js';
import type { Wind, WeatherCycle } from './types.js';

type SfxLoopName = 'wind' | 'rain' | 'city';
interface SfxLoop { s: { stop(): void }; f: BiquadFilterNode | null; g: GainNode; rec: boolean }

class SfxEngine {
  ctx: AudioContext | null = null;
  // Nodes made by init(); every method that reads them runs after init() created the context.
  out!: DynamicsCompressorNode; fx!: GainNode; mus!: GainNode; analyser!: AnalyserNode; noiseBuf!: AudioBuffer;
  buffers: Record<string, AudioBuffer> = {};
  loops: Partial<Record<SfxLoopName, SfxLoop>> = {};   // all three exist once init() has run
  menuTrack: AudioBuffer | undefined;
  sharedLoading = false;
  loadErrors: { message: string }[] | undefined;
  onReady: (() => void)[] = [];   // callbacks run once the AudioContext exists (the music director hooks in here)
  onShared: (() => void)[] = [];
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;   // Safari before 14.1 if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createDynamicsCompressor(); this.out.connect(c.destination);
    this.fx = c.createGain(); this.fx.connect(this.out);
    this.mus = c.createGain(); this.mus.connect(this.out);
    this.applyVolumes();
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 2048; this.out.connect(this.analyser);   // for checks: rms()
    this.buffers = {};
    this.loops = {};
    this.startLoop('wind'); this.startLoop('rain'); this.startLoop('city');
    this.loadShared();
    for (const fn of this.onReady) fn();
  }
  // Ambient loop: the recorded file when decoded, else filtered noise. Replacing a loop stops the old one.
  startLoop(name: SfxLoopName): void {
    const c = this.ctx as AudioContext, old = this.loops[name], rec = this.buffers[name];
    if (old) { old.g.gain.cancelScheduledValues(0); old.g.gain.value = 0; try { old.s.stop(); } catch { /* already stopped */ } }
    if (name === 'city' && !rec) { this.loops.city = { s: { stop() {} }, g: c.createGain(), f: null, rec: false }; return; }
    const s = c.createBufferSource(); s.buffer = rec || this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter();
    f.type = name === 'rain' ? 'highpass' : 'lowpass'; f.frequency.value = rec ? (name === 'rain' ? 60 : 800) : (name === 'rain' ? 2500 : 400);
    const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(this.fx); s.start();
    this.loops[name] = { s, f, g, rec: !!rec };
  }
  // Fetch and decode the shared audio list. A file that fails stays out of `buffers` and its synth sound plays instead.
  async loadShared() {
    if (this.sharedLoading) return; this.sharedLoading = true;
    try {
      const { assets, errors } = await loadManifest('assets/audio/manifest.json', () => {}, 'shared audio');
      this.loadErrors = errors;
      await Promise.all(Object.entries(assets).map(async ([id, raw]) => {
        const b = await this.decode(raw as ArrayBuffer);   // the shared manifest lists audio files only
        if (!b) return;
        if (id === 'menu') this.menuTrack = b; else this.buffers[id] = b;
        if (id === 'wind' || id === 'rain' || id === 'city') this.startLoop(id);
      }));
      for (const fn of this.onShared) fn();
    } catch (e) { this.loadErrors = [{ message: e instanceof Error ? e.message : String(e) }]; }
  }
  // decodeAudioData detaches its input, so a copy goes in and the loaded bytes stay usable. Null when the file cannot be decoded.
  async decode(raw: ArrayBuffer): Promise<AudioBuffer | null> {
    try { return await (this.ctx as AudioContext).decodeAudioData(raw.slice(0)); } catch { return null; }
  }
  rms() {
    if (!this.analyser) return 0;
    const d = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(d);
    let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length);
  }
  // Play a decoded effect once. Returns false when it is not available (the caller then plays the synth version).
  play(name: string, vol = 1, rate = 1, when = 0, dest: AudioNode | null = null): boolean {
    const b = this.buffers && this.buffers[name]; if (!b) return false;
    const c = this.ctx as AudioContext, s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g).connect(dest || this.fx); s.start(c.currentTime + when);
    return true;
  }
  applyVolumes() {
    if (!this.ctx) return;
    const on = settings.muted ? 0 : 1;
    this.fx.gain.value = settings.sfx * 0.85 * on;
    this.mus.gain.value = settings.music * 0.5 * on;
  }
  tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, f2: number | null = null, when = 0, dest: AudioNode | null = null): void {
    const c = this.ctx; if (!c) return; const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest || this.fx); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur: number, freq: number, vol = 0.3, type: BiquadFilterType = 'lowpass', when = 0, dest: AudioNode | null = null): void {
    const c = this.ctx; if (!c) return; const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(dest || this.fx); s.start(t); s.stop(t + dur + 0.05);
  }
  ui() { this.tone(660, 0.06, 'square', 0.06); }
  uiOk() { this.tone(880, 0.08, 'square', 0.07); this.tone(1320, 0.1, 'square', 0.05, null, 0.06); }
  uiBack() { this.tone(440, 0.08, 'square', 0.06, 330); }
  drop() { if (!this.play('drop', 0.7, 0.95 + Math.random() * 0.1)) this.noise(0.25, 900, 0.12, 'bandpass'); }
  land(perfect: boolean, combo: number): void {
    if (!this.play('land', 1, 0.92 + Math.random() * 0.16)) { this.tone(110, 0.22, 'sine', 0.5, 45); this.noise(0.1, 500, 0.25); }
    if (perfect) { const base = 523 * Math.pow(2, Math.min(combo, 12) / 12); [1, 1.26, 1.5, 2].forEach((m, i) => this.tone(base * m, 0.25, 'square', 0.06, null, i * 0.06)); }
  }
  bounce() { this.tone(180, 0.25, 'square', 0.12, 620); }
  miss() { this.tone(330, 0.6, 'sawtooth', 0.12, 70); }
  thud() { if (!this.play('land', 0.55, 0.75)) { this.tone(70, 0.3, 'sine', 0.4, 35); this.noise(0.25, 300, 0.2); } }
  // Collapse: four layers. A pitched-down Low Thud with a synthesised sub-boom for weight, a noise burst whose filter
  // falls for the rubble, and a short scatter of metal and glass pings. The recorded part falls back to synth tones.
  crash() {
    const c = this.ctx; if (!c) return;
    if (!this.play('land', 1, 0.45) ) this.tone(70, 0.5, 'sine', 0.6, 30);
    this.play('land', 0.8, 0.3, 0.05);
    this.tone(78, 1.5, 'sine', 0.75, 26);                       // sub-boom
    this.tone(46, 2.0, 'sine', 0.55, 24, 0.08);
    const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = 'lowpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(140, t + 1.9);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    s.connect(f).connect(g).connect(this.fx); s.start(t); s.stop(t + 2.1);   // debris
    for (let i = 0; i < 14; i++) {                              // metal and glass scatter
      const w = 0.05 + Math.pow(Math.random(), 1.6) * 1.3, fr = 1800 + Math.random() * 7200;
      this.tone(fr, 0.05 + Math.random() * 0.12, Math.random() < 0.5 ? 'triangle' : 'square', 0.03 + Math.random() * 0.05, fr * (0.9 + Math.random() * 0.2), w);
    }
  }
  thunder() { if (!this.play('thunder', 1)) { this.noise(2.5, 180, 0.8); this.noise(0.3, 3000, 0.3, 'highpass'); } }
  rumble() { this.noise(1.2, 120, 0.25); }
  anchor() { this.tone(200, 0.5, 'triangle', 0.25, 420); }
  golden() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.1, null, i * 0.08)); }
  whoosh() { this.noise(0.6, 600, 0.2, 'bandpass'); }
  fanfare() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'square', 0.08, null, i * 0.12)); }
  over() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'square', 0.08, null, i * 0.2)); }
  ambience(wind: Wind, ph: WeatherCycle, active: boolean): void {
    if (!this.ctx) return; const t = this.ctx.currentTime, L = this.loops as Record<SfxLoopName, SfxLoop>;
    const wr = L.wind.rec, rr = L.rain.rec;
    L.wind.g.gain.setTargetAtTime(active ? Math.min(wr ? 0.9 : 0.35, (wr ? 0.1 : 0.02) + wind.speed * (wr ? 0.06 : 0.022)) : (wr ? 0.05 : 0.015), t, 0.3);
    (L.wind.f as BiquadFilterNode).frequency.setTargetAtTime((wr ? 500 : 250) + wind.speed * (wr ? 220 : 45), t, 0.3);
    L.rain.g.gain.setTargetAtTime(active && ph.rain ? (rr ? 0.55 : 0.09) : 0, t, 0.6);
    // city ambience, quiet, in clear weather only (and a little in the menu)
    const clear = ph.kind === 'clear';
    L.city.g.gain.setTargetAtTime(L.city.rec && clear ? (active ? 0.16 : 0.09) : 0, t, 0.8);
  }
}
export const Sfx = new SfxEngine();
onSettings((k) => { if (k === 'sfx' || k === 'music' || k === 'muted') Sfx.applyVolumes(); });
