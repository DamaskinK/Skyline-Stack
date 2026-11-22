// Building types: each trait multiplier changes the outcome it should; the plain panel block changes nothing.
import { describe, it, expect } from 'vitest';
import { Run } from '../../js/core/run.js';
import { CFG, DIFFICULTY } from '../../js/config.js';
import { BUILDING_TYPES, applyTrait } from '../../js/building-types.js';
import { windAt, Tower } from '../../js/physics.js';
import { levelById } from '../../js/levels.js';

const D = DIFFICULTY.normal;
const ids = Object.keys(BUILDING_TYPES);

function play(diff, opts, delay, seconds = 40) {
  const run = new Run(diff, opts), events = [];
  let hangT = 0;
  for (let i = 0; i < seconds / CFG.DT && !run.over; i++) {
    if (run.block && run.block.state === 'hang') { hangT += CFG.DT; if (hangT >= delay) { run.drop(); hangT = 0; } }
    run.step(CFG.DT); events.push(...run.drain());
  }
  return { run, events };
}

describe('building types as data', () => {
  it('defines all six types with a trait and a hint', () => {
    expect(ids).toEqual(['panel', 'hotel', 'office', 'glass', 'deco', 'neon']);
    for (const id of ids) {
      const t = BUILDING_TYPES[id];
      expect(t.hint.length).toBeGreaterThan(10);
      for (const k of ['perfect', 'mass', 'slide', 'wind']) expect(t.trait[k]).toBeGreaterThan(0);
    }
  });
  it('gives Kosice the panel block', () => { expect(levelById('kosice').buildingType).toBe('panel'); });
});

describe('plain type', () => {
  it('changes nothing: same events as no type at all', () => {
    for (const d of [0.4, 0.9]) {
      const a = play(D, { buildingType: 'panel' }, d), b = play(D, {}, d);
      expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    }
  });
});

describe('traits', () => {
  it('hotel narrows the perfect window', () => { expect(applyTrait(D, 'hotel').perfect).toBeLessThan(D.perfect); });
  it('a landing between the windows is perfect on the panel block but not in the hotel', () => {
    const offset = (D.perfect + applyTrait(D, 'hotel').perfect) / 2;
    expect(offset <= applyTrait(D, 'panel').perfect).toBe(true);
    expect(offset <= applyTrait(D, 'hotel').perfect).toBe(false);
    // and through the run: classification uses the effective window
    const kinds = (type) => {
      const out = new Set();
      for (let d = 0.05; d < 2.4; d += 0.05) for (const e of play(D, { buildingType: type }, d, 15).events) if (e.type === 'land') out.add(`${e.offset <= applyTrait(D, 'panel').perfect}-${e.kind}`);
      return out;
    };
    expect(kinds('hotel').has('true-perfect')).toBe(true);   // inside both windows
    expect([...kinds('hotel')].some((k) => k.startsWith('true-') && k !== 'true-perfect')).toBe(true);   // inside panel window only
  });
  it('office makes every floor heavier', () => {
    const run = new Run(D, { buildingType: 'office' }); run.step(1);
    const plain = new Run(D, {}); plain.step(1);
    expect(run.block.m).toBeCloseTo(plain.block.m * BUILDING_TYPES.office.trait.mass);
  });
  it('glass slides a block further than the panel block on the same roof', () => {
    const land = (type) => {
      const t = new Tower(0, 0, applyTrait(D, type)); t.wx = { mu: 0.9 };
      const b = { m: 1, x: 0, y: CFG.FOUND_H + CFG.H, z: 0, vx: 6, vy: -3, vz: 0 };
      let ev = null; for (let i = 0; i < 600 && !ev; i++) ev = t.fly(b, CFG.DT, { x: 0, z: 0 });
      return ev.dx - b.x;
    };
    expect(land('glass')).toBeGreaterThan(land('panel'));
    expect(land('panel')).toBeGreaterThan(0);
  });
  it('deco blows harder at the same time and height', () => {
    const w0 = windAt(5, 10, applyTrait(D, 'panel'), { base: 3, gust: 3, mult: 1 }), w1 = windAt(5, 10, applyTrait(D, 'deco'), { base: 3, gust: 3, mult: 1 });
    expect(w1.speed).toBeCloseTo(w0.speed * BUILDING_TYPES.deco.trait.wind);
  });
  it('neon changes only the render hint, not the physics', () => {
    expect(BUILDING_TYPES.neon.nightVisibility).toBeLessThan(1);
    const a = play(D, { buildingType: 'neon' }, 0.6), b = play(D, {}, 0.6);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });
  it('an explicit buildingType overrides the level\'s', () => {
    expect(new Run(D, { level: levelById('kosice'), buildingType: 'hotel' }).diff.perfect).toBeLessThan(D.perfect);
    expect(new Run(D, { level: levelById('kosice') }).diff.perfect).toBe(D.perfect);
  });
});
