// Star rules and level progress as pure functions, so they run in Node tests. No storage here (see js/settings.js).
// Stars add up: 1 = target reached, +1 = at most one life lost, +1 = at least half the landings perfect.

export const PERFECT_SHARE = 0.5;
export const MAX_LIVES_LOST_FOR_STAR = 1;

export function starsFor({ reached, livesLost, perfects, landings }) {
  if (!reached) return 0;
  let s = 1;
  if (livesLost <= MAX_LIVES_LOST_FOR_STAR) s++;
  if (landings > 0 && perfects / landings >= PERFECT_SHARE) s++;
  return s;
}

export const emptyProgress = () => ({ v: 1, levels: {}, opened: [], endless: {} });

// Normalise whatever was read from storage; anything that is not a version-1 progress object is dropped.
export function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return emptyProgress();
  const p = emptyProgress();
  if (raw.levels && typeof raw.levels === 'object') for (const [k, v] of Object.entries(raw.levels)) if (v && Number.isFinite(v.stars) && Number.isFinite(v.bestHeight)) p.levels[k] = { stars: v.stars, bestHeight: v.bestHeight };
  if (Array.isArray(raw.opened)) p.opened = raw.opened.filter((x) => typeof x === 'string');
  if (raw.endless && typeof raw.endless === 'object') for (const [k, v] of Object.entries(raw.endless)) if (Array.isArray(v)) p.endless[k] = v;
  return p;
}

// The first level is always open; a level opens when the one before it has at least one star.
export function isOpen(progress, levels, id) {
  const i = levels.findIndex((l) => l.id === id);
  if (i < 0) return false;
  if (i === 0) return true;
  return progress.opened.includes(id) || (progress.levels[levels[i - 1].id]?.stars || 0) >= 1;
}

// Record a finished level attempt (also a failed one: best height counts). Returns a new progress object.
export function recordLevel(progress, levels, id, { stars, height }) {
  const p = sanitize(JSON.parse(JSON.stringify(progress)));
  const old = p.levels[id] || { stars: 0, bestHeight: 0 };
  p.levels[id] = { stars: Math.max(old.stars, stars), bestHeight: Math.max(old.bestHeight, height) };
  if (stars >= 1) {
    const i = levels.findIndex((l) => l.id === id), next = levels[i + 1];
    if (next && !p.opened.includes(next.id)) p.opened.push(next.id);
  }
  return p;
}

export function recordEndless(progress, cityId, entry, keep = 10) {
  const p = sanitize(JSON.parse(JSON.stringify(progress)));
  const list = [...(p.endless[cityId] || []), entry].sort((a, b) => b.score - a.score).slice(0, keep);
  p.endless[cityId] = list;
  return p;
}
