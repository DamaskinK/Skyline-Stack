// District rules as pure functions (no storage, no Three.js, no DOM). A district is `city.district = { goal, plots }`;
// the progress of one city is a map plotId -> { stars, bestHeight, residents, counted }.
// A result is { height, reached, livesLost, perfects, landings } (the shape of a finished level run).
import { starsFor } from './stars.js';

// Balance numbers of the district (core-owned on purpose: pure data in, pure numbers out).
export const RESIDENTS_PER_FLOOR = { panel: 14, hotel: 11, office: 9, deco: 12, glass: 10, neon: 11 };
export const DEFAULT_RESIDENTS_PER_FLOOR = 10;
export const VIEW_BONUS = 0.2;            // +20 % residents for a tower that sees a landmark ...
export const VIEW_MIN_FLOORS = 10;        // ... once its upper floors reach this height
export const SKYLINE_BONUS = 0.15;        // +15 % residents for a tower whose neighbour differs clearly in height ...
export const SKYLINE_MIN_DIFF = 6;        // ... by at least this many floors
export const SKYLINE_RADIUS_M = 800;      // neighbours = towers of plots at most this far apart (metres)

export const emptyPlot = () => ({ stars: 0, bestHeight: 0, residents: 0, counted: false });
export const plotOf = (plots, id) => (plots && plots[id]) || emptyPlot();
const defOf = (district, id) => district.plots.find((p) => p.id === id) || null;

// Plot 0 is open; each next plot opens when the one before it counted. A plot that failed stays open to retry.
export function isPlotOpen(district, plots, id) {
  const i = district.plots.findIndex((p) => p.id === id);
  if (i < 0) return false;
  return i === 0 || plotOf(plots, district.plots[i - 1].id).counted;
}
// The open plot to play next: the first one that has not counted yet (null when all five counted).
export const nextPlot = (district, plots) => district.plots.find((p) => !plotOf(plots, p.id).counted) || null;

// A result counts when it reached the target and meets the plot's requirement.
export function resultCounts(plot, r) {
  if (!r || !r.reached) return false;
  const q = plot.require || {};
  if (q.maxLivesLost != null && r.livesLost > q.maxLivesLost) return false;
  if (q.minPerfectShare != null && !(r.landings > 0 && r.perfects / r.landings >= q.minPerfectShare)) return false;
  return true;
}
// Stars of a result: the old star rules, but only for a result that counts (an unmet requirement gives none).
export const plotStars = (plot, r) => (resultCounts(plot, r) ? starsFor(r) : 0);

function metres(a, b) {
  if (a.lat != null) {                      // real city: small-distance approximation
    const dy = (a.lat - b.lat) * 111320, dx = (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180);
    return Math.hypot(dx, dy);
  }
  return Math.hypot(a.x - b.x, a.z - b.z);  // Newtown: metres on its own grid
}
export const plotDistance = (a, b) => metres(a.site, b.site);

// Which bonuses a plot can earn (shown on the map before building): view needs a landmark in sight.
export const plotBonuses = (plot) => ({ view: (plot.landmarksInView || []).length > 0, viewMinFloors: VIEW_MIN_FLOORS, skyline: true, skylineMinDiff: SKYLINE_MIN_DIFF });

export function towerResidents(plot, floors, { view = false, skyline = false } = {}) {
  const base = floors * (RESIDENTS_PER_FLOOR[plot.buildingType] ?? DEFAULT_RESIDENTS_PER_FLOOR);
  return Math.round(base * (1 + (view ? VIEW_BONUS : 0) + (skyline ? SKYLINE_BONUS : 0)));
}

// The bonuses a built tower earns now: view by its own height, skyline by the counted towers around it.
export function towerBonuses(district, plots, id) {
  const plot = defOf(district, id), st = plotOf(plots, id);
  if (!plot || !st.counted) return { view: false, skyline: false };
  const view = plotBonuses(plot).view && st.bestHeight >= VIEW_MIN_FLOORS;
  const skyline = district.plots.some((o) => {
    if (o.id === id) return false;
    const os = plotOf(plots, o.id);
    return os.counted && plotDistance(plot, o) <= SKYLINE_RADIUS_M && Math.abs(os.bestHeight - st.bestHeight) >= SKYLINE_MIN_DIFF;
  });
  return { view, skyline };
}

// Residents of one plot now (0 until it counted).
export function plotResidents(district, plots, id) {
  const plot = defOf(district, id), st = plotOf(plots, id);
  return plot && st.counted ? towerResidents(plot, st.bestHeight, towerBonuses(district, plots, id)) : 0;
}

// Record a finished attempt on a plot (a failed one too: best height counts). Returns a new plots map;
// stars and best height only grow, counted never goes back, residents are recomputed for the whole district
// because a new tower can change its neighbours' skyline bonus.
export function recordPlot(district, plots, id, result) {
  const plot = defOf(district, id);
  if (!plot || !isPlotOpen(district, plots, id)) return { ...plots };
  const next = {};
  for (const p of district.plots) next[p.id] = { ...plotOf(plots, p.id) };
  const old = next[id];
  next[id] = {
    ...old,
    stars: Math.max(old.stars, plotStars(plot, result)),
    bestHeight: Math.max(old.bestHeight, result.height || 0),
    counted: old.counted || resultCounts(plot, result),
  };
  for (const p of district.plots) next[p.id].residents = plotResidents(district, next, p.id);
  return next;
}

export function districtTotals(district, plots) {
  let stars = 0, residents = 0, counted = 0;
  for (const p of district.plots) {
    const st = plotOf(plots, p.id);
    stars += st.stars; residents += plotResidents(district, plots, p.id); if (st.counted) counted++;
  }
  return { stars, maxStars: district.plots.length * 3, residents, goal: district.goal, counted, plots: district.plots.length };
}
// The residents goal opens the next city; building every plot is not required.
export const goalReached = (district, plots) => districtTotals(district, plots).residents >= district.goal;
