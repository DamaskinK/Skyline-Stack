import { describe, it, expect } from 'vitest';
import type { District, Plot, PlotResult, PlotStates } from '../../js/types.js';
import { levelOf, need } from './helpers.js';
import { LEVELS, NEWTOWN, DISTRICT_CITIES, nextLevel } from '../../js/levels.js';
import { BUILDING_TYPES } from '../../js/building-types.js';
import { WEATHER } from '../../js/config.js';
import {
  isPlotOpen, nextPlot, resultCounts, plotStars, towerResidents, towerBonuses, recordPlot, districtTotals, goalReached,
  plotDistance, VIEW_BONUS, SKYLINE_BONUS,
} from '../../js/core/district.js';

const D = need(levelOf('kosice').district);
const good = (h: number, extra: Partial<PlotResult> = {}): PlotResult => ({ height: h, reached: true, livesLost: 0, perfects: 6, landings: 10, ...extra });
const build = (plots: PlotStates, id: string, r: PlotResult) => recordPlot(D, plots, id, r);
const ids = D.plots.map((p) => p.id);

describe('district data', () => {
  it('has five plots in Kosice and Newtown with the planned targets', () => {
    expect(D.plots.map((p) => p.target)).toEqual([12, 15, 18, 22, 26]);
    expect(need(NEWTOWN.district).plots).toHaveLength(5);
    expect(NEWTOWN.fictional && NEWTOWN.openFromStart).toBe(true);
  });
  it('keeps S0001 fields and the three-city order (ADR 0004)', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['kosice', 'prague', 'tokyo']);
    expect(LEVELS.map((l) => l.order)).toEqual([1, 2, 3]);
    expect(need(nextLevel('prague')).id).toBe('tokyo');
    expect(LEVELS[0].site).toEqual({ lat: 48.72100, lon: 21.25755 });
    expect(D.plots[4].site).toEqual(LEVELS[0].site);
    expect(DISTRICT_CITIES.map((c) => c.id)).toEqual(['kosice', 'newtown']);
  });
  it('uses real building types and weather kinds, requirements as planned', () => {
    for (const c of DISTRICT_CITIES) for (const p of need(c.district).plots) {
      expect(BUILDING_TYPES[p.buildingType]).toBeTruthy();
      for (const w of p.weather) expect(WEATHER[w.kind]).toBeTruthy();
    }
    expect(D.plots.map((p) => p.require)).toEqual([{}, {}, { maxLivesLost: 2 }, { maxLivesLost: 2 }, { minPerfectShare: 0.4 }]);
    const ws = D.plots.map((p) => p.windScale);
    expect([...ws].sort((a, b) => a - b)).toEqual(ws);
    expect(D.plots[0].buildingType).toBe('panel');
    expect(D.plots[4].buildingType).toBe('deco');
  });
  it('runs from the outskirts towards the cathedral', () => {
    const d = D.plots.map((p) => plotDistance(p, D.plots[4]));
    expect(d[0]).toBeGreaterThan(d[1]); expect(d[1]).toBeGreaterThan(d[2]); expect(d[3]).toBeLessThan(d[2]);
  });
});

describe('opening order', () => {
  it('opens only the first plot at the start', () => {
    expect(ids.map((id) => isPlotOpen(D, {}, id))).toEqual([true, false, false, false, false]);
    expect(need(nextPlot(D, {})).id).toBe(ids[0]);
  });
  it('opens the next plot when one counted, and a failed plot stays open', () => {
    let p = build({}, ids[0], { height: 7, reached: false, livesLost: 3, perfects: 1, landings: 7 });
    expect(isPlotOpen(D, p, ids[1])).toBe(false);
    expect(p[ids[0]].bestHeight).toBe(7);
    p = build(p, ids[0], good(12));
    expect(isPlotOpen(D, p, ids[1])).toBe(true);
    expect(need(nextPlot(D, p)).id).toBe(ids[1]);
  });
  it('ignores results on a closed plot', () => {
    expect(build({}, ids[3], good(22))[ids[3]]?.counted || false).toBe(false);
  });
});

describe('counting and stars', () => {
  const kulturpark = D.plots[2], cathedral = D.plots[4];
  it('needs the target', () => expect(resultCounts(D.plots[0], { ...good(11), reached: false })).toBe(false));
  it('needs at most 2 lives lost on the middle plots', () => {
    expect(resultCounts(kulturpark, good(18, { livesLost: 2 }))).toBe(true);
    expect(resultCounts(kulturpark, good(18, { livesLost: 3 }))).toBe(false);
  });
  it('needs 40 % perfect landings at the heart', () => {
    expect(resultCounts(cathedral, good(26, { perfects: 4 }))).toBe(true);
    expect(resultCounts(cathedral, good(26, { perfects: 3 }))).toBe(false);
  });
  it('gives stars only for a counting result and keeps the best', () => {
    expect(plotStars(kulturpark, good(18, { livesLost: 3 }))).toBe(0);
    expect(plotStars(kulturpark, good(18))).toBe(3);
    let p = build({}, ids[0], good(12, { livesLost: 3, perfects: 1 }));
    expect(p[ids[0]].stars).toBe(1);
    p = build(p, ids[0], good(12));
    expect(p[ids[0]].stars).toBe(3);
    p = build(p, ids[0], good(13, { livesLost: 3, perfects: 0 }));
    expect(p[ids[0]].stars).toBe(3);
    expect(p[ids[0]].bestHeight).toBe(13);
  });
});

