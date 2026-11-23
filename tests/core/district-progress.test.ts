import { describe, it, expect } from 'vitest';
import { NEWTOWN } from '../../js/levels.js';
import type { Progress } from '../../js/types.js';
import { levelOf, need } from './helpers.js';
import { sanitizeDistrict, emptyDistrictProgress, recordCityPlot, migrateFromLevels, cityProgress } from '../../js/core/district-progress.js';

const D = need(levelOf('kosice').district);
const oldLevels = (levels: Progress['levels']): Progress => ({ v: 1, levels, opened: [], endless: {} });
const good = (h: number) => ({ height: h, reached: true, livesLost: 0, perfects: 6, landings: 10 });

describe('district progress store', () => {
  it('drops bad or old data', () => {
    for (const bad of [null, undefined, 5, 'x', [], { v: 1, levels: {} }, { v: 2 }, { v: 2, cities: 7 }]) expect(sanitizeDistrict(bad)).toEqual(emptyDistrictProgress());
    const p = sanitizeDistrict({ v: 2, cities: { kosice: { plots: { terasa: { stars: 9, bestHeight: -3, residents: 'x', counted: 1 }, bad: null }, opened: 1 }, junk: 3 } });
    expect(p.cities.kosice.plots.terasa).toEqual({ stars: 3, bestHeight: 0, residents: 0, counted: false });
    expect(p.cities.kosice.plots.bad).toBeUndefined();
    expect(p.cities.junk).toBeUndefined();
  });
  it('records a plot, opens the city, keeps cities apart and does not mutate', () => {
    const p0 = emptyDistrictProgress();
    const p1 = recordCityPlot(p0, 'kosice', D, 'terasa', good(12));
    expect(p0).toEqual(emptyDistrictProgress());
    expect(need(cityProgress(p1, 'kosice').plots.terasa).counted).toBe(true);
    expect(cityProgress(p1, 'kosice').opened).toBe(true);
    expect(cityProgress(p1, 'newtown').plots).toEqual({});
    const p2 = recordCityPlot(p1, 'newtown', need(NEWTOWN.district), 'edge', good(12));
    expect(cityProgress(p2, 'newtown').plots.edge.counted).toBe(true);
    expect(cityProgress(p2, 'kosice')).toEqual(cityProgress(p1, 'kosice'));
  });
  it('opens the next city when the residents goal is reached for the first time, not before', () => {
    let p = recordCityPlot(emptyDistrictProgress(), 'kosice', { ...D, goal: 100 }, 'terasa', good(12), 'prague');
    expect(cityProgress(p, 'prague').opened).toBe(true);            // 12 floors x 14 residents = 168 >= 100
    p = recordCityPlot(emptyDistrictProgress(), 'kosice', { ...D, goal: 99999 }, 'terasa', good(12), 'prague');
    expect(cityProgress(p, 'prague').opened).toBe(false);
  });
  it('survives a JSON round trip', () => {
    const p = recordCityPlot(emptyDistrictProgress(), 'kosice', D, 'terasa', good(14));
    expect(sanitizeDistrict(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it('maps S0001 Kosice stars and best height onto the cathedral plot', () => {
    const old = oldLevels({ kosice: { stars: 2, bestHeight: 27 }, prague: { stars: 1, bestHeight: 5 } });
    const p = migrateFromLevels(emptyDistrictProgress(), old, 'kosice', D);
    const c = cityProgress(p, 'kosice');
    expect(c.plots.cathedral).toMatchObject({ stars: 2, bestHeight: 27, counted: false, residents: 0 });   // 2 stars say nothing of the 40 % perfect rule
    const three = cityProgress(migrateFromLevels(emptyDistrictProgress(), oldLevels({ kosice: { stars: 3, bestHeight: 27 } }), 'kosice', D), 'kosice');
    expect(three.plots.cathedral).toMatchObject({ stars: 3, bestHeight: 27, counted: true });
    expect(three.plots.cathedral.residents).toBeGreaterThan(0);
    const low = cityProgress(migrateFromLevels(emptyDistrictProgress(), oldLevels({ kosice: { stars: 3, bestHeight: 22 } }), 'kosice', D), 'kosice');
    expect(low.plots.cathedral).toMatchObject({ stars: 3, bestHeight: 22, counted: false });   // the old target (20) is below the plot's 26
    expect(Object.keys(c.plots)).toEqual(['cathedral']);
    expect(migrateFromLevels(p, oldLevels({ kosice: { stars: 3, bestHeight: 99 } }), 'kosice', D)).toEqual(p); // never overwrites
    expect(migrateFromLevels(emptyDistrictProgress(), oldLevels({}), 'kosice', D)).toEqual(emptyDistrictProgress());
    expect(migrateFromLevels(emptyDistrictProgress(), null, 'kosice', D)).toEqual(emptyDistrictProgress());
  });
  it('a failed S0001 attempt keeps only the best height (not counted)', () => {
    const p = migrateFromLevels(emptyDistrictProgress(), oldLevels({ kosice: { stars: 0, bestHeight: 9 } }), 'kosice', D);
    expect(cityProgress(p, 'kosice').plots.cathedral).toMatchObject({ stars: 0, bestHeight: 9, counted: false, residents: 0 });
  });
});
