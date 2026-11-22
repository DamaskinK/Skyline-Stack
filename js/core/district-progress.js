// District progress as pure functions (storage lives in js/settings.js). One object for all cities:
// { v: 2, cities: { [cityId]: { plots: { [plotId]: { stars, bestHeight, residents, counted } }, opened, goalReached } } }
import { emptyPlot, recordPlot, plotResidents, goalReached } from './district.js';

export const emptyDistrictProgress = () => ({ v: 2, cities: {} });
export const emptyCity = () => ({ plots: {}, opened: false, goalReached: false });

const num = (x) => (Number.isFinite(x) && x >= 0 ? x : 0);

// Normalise whatever was read from storage; anything that is not a version-2 object is dropped, bad entries are skipped.
export function sanitizeDistrict(raw) {
  const p = emptyDistrictProgress();
  if (!raw || typeof raw !== 'object' || raw.v !== 2 || !raw.cities || typeof raw.cities !== 'object') return p;
  for (const [cid, c] of Object.entries(raw.cities)) {
    if (!c || typeof c !== 'object') continue;
    const city = emptyCity();
    city.opened = c.opened === true;
    city.goalReached = c.goalReached === true;
    if (c.plots && typeof c.plots === 'object') for (const [pid, s] of Object.entries(c.plots)) {
      if (!s || typeof s !== 'object') continue;
      city.plots[pid] = { stars: Math.min(3, Math.floor(num(s.stars))), bestHeight: num(s.bestHeight), residents: Math.floor(num(s.residents)), counted: s.counted === true };
    }
    p.cities[cid] = city;
  }
  return p;
}

export const cityProgress = (progress, cityId) => progress.cities[cityId] || emptyCity();

// Record a finished plot attempt for a city (district = city.district). Returns a new progress object.
export function recordCityPlot(progress, cityId, district, plotId, result) {
  const p = sanitizeDistrict(JSON.parse(JSON.stringify(progress)));
  const city = p.cities[cityId] || emptyCity();
  city.plots = recordPlot(district, city.plots, plotId, result);
  city.opened = true;
  city.goalReached = city.goalReached || goalReached(district, city.plots);
  p.cities[cityId] = city;
  return p;
}

// Carry S0001 Kosice level progress (sanitised { levels: { kosice: { stars, bestHeight } } }) onto the last plot
// (the cathedral, the S0001 site). Only when the district progress has no Kosice entry yet; stars >= 1 counts as counted.
export function migrateFromLevels(progress, oldProgress, cityId, district) {
  const p = sanitizeDistrict(JSON.parse(JSON.stringify(progress)));
  const old = oldProgress && oldProgress.levels && oldProgress.levels[cityId];
  if (p.cities[cityId] || !old || !(old.stars > 0 || old.bestHeight > 0)) return p;
  const last = district.plots[district.plots.length - 1];
  const city = emptyCity();
  city.plots[last.id] = { ...emptyPlot(), stars: Math.min(3, Math.max(0, old.stars)), bestHeight: Math.max(0, old.bestHeight), counted: old.stars >= 1 };
  city.plots[last.id].residents = plotResidents(district, city.plots, last.id);
  city.opened = true;
  city.goalReached = goalReached(district, city.plots);
  p.cities[cityId] = city;
  return p;
}
