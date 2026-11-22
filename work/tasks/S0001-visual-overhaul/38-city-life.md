# 38: A living city: street furniture, bike lanes, cyclists, varied people

**What to build:** the Kosice streets feel lived in (developer, 2026-11-22: "liven up the city: benches, bins, bike
lanes, cyclists, different people").

**Blocked by:** 34, 36

**Type:** feature
**Status:** done

- [x] Street furniture placed along OSM footways and the square: benches, bins, bike racks, bollards, planters, kiosks,
      tram/bus stops, street signs; CC0 kit pieces (KayKit / Kenney / Quaternius) or own low-poly; instanced.
- [x] Bike lanes: OSM `cycleway` tags (and `highway=cycleway`) drawn as coloured lanes with markings; if the data has
      few, mark lanes on the main streets.
- [x] Cyclists ride along bike lanes and quiet streets (low-poly rider on a bike, pedalling), people from ticket 36
      walk, sit on benches, stand in small groups, walk dogs; density by quality preset.
- [ ] Optional if cheap: a tram line on Hlavna (Kosice has trams).
- [x] Draw calls and frame time stay within ticket 35's budget; screenshots close to the square.

## Comments
- New `js/street-life.js` (called from `buildNearRing`): own low-poly furniture, merged and instanced (bins, bollards, bike racks, planters, 4 kiosks, bus
  stops, street signs) plus the KayKit bench kit (91 benches), placed along OSM footways, clear of buildings, basins, plaza and bike lanes.
  No new external assets, so nothing new in CREDITS.md.
- Bike lanes: red surface with white dashes. `scripts/build-osm-level.mjs` now tags roads `bike` (2 = cycleway, 1 = cycle lane on a street). A fresh Overpass
  fetch differs from the stored data (OSM changed), so `osm.json` was NOT regenerated: only the 5 `highway=cycleway` ways were appended to it. The data has
  no street cycle tags, so lanes (both sides, one per travel direction) are drawn on the 5 nearest main streets.
- People (`js/fx.js`, `js/people/figure.js`): `buildFigure` got a `sit` pose; benches seat up to 8 people (3 on Low), 7 (3) standing pairs near kiosks and planters,
  up to 3 dog walkers (1), 7 cyclists (3) riding the bike lanes, legs pedalling. Life data reaches People through `walkRoutes.life` (no change in level-scene.js).
- Basin fix: People get the fountain/pool outlines and turn around 1.2 m before a rim (plaza loop and street routes); walkers that spawn inside step out.
  Simulated 6000 steps x 26 walkers: 0 samples inside a basin.
- Checks: npm test 48 passed; High all PASS (flicker max 0.59%, 60 fps, 674 draw calls vs 598 before), Low all PASS (196 draw calls), perf at 2560x1440 DPR 2:
  p90 16.7 ms, 60 fps, 680 draw calls; console clean. Close-up screenshots in tests/browser/out38.
- Open: the optional tram line was not built (the stored data has no tram rails); one cycleway crosses the plaza edge near the origin (real data).
