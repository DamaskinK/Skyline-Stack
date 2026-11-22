// Weather segments by floor and per-level events: only listed events happen, a warning always comes before the hit.
import { describe, it, expect, afterEach } from 'vitest';
import { Run } from '../../js/core/run.js';
import { weatherAt, nextWeather } from '../../js/core/weather.js';
import { LEVELS } from '../../js/levels.js';
import { CFG, DIFFICULTY, WEATHER } from '../../js/config.js';

const kosice = LEVELS[0];
const mk = (over) => ({ ...kosice, target: 999, ...over });

function play(level, { endless = false, seconds = 120, delay = 0.7 } = {}) {
  const run = new Run(DIFFICULTY.easy, { level, endless });
  const events = [];
  let hangT = 0;
  for (let i = 0; i < seconds / CFG.DT && !run.over; i++) {
    if (run.block && run.block.state === 'hang') { hangT += CFG.DT; if (hangT >= delay) { run.drop(); hangT = 0; } }
    run.step(CFG.DT);
    events.push(...run.drain());
  }
  return { run, events };
}
const types = (events) => events.map((e) => e.type);

describe('weather segments', () => {
  it('gives Kosice clear first, then rain from floor 10', () => {
    expect(weatherAt(kosice, 0).kind).toBe('clear');
    expect(weatherAt(kosice, 9).kind).toBe('clear');
    expect(weatherAt(kosice, 10).kind).toBe('rain');
    expect(weatherAt(kosice, 500).kind).toBe('rain');
    expect(weatherAt(kosice, 500).mult).toBe(1);
  });
  it('loops the segments in Endless with growing strength', () => {
    const period = 10 + 15;
    expect(weatherAt(kosice, period, true).kind).toBe('clear');
    expect(weatherAt(kosice, period, true).mult).toBeCloseTo(1.2);
    expect(weatherAt(kosice, 2 * period + 12, true)).toMatchObject({ kind: 'rain', mult: 1.4 });
    expect(weatherAt(kosice, period, true).seg).not.toBe(weatherAt(kosice, period - 1, true).seg);
  });
  it('reports the next change, or none when the weather stays', () => {
    expect(nextWeather(kosice, 4)).toMatchObject({ at: 10, left: 6, wx: { kind: 'rain' } });
    expect(nextWeather(kosice, 12)).toBe(null);
    expect(nextWeather(kosice, 12, true)).toMatchObject({ at: 25, left: 13, wx: { kind: 'clear' } });
  });
  it('keeps the old global cycle when there is no level', () => {
    expect(weatherAt(null, 0).kind).toBe('clear');
    expect(weatherAt(null, 15).kind).toBe('rain');
    expect(nextWeather(null, 3)).toMatchObject({ left: 12 });
  });
  it('has friction, wind and visibility for the new kinds', () => {
    for (const k of ['heatHaze', 'sandstorm', 'typhoon']) {
      const w = WEATHER[k];
      expect(w.mu).toBeGreaterThan(0); expect(w.base).toBeGreaterThan(0); expect(w.fog[1]).toBeGreaterThan(w.fog[0]);
    }
    expect(WEATHER.sandstorm.fog[1]).toBeLessThan(WEATHER.clear.fog[1]);
  });
  it('emits a weather event when the run crosses a segment', () => {
    const { run, events } = play(mk({ weather: [{ fromFloor: 0, kind: 'clear' }, { fromFloor: 2, kind: 'rain' }] }), { seconds: 40 });
    const w = events.find((e) => e.type === 'weather');
    expect(w).toMatchObject({ floor: 2, kind: 'rain' });
    expect(run.wx.kind).toBe('rain');
  });
});

describe('events per level', () => {
  const storm = [{ fromFloor: 0, kind: 'storm' }];
  const quakeEvery = CFG.quakeEvery;
  afterEach(() => { CFG.quakeEvery = quakeEvery; });

  it('plays Kosice with no lightning and no earthquake', () => {
    CFG.quakeEvery = 3;
    const { run, events } = play(kosice, { seconds: 150, delay: 0.7 });
    expect(run.tower.n + 0).toBeGreaterThanOrEqual(4);
    const t = new Set(types(events));
    for (const x of ['lightning', 'lightningWarning', 'quake', 'quakeWarning', 'gust', 'gustWarning']) expect(t.has(x)).toBe(false);
  });
  it('emits lightning only when the level lists it, warning first', () => {
    const none = play(mk({ weather: storm, events: [] }), { seconds: 60 }).events;
    expect(types(none).some((x) => x.startsWith('lightning'))).toBe(false);
    const ev = play(mk({ weather: storm, events: ['lightning'] }), { seconds: 60 }).events.filter((e) => e.type.startsWith('lightning'));
    expect(ev.length).toBeGreaterThanOrEqual(2);
    ev.forEach((e, i) => expect(e.type).toBe(i % 2 === 0 ? 'lightningWarning' : 'lightning'));
  });
  it('emits earthquakes only when the level lists them, warning first', () => {
    CFG.quakeEvery = 3;
    const none = play(mk({ weather: [{ fromFloor: 0, kind: 'clear' }], events: [] }), { seconds: 100 }).events;
    expect(types(none).some((x) => x.startsWith('quake'))).toBe(false);
    const ev = play(mk({ weather: [{ fromFloor: 0, kind: 'clear' }], events: ['quake'] }), { seconds: 100 }).events.filter((e) => e.type.startsWith('quake'));
    expect(ev.some((e) => e.type === 'quake')).toBe(true);
    const first = ev.findIndex((e) => e.type === 'quake');
    expect(ev.slice(0, first).some((e) => e.type === 'quakeWarning')).toBe(true);
  });
  it('emits sandstorm gusts only in a sandstorm and only when listed', () => {
    const sand = [{ fromFloor: 0, kind: 'sandstorm' }];
    expect(types(play(mk({ weather: sand, events: [] }), { seconds: 40 }).events).some((x) => x.startsWith('gust'))).toBe(false);
    expect(types(play(mk({ weather: [{ fromFloor: 0, kind: 'clear' }], events: ['sandstormGust'] }), { seconds: 40 }).events).some((x) => x.startsWith('gust'))).toBe(false);
    const ev = play(mk({ weather: sand, events: ['sandstormGust'] }), { seconds: 40 }).events.filter((e) => e.type.startsWith('gust'));
    expect(ev.length).toBeGreaterThanOrEqual(2);
    ev.forEach((e, i) => expect(e.type).toBe(i % 2 === 0 ? 'gustWarning' : 'gust'));
  });
  it('keeps the old quake rule for plain Endless without a level', () => {
    CFG.quakeEvery = 3;
    const ev = play(null, { seconds: 100 }).events;
    expect(types(ev)).toContain('quake');
  });
  it('is deterministic with segments and events', () => {
    const lv = mk({ weather: storm, events: ['lightning'] });
    expect(JSON.stringify(play(lv, { seconds: 30 }).events)).toBe(JSON.stringify(play(lv, { seconds: 30 }).events));
  });
});
