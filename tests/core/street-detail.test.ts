import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { planNearRing, auditPlan } from '../../js/core/placement.js';
import { lightState, PHASE } from '../../js/core/street-detail.js';

const dir = 'assets/levels/kosice/plots/';
describe('street detail (S0004 03)', () => {
  for (const f of readdirSync(dir)) {
    it(`${f}: kerbs, crossings and markings are planned and the audit stays clean`, () => {
      const plan = planNearRing(JSON.parse(readFileSync(dir + f, 'utf8'))), d = plan.detail;
      expect(d.kerbs.length).toBeGreaterThan(500);
      expect(d.zebras.length).toBeGreaterThan(5);
      expect(d.dashes.length).toBeGreaterThan(20);
      expect(auditPlan(plan)).toEqual([]);
    });
  }
  it('traffic lights alternate: never green for both groups, amber between', () => {
    const l = { x: 0, z: 0, arms: [], offset: 3 };
    for (let t = 0; t < PHASE.period * 2; t += 0.5) expect(lightState(l, 0, t) === 0 && lightState(l, 1, t) === 0).toBe(false);
    const seen = new Set<number>(); for (let t = 0; t < PHASE.period; t += 0.5) seen.add(lightState(l, 0, t));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});
