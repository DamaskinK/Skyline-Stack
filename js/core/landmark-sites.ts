// Footprints of the hand-built Kosice landmark models (js/landmarks/kosice.ts) as plain data, in the frame of the city (x east, z south, origin = the build site of plot 4),
// so the placement plan (js/core/placement.ts) keeps every tree, bench, stall, musician, car and street away from them. They are the convex hulls of the first LOD of each model
// (read back with `__debug.landmarkHulls()` on plot 4); if a model or its spot in kosice.ts changes, read them again. Flat [x, z, x, z ...] rings.
export const KOSICE_LANDMARKS: Record<string, number[]> = {
  'st-elisabeth': [15.5, 59.5, 28.3, 59.5, 50.6, 59.7, 61.5, 59.8, 75, 74.9, 77.4, 78.1, 77.8, 79.4, 77.8, 83.4, 77.4, 84.7, 75, 87.9, 67.4, 98.3, 61.5, 103, 50.6, 103.1, 28.3, 103.2, 15.5, 103.2],
  'st-urban': [32.2, 33.2, 47.9, 27, 53.8, 42.2, 38.1, 48.4],
  'st-michael-chapel': [50.8, 114.3, 54.2, 113.6, 69.4, 113.1, 72.8, 115.7, 74.1, 119.8, 72.6, 123.9, 65, 127.3, 57.4, 129, 54.1, 129.7, 51, 116.3],
  'state-theatre': [-37.1, -91.4, -34.1, -104.6, -14.1, -111, -4, -102.1, 8.2, -64.9, 0.7, -58.9, -15.3, -53.7, -24.9, -54.1],
  'fountain': [-5.4, -29.2, -4.5, -29.5, 6.5, -33.2, 7.3, -33.5, 15.2, -10, 3.3, -6, 2.5, -5.7],
  'immaculata': [-58.7, -200.5, -56.6, -202.6, -53.6, -202.6, -51.5, -200.5, -51.5, -197.5, -53.6, -195.4, -56.6, -195.4, -58.7, -197.5],
};
/** The rings of a city's landmarks in the frame of a plot whose site lies (off.x, off.z) from the city origin. */
export const landmarkRings = (id: string, off: { x: number; z: number }): number[][] => {
  const set = id === 'kosice' ? KOSICE_LANDMARKS : {};
  return Object.values(set).map((r) => r.map((v, i) => v - (i % 2 ? off.z : off.x)));
};
