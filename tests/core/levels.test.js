// Level mode of the core: target ends the run with stars; star rules and unlock rules as pure functions.
import { describe, it, expect } from 'vitest';
import { Run } from '../../js/core/run.js';
import { starsFor, emptyProgress, recordLevel, recordEndless, isOpen, sanitize } from '../../js/core/stars.js';
import { LEVELS } from '../../js/levels.js';
import { CFG, DIFFICULTY } from '../../js/config.js';

function play(level, delay, maxSeconds = 400) {
  const run = new Run(DIFFICULTY.easy, { level });
  const events = [];
  let hangT = 0;
  for (let i = 0; i < maxSeconds / CFG.DT && !run.over; i++) {
    if (run.block && run.block.state === 'hang') { hangT += CFG.DT; if (hangT >= delay) { run.drop(); hangT = 0; } }
    run.step(CFG.DT);
    events.push(...run.drain());
  }
  return { run, events };
}
const small = { ...LEVELS[0], target: 3 };

describe('star rules', () => {
  it('gives no star below the target', () => expect(starsFor({ reached: false, livesLost: 0, perfects: 9, landings: 9 })).toBe(0));
  it('gives 1 star for the target alone', () => expect(starsFor({ reached: true, livesLost: 2, perfects: 1, landings: 10 })).toBe(1));
  it('adds a star for at most one life lost', () => {
    expect(starsFor({ reached: true, livesLost: 1, perfects: 1, landings: 10 })).toBe(2);
    expect(starsFor({ reached: true, livesLost: 0, perfects: 1, landings: 10 })).toBe(2);
  });
  it('adds a star for at least 50 % perfect landings', () => {
    expect(starsFor({ reached: true, livesLost: 3, perfects: 5, landings: 10 })).toBe(2);
    expect(starsFor({ reached: true, livesLost: 0, perfects: 5, landings: 10 })).toBe(3);
    expect(starsFor({ reached: true, livesLost: 0, perfects: 4, landings: 10 })).toBe(2);
  });
});

describe('level run', () => {
  it('ends the run with a target event and stars when the target is reached', () => {
    const { run, events } = play(small, 0.7);
    const t = events.find((e) => e.type === 'target');
    expect(t).toBeTruthy();
    expect(run.over).toBe(true);
    expect(run.tower.n).toBe(3);
    expect(t.stars).toBeGreaterThanOrEqual(1);
    const over = events.find((e) => e.type === 'over');
    expect(over.result).toMatchObject({ completed: true, stars: t.stars, floors: 3 });
    expect(events.indexOf(t)).toBeLessThan(events.indexOf(over));
  });
  it('keeps going past any target in Endless', () => {
    const { run } = play(null, 0.7, 60);
    expect(run.tower.n).toBeGreaterThan(3);
    const r = new Run(DIFFICULTY.easy);
    expect(r.level).toBe(null);
  });
  it('keeps the plain game over when lives run out before the target', () => {
    const run = new Run(DIFFICULTY.hard, { level: LEVELS[0] });
    for (let i = 0; i < 60 / CFG.DT && !run.over; i++) { if (run.block?.state === 'hang') run.drop(); run.step(CFG.DT); }
    const over = run.drain().find((e) => e.type === 'over');
    expect(over.result.completed).toBe(false);
    expect(over.result.stars).toBe(0);
  });
});

describe('progress', () => {
  it('opens the next level on one star, not on zero', () => {
    let p = emptyProgress();
    expect(isOpen(p, LEVELS, 'kosice')).toBe(true);
    expect(isOpen(p, LEVELS, 'prague')).toBe(false);
    p = recordLevel(p, LEVELS, 'kosice', { stars: 0, height: 12 });
    expect(isOpen(p, LEVELS, 'prague')).toBe(false);
    p = recordLevel(p, LEVELS, 'kosice', { stars: 1, height: 20 });
    expect(isOpen(p, LEVELS, 'prague')).toBe(true);
    expect(isOpen(p, LEVELS, 'tokyo')).toBe(false);
  });
  it('keeps the best stars and best height', () => {
    let p = recordLevel(emptyProgress(), LEVELS, 'kosice', { stars: 3, height: 20 });
    p = recordLevel(p, LEVELS, 'kosice', { stars: 1, height: 14 });
    expect(p.levels.kosice).toEqual({ stars: 3, bestHeight: 20 });
  });
  it('keeps the ten best Endless scores per city', () => {
    let p = emptyProgress();
    for (let i = 0; i < 12; i++) p = recordEndless(p, 'kosice', { score: i * 10 });
    expect(p.endless.kosice).toHaveLength(10);
    expect(p.endless.kosice[0].score).toBe(110);
    expect(p.endless.prague).toBeUndefined();
  });
  it('drops anything that is not a version-1 progress object', () => {
    for (const bad of [null, 5, 'x', {}, { v: 2, levels: {} }, { v: 1, levels: 7, opened: 'a', endless: [] }]) expect(() => sanitize(bad)).not.toThrow();
    expect(sanitize({ foo: 1 })).toEqual(emptyProgress());
  });
});
