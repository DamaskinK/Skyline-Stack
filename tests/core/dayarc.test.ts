import { describe, it, expect } from 'vitest';
import { dayAt, arcProgress, ENDLESS_LOOP } from '../../js/core/dayarc.js';
import { LEVELS } from '../../js/levels.js';

import { need } from './helpers.js';

const kosice = LEVELS[0];
const arc = (l: (typeof LEVELS)[number]) => need(l.dayArc, `dayArc of ${l.id}`);

describe('time-of-day arc', () => {
  it('walks Kosice from its start hour to its end hour at the target', () => {
    expect(dayAt(kosice, 0).hour).toBeCloseTo(arc(kosice).start);
    expect(dayAt(kosice, kosice.target).hour).toBeCloseTo(arc(kosice).end);
    expect(dayAt(kosice, kosice.target * 5).hour).toBeCloseTo(arc(kosice).end);   // clamped past the target
    expect(dayAt(kosice, kosice.target / 2).t).toBeCloseTo(0.5);
  });
  it('gives every city an arc with start before end', () => {
    for (const l of LEVELS) expect(arc(l).end).toBeGreaterThan(arc(l).start);
  });
  it('loops Endless smoothly: back at the start after one loop, never past the end', () => {
    expect(arcProgress(kosice, 0, true)).toBeCloseTo(0);
    expect(arcProgress(kosice, ENDLESS_LOOP / 2, true)).toBeCloseTo(1);
    expect(arcProgress(kosice, ENDLESS_LOOP, true)).toBeCloseTo(0);
    expect(Math.abs(arcProgress(kosice, 1, true) - arcProgress(kosice, 0, true))).toBeLessThan(0.02);
  });
  it('has a fixed afternoon without a level', () => {
    expect(dayAt(null, 40).hour).toBe(dayAt(null, 0).hour);
  });
});
