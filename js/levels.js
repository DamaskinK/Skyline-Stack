// Level definitions: one data entry per city, ordered by city size. Pure data, no Three.js or DOM.
// Only Kosice is built so far. The others carry id, name, country, order and target and are marked built: false.
// Fields marked "placeholder" hold a stand-in until the ticket that owns them lands.

export const LEVELS = [
  {
    id: 'kosice', city: 'Kosice', country: 'Slovakia', order: 1, target: 20, built: true,
    buildingType: 'panel',
    site: { lat: 48.72100, lon: 21.25755 },
    weather: [{ fromFloor: 0, kind: 'clear' }, { fromFloor: 10, kind: 'rain' }],
    events: [],                                   // only listed events ever happen: 'lightning', 'quake', 'sandstormGust'
    dayArc: { start: 16.5, end: 20.5 },           // hours: late afternoon to just after sunset (sunset is 19.5 everywhere)
    grade: { gain: [1.04, 1.0, 0.95], lift: [0, 0.005, 0.02], contrast: 1.08, saturation: 1.1, vignette: 0.24 },   // warm, a little blue in the shadows
    palette: null,                                // placeholder
    track: null,                                  // placeholder
    landmarks: ['st-elisabeth', 'state-theatre', 'hlavna'],
    rings: { near: null, middle: null, far: null }, // placeholders
  },
  { id: 'prague', city: 'Prague', country: 'Czechia', order: 2, target: 30, built: false, dayArc: { start: 14.5, end: 20 },
    grade: { gain: [1.03, 1.0, 0.96], contrast: 1.07, saturation: 1.06 } },
  { id: 'berlin', city: 'Berlin', country: 'Germany', order: 3, target: 40, built: false, dayArc: { start: 9, end: 13 },
    grade: { gain: [0.97, 0.99, 1.02], contrast: 1.04, saturation: 0.92 } },
  { id: 'dubai', city: 'Dubai', country: 'United Arab Emirates', order: 4, target: 50, built: false, dayArc: { start: 12, end: 19.2 },
    grade: { gain: [1.05, 1.0, 0.93], contrast: 1.1, saturation: 1.12 } },
  { id: 'new-york', city: 'New York', country: 'United States', order: 5, target: 60, built: false, dayArc: { start: 15.5, end: 21.5 },
    grade: { gain: [1.0, 1.0, 1.02], contrast: 1.1, saturation: 1.05, vignette: 0.28 } },
  { id: 'tokyo', city: 'Tokyo', country: 'Japan', order: 6, target: 75, built: false, dayArc: { start: 17.5, end: 22 },
    grade: { gain: [1.0, 0.98, 1.05], lift: [0.01, 0, 0.025], contrast: 1.1, saturation: 1.12, vignette: 0.28 } },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;
export const nextLevel = (id) => { const l = levelById(id); return l ? LEVELS.find((x) => x.order === l.order + 1) || null : null; };
