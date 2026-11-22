// Weather by floor. A level lists segments [{ fromFloor, kind }]; Endless on a level loops them with growing strength.
// With no level (plain Endless) the old global cycle of five phases is used. Pure functions, no Three.js.
import { WEATHER, phaseAt, PHASE_LEN, SEGMENT_LEN } from '../config.js';

const segsOf = (level) => (level && level.weather && level.weather.length ? level.weather : null);
const periodOf = (segs) => segs[segs.length - 1].fromFloor + SEGMENT_LEN;

// The weather at floor n: a weather table row plus idx, mult (strength) and seg (unique number per segment run).
export function weatherAt(level, n, loop = false) {
  const segs = segsOf(level);
  if (!segs) { const ph = phaseAt(n); return { ...ph, seg: Math.floor(n / PHASE_LEN) }; }
  const period = periodOf(segs), cyc = loop ? Math.floor(n / period) : 0, m = loop ? n % period : n;
  let idx = 0;
  for (let i = 0; i < segs.length; i++) if (segs[i].fromFloor <= m) idx = i;
  return { ...WEATHER[segs[idx].kind], idx, mult: 1 + 0.2 * cyc, seg: cyc * segs.length + idx };
}

// The next change after floor n: { at, left, wx } or null when the weather stays as it is.
export function nextWeather(level, n, loop = false) {
  const segs = segsOf(level);
  if (!segs) { const left = PHASE_LEN - (n % PHASE_LEN); return { at: n + left, left, wx: phaseAt(n + left) }; }
  const period = periodOf(segs), cyc = loop ? Math.floor(n / period) : 0, m = loop ? n % period : n;
  const j = segs.findIndex((s) => s.fromFloor > m);
  let at;
  if (j >= 0) at = cyc * period + segs[j].fromFloor;
  else if (loop) at = (cyc + 1) * period + segs[0].fromFloor;
  else return null;
  return { at, left: at - n, wx: weatherAt(level, at, loop) };
}
