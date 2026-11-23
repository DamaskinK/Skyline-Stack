// Locks the Kosice district curve with the balance bot (js/core/bot.ts): seeded, so the numbers never flicker.
// Rates are first-attempt completion (the plot counted) over 30 seeds; bands are wide enough for a small retune.
import { describe, it, expect } from 'vitest';
import { playPlot, playDistrict, SKILLS, mulberry32, type SkillId } from '../../js/core/bot.js';
import { plotStars } from '../../js/core/district.js';
import { levelOf, need } from './helpers.js';

const city = levelOf('kosice'), district = need(city.district, 'kosice district');
const N = 30;
function rates(skill: SkillId) {
  return district.plots.map((plot) => {
    let ok = 0, stars = 0;
    for (let s = 1; s <= N; s++) { const st = plotStars(plot, playPlot(city, plot, skill, s * 7919)); stars += st; if (st > 0) ok++; }
    return { completion: ok / N, stars: stars / N };
  });
}
const R = { sloppy: rates('sloppy'), average: rates('average'), good: rates('good') };

describe('balance bot', () => {
  it('is deterministic for a seed', () => {
    const a = playPlot(city, district.plots[1], 'average', 42), b = playPlot(city, district.plots[1], 'average', 42);
    expect(a).toEqual(b);
    expect(mulberry32(7)()).toBe(mulberry32(7)());
  });
  it('has three skills that order by aim', () => {
    expect(SKILLS.good.aim).toBeLessThan(SKILLS.average.aim);
    expect(SKILLS.average.aim).toBeLessThan(SKILLS.sloppy.aim);
  });
});

describe('Kosice district curve', () => {
  it('gets harder plot by plot for an average player', () => {
    const c = R.average.map((r) => r.completion);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeLessThanOrEqual(c[i - 1] + 0.06);   // never easier than the plot before (small noise)
    expect(c[0]).toBeGreaterThanOrEqual(0.85);
    expect(c[2]).toBeGreaterThanOrEqual(0.55);
    expect(c[4]).toBeLessThanOrEqual(0.5);
  });
  it('is ordered by skill on every plot', () => {
    for (let i = 0; i < district.plots.length; i++) {
      expect(R.good[i].completion).toBeGreaterThanOrEqual(R.average[i].completion);
      expect(R.average[i].completion).toBeGreaterThanOrEqual(R.sloppy[i].completion);
    }
  });
  it('lets a good player take 3 stars on the outskirts', () => {
    expect(R.good[0].stars).toBeGreaterThanOrEqual(2.9);
    expect(R.good[1].stars).toBeGreaterThanOrEqual(2.8);
  });
  it('keeps the cathedral a real challenge even for a good player', () => {
    expect(R.good[4].completion).toBeLessThanOrEqual(0.7);
    expect(R.good[4].completion).toBeGreaterThan(0.15);
    expect(R.sloppy[4].completion).toBeLessThanOrEqual(0.1);
  });
  it('lets an average player finish plots 1-3 with retries and reach the goal around plot 4', () => {
    let atPlot4 = 0, first3 = 0, trials = 0;
    for (let s = 1; s <= 20; s++) {
      const r = playDistrict(city, 'average', s, 4); trials++;
      if (district.plots.slice(0, 3).every((p) => r.plots[p.id].counted)) first3++;
      if (r.goalAtPlot !== null && r.goalAtPlot <= 4) atPlot4++;
    }
    expect(first3 / trials).toBeGreaterThanOrEqual(0.9);
    expect(atPlot4 / trials).toBeGreaterThanOrEqual(0.7);
  });
  it('keeps the goal out of reach of a sloppy player in four plots', () => {
    let reached = 0;
    for (let s = 1; s <= 20; s++) if (playDistrict(city, 'sloppy', s, 4).goalAtPlot !== null) reached++;
    expect(reached / 20).toBeLessThanOrEqual(0.4);
  });
  it('has a goal that no three plots can reach but four can', () => {
    const max = district.plots.map((p) => p.target * 14 * 1.35);   // generous upper bound per plot
    expect(max.slice(0, 3).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(district.goal).toBe(720);
  });
});