describe('residents and bonuses', () => {
  it('counts floors times the type rate with no bonus', () => {
    expect(towerResidents(D.plots[0], 12)).toBe(12 * 14);
  });
  it('adds +20 % view and the skyline bonus', () => {
    const base = towerResidents(D.plots[4], 26);
    expect(towerResidents(D.plots[4], 26, { view: true })).toBe(Math.round(base * (1 + VIEW_BONUS)));
    expect(towerResidents(D.plots[4], 26, { view: true, skyline: true })).toBe(Math.round(base * (1 + VIEW_BONUS + SKYLINE_BONUS)));
  });
  it('gives the view only to a tall tower on a plot with a landmark in sight', () => {
    let p = build({}, ids[0], good(12));
    expect(towerBonuses(D, p, ids[0]).view).toBe(false);           // no landmark from the estate
    for (let i = 1; i < 5; i++) p = build(p, ids[i], good(D.plots[i].target));
    expect(towerBonuses(D, p, ids[4]).view).toBe(true);
    expect(towerBonuses(D, p, ids[2]).view).toBe(true);            // 18 floors >= 10, cathedral in sight
  });
  it('gives the skyline bonus to near towers that differ by 6 floors or more, and updates the neighbour', () => {
    const mk = (id: string, x: number): Plot => ({ id, name: id, site: { x, z: 0 }, buildingType: 'panel', target: 5, require: {}, windScale: 1, weather: [], landmarksInView: [] });
    const d: District = { goal: 99999, plots: [mk('a', 0), mk('b', 100), mk('c', 200), mk('far', 5000)] };
    const rec = (p: PlotStates, id: string, h: number) => recordPlot(d, p, id, good(h));
    let p = rec({}, 'a', 10); p = rec(p, 'b', 14);             // 4 apart: no bonus
    expect(towerBonuses(d, p, 'a').skyline).toBe(false);
    const lone = p.a.residents;
    p = rec(p, 'c', 20);                                       // 20 vs 14 = 6 apart, 100 m away
    expect(towerBonuses(d, p, 'c').skyline).toBe(true);
    expect(towerBonuses(d, p, 'b').skyline).toBe(true);
    expect(towerBonuses(d, p, 'a').skyline).toBe(true);        // 20 vs 10, 200 m away
    expect(p.a.residents).toBeGreaterThan(lone);
    p = rec(p, 'far', 40);
    expect(towerBonuses(d, p, 'far').skyline).toBe(false);     // too far from every tower
  });
  it('lets the skyline bonus be earned in Kosice, whose plots lie up to 1.3 km apart', () => {
    let p: PlotStates = {}; for (let i = 0; i < 5; i++) p = build(p, ids[i], good(D.plots[i].target));
    expect(ids.some((id) => towerBonuses(D, p, id).skyline)).toBe(true);
    expect(towerBonuses(D, p, 'juzna').skyline).toBe(true);    // 15 vs 22 floors, 900 m from the Main Street plot
  });
});

describe('goal', () => {
  it('sums stars and residents, and opens the next city at the goal without all plots', () => {
    let p: PlotStates = {};
    expect(goalReached(D, p)).toBe(false);
    for (let i = 0; i < 4; i++) p = build(p, ids[i], good(D.plots[i].target));
    const t = districtTotals(D, p);
    expect(t.counted).toBe(4);
    expect(t.stars).toBe(12);
    expect(t.residents).toBe(ids.slice(0, 4).reduce((s, id) => s + p[id].residents, 0));
    expect(goalReached(D, p)).toBe(t.residents >= D.goal);
    expect(t.residents).toBeGreaterThanOrEqual(D.goal);           // four plots are enough for Kosice
    expect(districtTotals(D, build(build(build({}, ids[0], good(12)), ids[1], good(15)), ids[2], good(18))).residents).toBeLessThan(D.goal);
    expect(goalReached(D, build({}, ids[0], good(12)))).toBe(false);
  });
});

describe('determinism', () => {
  it('same input gives the same output and does not mutate its input', () => {
    const p0 = build({}, ids[0], good(12));
    const snap = JSON.stringify(p0);
    const a = build(p0, ids[1], good(15)), b = build(p0, ids[1], good(15));
    expect(a).toEqual(b);
    expect(JSON.stringify(p0)).toBe(snap);
  });
});
