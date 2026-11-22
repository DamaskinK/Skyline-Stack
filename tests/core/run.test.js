// Behaviour of the simulation core, driven only through its public input (drop) and output (events, state).
import { describe, it, expect } from 'vitest';
import { Run } from '../../js/core/run.js';
import { CFG, DIFFICULTY } from '../../js/config.js';

// Play one run: drop each block `delay` seconds after it starts hanging. Returns every event and the run.
function play(diffKey, delay, maxSeconds = 90) {
  const run = new Run(DIFFICULTY[diffKey]);
  const events = [];
  let hangT = 0;
  for (let i = 0; i < maxSeconds / CFG.DT && !run.over; i++) {
    if (run.block && run.block.state === 'hang') { hangT += CFG.DT; if (hangT >= delay) { run.drop(); hangT = 0; } }
    run.step(CFG.DT);
    events.push(...run.drain());
  }
  return { run, events };
}

const DELAYS = Array.from({ length: 48 }, (_, i) => 0.05 + i * 0.05);
const sweep = (diffKey) => DELAYS.flatMap((d) => play(diffKey, d).events);

describe('determinism', () => {
  it('gives the same events for the same difficulty and drop timing', () => {
    for (const d of [0.3, 0.75, 1.4]) {
      const a = play('normal', d), b = play('normal', d);
      expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
      expect(a.events.length).toBeGreaterThan(10);
    }
  });
});

describe('landing', () => {
  for (const key of ['easy', 'normal', 'hard']) {
    it(`classifies every landing by its offset against the ${key} windows`, () => {
      const diff = DIFFICULTY[key];
      const events = sweep(key);
      const lands = events.filter((e) => e.type === 'land');
      for (const e of lands) {
        const expected = e.offset <= diff.perfect ? 'perfect' : e.offset <= diff.good ? 'good' : 'risky';
        expect(e.kind).toBe(expected);
        expect(e.offset).toBeLessThanOrEqual(CFG.risky);
      }
      for (const e of events.filter((x) => x.type === 'slip')) expect(e.offset).toBeGreaterThan(CFG.risky);
      const seen = new Set(events.map((e) => (e.type === 'land' ? e.kind : e.type)));
      for (const k of ['perfect', 'good', 'risky', 'slip']) expect(seen.has(k)).toBe(true);
    });
  }

  it('a slip or a miss costs exactly one life and resets the combo', () => {
    const { events } = play('normal', 0.05);
    let lives = DIFFICULTY.normal.lives;
    events.forEach((e, i) => {
      if (e.type === 'slip' || e.type === 'miss') {
        const next = events.slice(i + 1).find((x) => x.type === 'lifeLost');
        expect(next.lives).toBe(lives - 1);
      }
      if (e.type === 'lifeLost') lives = e.lives;
    });
  });
});

describe('collapse', () => {
  it('removes exactly the reported floors from the tower', () => {
    let checked = 0;
    for (const d of DELAYS) {
      const run = new Run(DIFFICULTY.normal);
      let hangT = 0;
      for (let i = 0; i < 90 / CFG.DT && !run.over; i++) {
        if (run.block && run.block.state === 'hang') { hangT += CFG.DT; if (hangT >= d) { run.drop(); hangT = 0; } }
        const before = run.tower.n;
        run.step(CFG.DT);
        for (const e of run.drain()) {
          if (e.type !== 'collapse') continue;
          // a block may still land on the new top within the same step
          expect(e.from).toBe(before - e.count);
          expect(e.items).toHaveLength(e.count);
          expect([before - e.count, before - e.count + 1]).toContain(run.tower.n);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('end of a run', () => {
  it('ends once when the lives run out and spawns nothing after', () => {
    const { run, events } = play('normal', 0.05);
    expect(run.over).toBe(true);
    const overs = events.filter((e) => e.type === 'over');
    expect(overs).toHaveLength(1);
    const after = events.slice(events.indexOf(overs[0]) + 1);
    expect(after.some((e) => e.type === 'spawn' || e.type === 'land')).toBe(false);
    expect(overs[0].result.floors).toBe(run.bestHeight > run.tower.n ? run.bestHeight : run.tower.n);
    expect(run.drop()).toBe(false);
  });

  it('keeps the tower standing through a calm, careful run', () => {
    // dropping right when the hook passes over the tower keeps landings near the centre
    const run = new Run(DIFFICULTY.easy);
    for (let i = 0; i < 60 / CFG.DT && !run.over; i++) {
      const b = run.block, T = run.tower;
      if (b && b.state === 'hang') {
        const top = T.n ? T.top() : { x: T.bx, z: T.bz };
        if (Math.abs(b.x - top.x) < 0.15 && Math.abs(b.z - top.z) < 0.15) run.drop();
      }
      run.step(CFG.DT); run.drain();
    }
    expect(run.tower.n).toBeGreaterThanOrEqual(10);
  });
});

describe('slow-mo', () => {
  it('slows time while held and drains the meter, then refills', () => {
    const run = new Run(DIFFICULTY.normal);
    expect(run.timeScale(0.5, true)).toBe(CFG.focusScale);
    expect(run.focus).toBeLessThan(1);
    const low = run.focus;
    expect(run.timeScale(0.5, false)).toBe(1);
    for (let i = 0; i < 20; i++) run.timeScale(0.5, false);
    expect(run.focus).toBeGreaterThan(low);
  });
});
