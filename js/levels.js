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
    // District mode (S0002): five plots from the outskirts panel estate to the cathedral. Sites are OpenStreetMap
    // open spaces (parking lots, a park), picked 2026-11-22 from Overpass queries. goal = residents that open the next city.
    district: {
      goal: 800,
      plots: [
        { id: 'terasa', name: 'Terasa estate', site: { lat: 48.71874, lon: 21.24033 }, buildingType: 'panel', target: 12, require: {},
          windScale: 0.8, weather: [{ fromFloor: 0, kind: 'clear' }], landmarksInView: [] },     // car park between the estate blocks and the pitches
        { id: 'juzna', name: 'Juzna trieda', site: { lat: 48.71440, lon: 21.24912 }, buildingType: 'panel', target: 15, require: {},
          windScale: 0.9, weather: [{ fromFloor: 0, kind: 'clear' }, { fromFloor: 8, kind: 'rain' }], landmarksInView: [] },   // car park on the way in, south-west of the old town
        { id: 'kulturpark', name: 'Kulturpark', site: { lat: 48.71373, lon: 21.25634 }, buildingType: 'hotel', target: 18, require: { maxLivesLost: 2 },
          windScale: 1.0, weather: [{ fromFloor: 0, kind: 'clear' }, { fromFloor: 9, kind: 'rain' }], landmarksInView: ['st-elisabeth'] },   // edge of the old barracks park, cathedral 600 m north
        { id: 'hlavna-south', name: 'Hlavna street', site: { lat: 48.71952, lon: 21.25860 }, buildingType: 'office', target: 22, require: { maxLivesLost: 2 },
          windScale: 1.1, weather: [{ fromFloor: 0, kind: 'rain' }, { fromFloor: 12, kind: 'clear' }], landmarksInView: ['st-elisabeth', 'state-theatre'] },   // south end of the main street, 40 m south of the first pick so the camera never sits inside the cathedral model (S0002 03)
        { id: 'cathedral', name: 'Cathedral square', site: { lat: 48.72100, lon: 21.25755 }, buildingType: 'deco', target: 26, require: { minPerfectShare: 0.4 },
          windScale: 1.25, weather: [{ fromFloor: 0, kind: 'clear' }, { fromFloor: 10, kind: 'rain' }, { fromFloor: 18, kind: 'rain' }], landmarksInView: ['st-elisabeth', 'state-theatre', 'hlavna'] },   // today's site
      ],
    },
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

// Newtown: the original fictional city of the first version, a seventh city outside the world map, open from the start.
// Not part of LEVELS (order, nextLevel and the world map stay six real cities). Plot sites are {x, z} metres on its
// procedural grid (origin = plaza, x east, z south); a later ticket may nudge them to match the ring roads.
export const NEWTOWN = {
  id: 'newtown', city: 'Newtown', country: 'Fiction', fictional: true, openFromStart: true, built: true,
  buildingType: 'panel', target: 20, site: { x: 0, z: 0 }, weather: [{ fromFloor: 0, kind: 'clear' }], events: [],
  dayArc: { start: 16.5, end: 20.5 },
  grade: { gain: [1.0, 1.0, 1.0], contrast: 1.05, saturation: 1.05 },
  district: {
    goal: 800,
    plots: [
      { id: 'edge', name: 'Edge estate', site: { x: -170, z: 150 }, buildingType: 'panel', target: 12, require: {}, windScale: 0.8, weather: [{ fromFloor: 0, kind: 'clear' }], landmarksInView: [] },
      { id: 'park-row', name: 'Park row', site: { x: 130, z: 140 }, buildingType: 'panel', target: 15, require: {}, windScale: 0.9, weather: [{ fromFloor: 0, kind: 'clear' }, { fromFloor: 8, kind: 'rain' }], landmarksInView: [] },
      { id: 'outer-ring', name: 'Outer ring', site: { x: -110, z: -80 }, buildingType: 'hotel', target: 18, require: { maxLivesLost: 2 }, windScale: 1.0, weather: [{ fromFloor: 0, kind: 'clear' }, { fromFloor: 9, kind: 'rain' }], landmarksInView: ['plaza'] },
      { id: 'inner-ring', name: 'Inner ring', site: { x: 80, z: -70 }, buildingType: 'office', target: 22, require: { maxLivesLost: 2 }, windScale: 1.1, weather: [{ fromFloor: 0, kind: 'rain' }, { fromFloor: 12, kind: 'clear' }], landmarksInView: ['plaza'] },
      { id: 'plaza', name: 'Plaza', site: { x: 0, z: 70 }, buildingType: 'glass', target: 26, require: { minPerfectShare: 0.4 }, windScale: 1.25, weather: [{ fromFloor: 0, kind: 'clear' }, { fromFloor: 10, kind: 'rain' }], landmarksInView: ['plaza'] },
    ],
  },
};

// Every city that has a district: the six real ones and Newtown.
export const DISTRICT_CITIES = [...LEVELS.filter((l) => l.district), NEWTOWN];
export const cityById = (id) => DISTRICT_CITIES.find((c) => c.id === id) || levelById(id);
