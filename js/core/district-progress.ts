// District progress as pure functions (storage lives in js/settings.js). One object for all cities:
// { v: 2, cities: { [cityId]: { plots: { [plotId]: { stars, bestHeight, residents, counted } }, opened, goalReached } } }
import type { CityProgress, DistrictProgress, District, PlotResult, Progress } from '../types.js';
import { isObject } from './stars.js';
import { emptyPlot, recordPlot, plotResidents, goalReached, resultCounts } from './district.js';

export const emptyDistrictProgress = (): DistrictProgress => ({ v: 2, cities: {} });
export const emptyCity = (): CityProgress => ({ plots: {}, opened: false, goalReached: false });

const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);

// Normalise whatever was read from storage; anything that is not a version-2 object is dropped, bad entries are skipped.
export function sanitizeDistrict(raw: unknown): DistrictProgress {
  const p = emptyDistrictProgress();
  if (!isObject(raw) || raw.v !== 2 || !isObject(raw.cities)) return p;
  for (const [cid, c] of Object.entries(raw.cities)) {
    if (!isObject(c)) continue;
    const city = emptyCity();
    city.opened = c.opened === true;
    city.goalReached = c.goalReached === true;
    if (isObject(c.plots)) for (const [pid, s] of Object.entries(c.plots)) {
      if (!isObject(s)) continue;
      city.plots[pid] = { stars: Math.min(3, Math.floor(num(s.stars))), bestHeight: num(s.bestHeight), residents: Math.floor(num(s.residents)), counted: s.counted === true };
    }
    p.cities[cid] = city;
  }
  return p;
}

export const cityProgress = (progress: DistrictProgress, cityId: string): CityProgress => progress.cities[cityId] || emptyCity();

// Record a finished plot attempt for a city (district = city.district). Returns a new progress object.
// `nextCityId`: the city that opens when the residents goal is reached for the first time (it gets `opened: true`).
export function recordCityPlot(progress: DistrictProgress, cityId: string, district: District, plotId: string, result: PlotResult, nextCityId: string | null = null): DistrictProgress {
  const p = sanitizeDistrict(JSON.parse(JSON.stringify(progress)));
  const city = p.cities[cityId] || emptyCity();
  city.plots = recordPlot(district, city.plots, plotId, result);
  city.opened = true;
  const first = !city.goalReached && goalReached(district, city.plots);
  city.goalReached = city.goalReached || first;
  p.cities[cityId] = city;
  if (first && nextCityId) p.cities[nextCityId] = { ...(p.cities[nextCityId] || emptyCity()), opened: true };
  return p;
}

// Carry S0001 Kosice level progress (sanitised { levels: { kosice: { stars, bestHeight } } }) onto the last plot
// (the cathedral, the S0001 site). Only when the district progress has no Kosice entry yet. Stars and best height are kept; `counted`
// follows the plot's own rules (resultCounts) on a result rebuilt from the S0001 stars: 1 = reached (here: best height >= the plot's target),
// 2 = and at most one life lost, 3 = and half the landings perfect. What the stars do not say (perfect share below 3 stars) counts against.
export function migrateFromLevels(progress: DistrictProgress, oldProgress: Progress | null | undefined, cityId: string, district: District): DistrictProgress {
  const p = sanitizeDistrict(JSON.parse(JSON.stringify(progress)));
  const old = oldProgress && oldProgress.levels && oldProgress.levels[cityId];
  if (p.cities[cityId] || !old || !(old.stars > 0 || old.bestHeight > 0)) return p;
  const last = district.plots[district.plots.length - 1];
  const city = emptyCity();
  city.plots[last.id] = { ...emptyPlot(), stars: Math.min(3, Math.max(0, old.stars)), bestHeight: Math.max(0, old.bestHeight), counted: resultCounts(last, { height: old.bestHeight, reached: old.stars >= 1 && old.bestHeight >= last.target, livesLost: old.stars >= 2 ? 0 : 9, perfects: old.stars >= 3 ? 1 : 0, landings: 1 }) };
  city.plots[last.id].residents = plotResidents(district, city.plots, last.id);
  city.opened = true;
  city.goalReached = goalReached(district, city.plots);
  p.cities[cityId] = city;
  return p;
}
