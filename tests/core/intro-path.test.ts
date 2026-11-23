// City intro camera path: starts and ends on its keys, passes the landmark views, stays continuous, is deterministic.
import { describe, it, expect } from 'vitest';
import { introKeys, introPose, introDuration } from '../../js/core/intro-path.js';
import type { Pose } from '../../js/core/intro-path.js';

const start: Pose = { p: [44, 24, 0], l: [0, 19, 0] }, end: Pose = { p: [30, 40, 44], l: [0, 2, 0] };
const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

describe('intro path', () => {
  const spots = [{ x: 47, z: 81 }, { x: -16, z: -83 }];
  const keys = introKeys(start, spots, end);
  it('starts at the camera and ends at the run pose', () => {
    expect(near(introPose(keys, 0).p, start.p)).toBe(true);
    expect(near(introPose(keys, 1).p, end.p)).toBe(true);
  });
  it('has one view per landmark and looks at each', () => {
    expect(keys.length).toBe(spots.length + 2);
    for (const s of spots) expect(keys.some((k) => Math.abs(k.l[0] - s.x) < 1e-9 && Math.abs(k.l[2] - s.z) < 1e-9)).toBe(true);
  });
  it('has no jumps', () => {
    let prev = introPose(keys, 0);
    for (let i = 1; i <= 400; i++) { const q = introPose(keys, i / 400); expect(Math.hypot(...q.p.map((v, c) => v - prev.p[c]))).toBeLessThan(8); prev = q; }
  });
  it('works without landmarks and is the same every time', () => {
    const k = introKeys(start, [], end);
    expect(k.length).toBe(3);
    expect(introPose(k, 0.4)).toEqual(introPose(introKeys(start, [], end), 0.4));
  });
  it('stays under the length cap', () => { expect(introDuration(10)).toBe(9); expect(introDuration(0)).toBeGreaterThan(3); });
});
