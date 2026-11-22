import { describe, it, expect } from 'vitest';
import { levelById, NEWTOWN } from '../../js/levels.js';
import { sanitizeDistrict, emptyDistrictProgress, recordCityPlot, migrateFromLevels, cityProgress } from '../../js/core/district-progress.js';

const D = levelById('kosice').district;
const good = (h) => ({ height: h, reached: true, livesLost: 0, perfects: 6, landings: 10 });

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
    expect(cityProgress(p1, 'kosice').plots.terasa.counted).toBe(true);
    expect(cityProgress(p1, 'kosice').opened).toBe(true);
    expect(cityProgress(p1, 'newtown').plots).toEqual({});
    const p2 = recordCityPlot(p1, 'newtown', NEWTOWN.district, 'edge', good(12));
    expect(cityProgress(p2, 'newtown').plots.edge.counted).toBe(true);
    expect(cityProgress(p2, 'kosice')).toEqual(cityProgress(p1, 'kosice'));
  });
  it('survives a JSON round trip', () => {
    const p = recordCityPlot(emptyDistrictProgress(), 'kosice', D, 'terasa', good(14));
    expect(sanitizeDistrict(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it('maps S0001 Kosice stars and best height onto the cathedral plot', () => {
    const old = { v: 1, levels: { kosice: { stars: 2, bestHeight: 27 }, prague: { stars: 1, bestHeight: 5 } }, opened: [], endless: {} };
    const p = migrateFromLevels(emptyDistrictProgress(), old, 'kosice', D);
    const c = cityProgress(p, 'kosice');
    expect(c.plots.cathedral).toMatchObject({ stars: 2, bestHeight: 27, counted: true });
    expect(c.plots.cathedral.residents).toBeGreaterThan(0);
    expect(Object.keys(c.plots)).toEqual(['cathedral']);
    expect(migrateFromLevels(p, { levels: { kosice: { stars: 3, bestHeight: 99 } } }, 'kosice', D)).toEqual(p); // never overwrites
    expect(migrateFromLevels(emptyDistrictProgress(), { levels: {} }, 'kosice', D)).toEqual(emptyDistrictProgress());
    expect(migrateFromLevels(emptyDistrictProgress(), null, 'kosice', D)).toEqual(emptyDistrictProgress());
  });
  it('a failed S0001 attempt keeps only the best height (not counted)', () => {
    const p = migrateFromLevels(emptyDistrictProgress(), { levels: { kosice: { stars: 0, bestHeight: 9 } } }, 'kosice', D);
    expect(cityProgress(p, 'kosice').plots.cathedral).toMatchObject({ stars: 0, bestHeight: 9, counted: false, residents: 0 });
  });
});
