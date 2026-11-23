import { describe, it, expect } from 'vitest';
import { joinWays, makeRoute, project, snapStops, makeSchedule, cutPolyline, pointAt } from '../../js/core/tram-route.js';

describe('joinWays', () => {
  it('chains ways that share an end, in either direction', () => {
    const lines = joinWays([[0, 0, 10, 0], [20, 0, 10, 0], [20, 0, 30, 5], [100, 100, 110, 100]]);
    expect(lines.length).toBe(2);
    const long = lines.find((l) => l.length > 6);
    expect(long.length / 2).toBe(4);
  });
});
describe('route', () => {
  const r = makeRoute([0, 0, 100, 0, 100, 50]);
  it('measures and projects', () => {
    expect(r.len).toBe(150);
    expect(project(r, 40, 3)).toEqual({ s: 40, d: 3 });
    expect(pointAt(r, 125).slice(0, 2)).toEqual([100, 25]);
  });
  it('snaps stops near the line and thins close ones', () => {
    expect(snapStops(r, [[40, 5], [50, 4], [100, 30], [500, 500]], 14, 60)).toEqual([40, 130]);
  });
});
describe('schedule', () => {
  const sch = makeSchedule(300, [100, 200], { span: 20, speed: 10, dwell: 5, pause: 2 });
  it('is deterministic and periodic', () => {
    expect(sch.at(7.3)).toEqual(sch.at(7.3 + sch.period));
    expect(sch.at(3).s).toBeCloseTo(50);
  });
  it('stands at a stop for the dwell time and drives on', () => {
    const t = (100 - 20) / 10;          // arrives at 8 s
    expect(sch.at(t + 2)).toEqual({ s: 100, moving: false });
    expect(sch.at(t + 5.5).moving).toBe(true);
  });
  it('stays on the line', () => {
    for (let t = 0; t < sch.period; t += 0.7) { const { s } = sch.at(t); expect(s).toBeGreaterThanOrEqual(20); expect(s).toBeLessThanOrEqual(300); }
  });
});
describe('cutPolyline', () => {
  it('cuts a line at a box edge and keeps what lies outside', () => {
    const parts = cutPolyline([-50, 0, 50, 0], [[-10, -10, 10, 10]], (x, z) => !(Math.abs(x) < 10 && Math.abs(z) < 10));
    expect(parts).toEqual([[-50, 0, -10, 0], [10, 0, 50, 0]]);
  });
  it('keeps a bend whole when nothing is cut', () => {
    expect(cutPolyline([0, 0, 5, 0, 5, 5], [[-100, -100, 100, 100]], () => true)).toEqual([[0, 0, 5, 0, 5, 5]]);
  });
});
