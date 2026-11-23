// Balance bot: plays a Run through its public input only (drop) with seeded aim error and reaction jitter,
// so the same seed gives the same result. Used by the balance tests to measure a district, never by the game.
import { Run } from './run.js';
import { CFG, DIFFICULTY } from '../config.js';
import { recordPlot, plotOf, goalReached } from './district.js';
import type { Difficulty, District, Level, Plot, PlotResult, PlotStates } from '../types.js';

export type SkillId = 'sloppy' | 'average' | 'good';
// aim: sigma of the intended drop offset (fraction of block width); jitter: reaction time spread (s);
// zWait: the bot also waits for the sideways swing to be this close (fraction of W) when it exists.
export const SKILLS: Record<SkillId, { aim: number; jitter: number; zWait: number }> = {
  sloppy:  { aim: 0.13, jitter: 0.09, zWait: 0.45 },
  average: { aim: 0.09, jitter: 0.06, zWait: 0.30 },
  good:    { aim: 0.04, jitter: 0.03, zWait: 0.18 },
};
const LEAD_S = 0.175;     // the block keeps the hook speed while it falls: aim this many seconds ahead of the crossing (calibrated)

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

// The level-shaped definition the game builds for a plot (see Game.startPlot).
export const plotLevel = (city: Level, plot: Plot): Level => ({ ...city, target: plot.target, weather: plot.weather, buildingType: plot.buildingType, events: [] });

export function playPlot(city: Level, plot: Plot, skill: SkillId, seed: number, diff: Difficulty = DIFFICULTY.normal, maxSeconds = 600): PlotResult & { stars: number } {
  const run = new Run(diff, { level: plotLevel(city, plot), endless: false, windScale: plot.windScale });
  const S = SKILLS[skill], rnd = mulberry32(seed);
  let aim = 0, lastD: number | null = null, waitedFor = -1, dropAt = -1;
  for (let i = 0; i < maxSeconds / CFG.DT && !run.over; i++) {
    const b = run.block, h = run.hook;
    if (b && b.state === 'hang' && h) {
      if (waitedFor !== run.drops) { waitedFor = run.drops; aim = gauss(rnd) * S.aim * CFG.W; lastD = null; dropAt = -1; }
      const top = run.tower.n ? run.tower.top() : { x: run.tower.bx, z: run.tower.bz };
      const d = h.x + h.vx * LEAD_S - (top.x + aim);
      if (dropAt < 0 && lastD !== null && Math.sign(d) !== Math.sign(lastD) && Math.abs(h.z - top.z) <= Math.max(S.zWait * CFG.W, 0)) {
        dropAt = run.t + rnd() * S.jitter;
      }
      lastD = d;
      if (dropAt >= 0 && run.t >= dropAt) run.drop();
    }
    run.step(CFG.DT); run.drain();
  }
  const r = run.result;
  const res = { height: r ? r.floors : run.bestHeight, reached: !!(r && r.completed), livesLost: r ? r.livesLost : diff.lives, perfects: run.perfects, landings: run.landings, stars: r ? r.stars : 0 };
  return res;
}

// A whole district campaign: plots in order, up to `attempts` tries each (a failed plot stays open), results recorded
// through the district rules. Returns the plots map, the attempts used per plot and the plot at which the goal opened.
export function playDistrict(city: Level, skill: SkillId, seed: number, attempts = 4): { plots: PlotStates; tries: number[]; goalAtPlot: number | null } {
  const district = city.district as District;
  let plots: PlotStates = {}, goalAtPlot: number | null = null;
  const tries: number[] = [];
  district.plots.forEach((plot, i) => {
    let n = 0;
    while (n < attempts && !plotOf(plots, plot.id).counted) { plots = recordPlot(district, plots, plot.id, playPlot(city, plot, skill, seed * 131 + i * 17 + n)); n++; }
    tries.push(n);
    if (goalAtPlot === null && goalReached(district, plots)) goalAtPlot = i + 1;
  });
  return { plots, tries, goalAtPlot };
}
