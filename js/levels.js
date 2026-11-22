// Level definitions: one data entry per city, ordered by city size. Pure data, no Three.js or DOM.
// Only Kosice is built so far. The others carry id, name, country, order and target and are marked built: false.
// Fields marked "placeholder" hold a stand-in until the ticket that owns them lands.

export const LEVELS = [
  {
    id: 'kosice', city: 'Kosice', country: 'Slovakia', order: 1, target: 20, built: true,
    buildingType: 'panel',
    site: { lat: 48.7206, lon: 21.2578 },
    weather: [{ fromFloor: 0, kind: 'clear' }, { fromFloor: 10, kind: 'rain' }],
    events: [],
    dayArc: { start: 0.35, end: 0.5 },            // placeholder: fraction of a day, noon is 0.5
    palette: null,                                // placeholder
    track: null,                                  // placeholder
    landmarks: ['st-elisabeth', 'state-theatre', 'hlavna'],
    rings: { near: null, middle: null, far: null }, // placeholders
  },
  { id: 'prague', city: 'Prague', country: 'Czechia', order: 2, target: 30, built: false },
  { id: 'berlin', city: 'Berlin', country: 'Germany', order: 3, target: 40, built: false },
  { id: 'dubai', city: 'Dubai', country: 'United Arab Emirates', order: 4, target: 50, built: false },
  { id: 'new-york', city: 'New York', country: 'United States', order: 5, target: 60, built: false },
  { id: 'tokyo', city: 'Tokyo', country: 'Japan', order: 6, target: 75, built: false },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;
export const nextLevel = (id) => { const l = levelById(id); return l ? LEVELS.find((x) => x.order === l.order + 1) || null : null; };
