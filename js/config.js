// All balance numbers live here. Difficulty presets scale a few of them at runtime.

export const CFG = {
  W: 4, D: 4, H: 1.6, FOUND_H: 2.4, G: 30, DT: 1 / 120,
  METERS_PER_FLOOR: 3.2,
  dropGap: 3.5, ropeLen: 14,
  perfect: 0.08, good: 0.25, risky: 0.5,          // fractions of block width
  lives: 3, collapseDelay: 0.3, collapseEndsGame: false,
  inherit: 0.35,                                   // how much hook velocity the released block keeps
  slideK: 0.0045, slideCap: 0.6,
  windHook: 0.12, windDrift: 0.6,
  swayImpulse: 0.05, swayZeta: 0.035, windSway: 0.006, pDelta: 0.25,
  perfectDamp: 0.85, goldenEvery: 5, goldenCalm: 5,
  anchorTime: 3, anchorEvery: 25,
  focusScale: 0.4, focusDrain: 0.33, focusGain: 0.2, focusRegen: 0.07, focusRegenDelay: 1,
  quakeEvery: 40, quakeTime: 3, quakeAcc: 0.6,
  lightningEvery: 8, lightningWarn: 2, lightningKick: 0.9,
  features: { special: true, anchor: true, quake: true, focus: true, golden: true, lightning: true },
};

// Multipliers on top of CFG. "meters" feed the bars on the difficulty screen (0..1).
export const DIFFICULTY = {
  easy: {
    label: 'EASY', lives: 5, perfect: 0.12, good: 0.3, swingAmp: 0.75, swingSpeed: 0.8, wind: 0.6, sway: 0.7, slide: 0.6, score: 0.75,
    desc: 'Slow crane, light wind, wide perfect window and 5 lives.',
    meters: { crane: 0.3, wind: 0.3, precision: 0.3, lives: 1 },
  },
  normal: {
    label: 'NORMAL', lives: 3, perfect: 0.08, good: 0.25, swingAmp: 1, swingSpeed: 1, wind: 1, sway: 1, slide: 1, score: 1,
    desc: 'The intended balance. Weather starts to bite after floor 30.',
    meters: { crane: 0.6, wind: 0.6, precision: 0.6, lives: 0.6 },
  },
  hard: {
    label: 'HARD', lives: 3, perfect: 0.06, good: 0.2, swingAmp: 1.2, swingSpeed: 1.2, wind: 1.35, sway: 1.25, slide: 1.3, score: 1.6,
    desc: 'Fast crane, strong gusts, tight perfects. Score ×1.6.',
    meters: { crane: 0.95, wind: 0.95, precision: 0.9, lives: 0.6 },
  },
};

// sky top / horizon, cloud cover in the sky shader, light strength, how lit the windows are (0 day … 1 night)
export const PHASES = [
  { name: 'Clear', mu: 0.9, base: 1, gust: 1, top: 0x2f86e0, bot: 0xc4e6ff, cover: 0.35, cloud: 0xffffff, sun: 1.7, sunCol: 0xfff3dc, hemi: 1.0, night: 0, fog: [110, 320],
    sunDir: [0.35, 0.45, -0.82], text: 'Calm air. Learn the swing.' },
  { name: 'Rain', mu: 0.5, base: 3, gust: 3, top: 0x46566f, bot: 0x95a3b5, cover: 0.85, cloud: 0x8c95a5, sun: 0.6, sunCol: 0xdfe6ff, hemi: 0.8, night: 0.35, fog: [60, 200], rain: true,
    sunDir: [0.35, 0.45, -0.82], text: 'Wet roofs: blocks slide the way they move.' },
  { name: 'Snow', mu: 0.3, base: 5, gust: 4, top: 0x7f97b4, bot: 0xe6eef7, cover: 0.7, cloud: 0xe9eef5, sun: 0.9, sunCol: 0xffffff, hemi: 1.0, night: 0.15, fog: [45, 170], snow: true,
    sunDir: [0.35, 0.35, -0.82], text: 'Ice: even more sliding, stronger wind.' },
  { name: 'Storm', mu: 0.5, base: 7.5, gust: 7, top: 0x0b0f1c, bot: 0x2a3247, cover: 0.95, cloud: 0x2c3242, sun: 0.25, sunCol: 0x9fb2ff, hemi: 0.45, night: 1, fog: [45, 180], rain: true, lightning: true,
    sunDir: [-0.4, 0.5, -0.7], text: 'Night storm. Lightning shakes the tower.' },
  { name: 'Fog', mu: 0.7, base: 4, gust: 3, top: 0x5a4f86, bot: 0xf2a87a, cover: 0.55, cloud: 0xf5c6b0, sun: 0.8, sunCol: 0xffb07a, hemi: 0.8, night: 0.7, fog: [10, 48],
    sunDir: [0.6, 0.08, -0.8], text: 'Dusk fog. Watch the shadow on the roof.' },
];
export const PHASE_LEN = 15;

export const BTYPES = {
  normal: { m: 1, color: 0x4f7cff, label: 'Normal', hint: '' },
  heavy: { m: 2, color: 0x6c7280, label: 'Heavy', hint: 'Wind barely moves it, but an offset shifts the balance twice as much.' },
  light: { m: 0.5, color: 0xf2f4ff, label: 'Light', hint: 'Wind pushes it around. Aim upwind.' },
  bouncy: { m: 1, color: 0xff5fa2, label: 'Bouncy', bouncy: true, hint: 'Hops once on landing and keeps half its speed.' },
  golden: { m: 1, color: 0xffc531, label: 'Golden', golden: true, hint: 'Double points and calms the tower for 5 s.' },
};

export const BUILDINGS = {
  residential: { label: 'Residential', color: 0x4f7cff, css: '#4f7cff', target: 10, bonus: 1, needs: [] },
  commercial: { label: 'Commercial', color: 0xff5a5a, css: '#ff5a5a', target: 15, bonus: 1.5, needs: ['residential'] },
  office: { label: 'Office', color: 0x3fd07a, css: '#3fd07a', target: 20, bonus: 2, needs: ['residential', 'commercial'] },
  luxury: { label: 'Luxury', color: 0xffc531, css: '#ffc531', target: 30, bonus: 3, needs: ['residential', 'commercial', 'office'] },
};
export const ENDLESS_COLORS = [0x4f7cff, 0x4f7cff, 0xf0eadb, 0x4f7cff, 0x4f7cff, 0xe86f4f];

export function phaseAt(n) {
  const i = Math.floor(n / PHASE_LEN) % PHASES.length;
  return { ...PHASES[i], idx: i, mult: 1 + 0.2 * Math.floor(n / (PHASE_LEN * PHASES.length)) };
}

export function specialFor(floorNo) {
  if (!CFG.features.special) return 'normal';
  if (floorNo >= 20 && floorNo % 10 === 0) return 'heavy';
  if (floorNo >= 25 && floorNo % 13 === 0) return 'bouncy';
  if (floorNo >= 15 && floorNo % 7 === 0) return 'light';
  return 'normal';
}
