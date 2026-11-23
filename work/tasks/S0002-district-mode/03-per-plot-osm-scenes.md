# 03: A scene for every plot from its own OpenStreetMap extract

**What to build:** the OSM script writes one compact extract per plot (~150-200 m radius around its site); the near ring
builds around the plot being played; the middle and far rings stay per city and are offset correctly for each plot.

**Blocked by:** 01, S0001 ticket 38

**Type:** feature
**Status:** done
**Read:** plan "Scenes"; S0001 tickets 12, 13, 34, 38 Comments.

- [x] Five Kosice plot extracts generated and committed; ODbL credit kept; total ~2-3 MB. (645 KB: 500 m square per plot, smaller than the guess)
- [x] Loading a plot shows its real streets: panel estate on the outskirts plot, baroque around the centre plots.
- [x] Landmarks and the far ring sit at their real bearing/distance from each plot.
- [ ] Perf at 2560x1440 DPR 2 on High within the ticket 35 budget (done, all plots 60 fps); flicker passes (plot 1 marginal, see Comments); screenshots per plot (done).

## Comments
- `node scripts/build-osm-level.mjs kosice plots` (one Overpass query for all five boxes, mirrors with backoff, `OSM_RAW=<file>` cache) writes `assets/levels/kosice/plots/<plotId>.json`, 500 m square around each plot site (108-147 KB each, 645 KB total),
  origin = plot site, so `buildNearRing` needed no change except one rule: blocks tagged flats / 5+ levels (new `a` and `lv` fields) get the plain panel look (Terasa now shows its real estate slabs). The big `osm.json` stays for the current run flow (ticket 04 switches).
- Per plot: `game.loadPlot(cityId, plotId, onProgress)` (js/game.js) fetches the extract (`loadPlotExtract` in assets.js) and calls `applyLevelAssets(id, assets, plot, osm)` (level-scene.js). The middle/far ring is built in the city frame and the group is moved by
  `plotOffset` (metres from the city site to the plot); terrain is flattened round the plot (330-1100 m blend) so hills never poke through the near ring; the middle ring skips a 285 m square round the plot and circles round the landmarks; landmarks are shifted by the same offset
  (cathedral GLB seen at the right bearing from Kulturpark, north, 741 m: `tests/browser/out-s2-03/bearing/`). Debug: `__debug.loadPlot(n)` (n = 0-4); `check.mjs ... --plot N`.
- Changed ticket 01 data: Hlavna plot site moved 40 m south (48.71952, 21.25860). The first pick had the default camera inside the cathedral model (washed-out, grey/sepia screen); ticket 01 data and the map screen positions follow `levels.js`, so nothing else changed.
- Numbers (High, 2560x1440 DPR 2, p90 16.7 ms, 60 fps on all five): draw calls 670 / 684 / 661 / 678 / 689, triangles 4.1M (Terasa, many trees) / 3.5M / 3.3M / 2.1M / 2.2M (the current default Kosice scene: 696 calls, 2.4M). Low: 186-201 calls, 0.45-0.54M triangles, 60 fps. `npm test` 70 passed, no console errors. Flicker: all pass except plot 1 (Juzna) `game` pose depth 1.01-1.13% (limit 1%; Low `low` pose 0.76-1.01%, varies run to run): changed pixels sit on window edges of tall blocks next to the camera, not on depth fighting.
- Screenshots: `tests/browser/out-s2-03/` (`kosice-p<N>-high-start.png` per plot, `hd/` 2560x1440 DPR 2 sets, `low/`).
- Open: the flicker box is left unticked for plot 1. Terasa is on the edge of the generated middle ring (fields to its west, as the real river side); the middle ring itself is still the same procedural city. The middle-ring gap between 250 m and 285 m shows plain ground.
