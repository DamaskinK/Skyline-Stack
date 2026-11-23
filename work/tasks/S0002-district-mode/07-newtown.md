# 07: Newtown, the fictional city

**What to build:** the original procedural city returns as Newtown: open from the start, outside the world map route,
with Endless and its own five-plot district on its grid, using the improved look of S0001 (ground, people, life).

**Blocked by:** 01, 04

**Type:** feature
**Status:** done
**Read:** plan "Newtown"; `js/world.js` nearProc.

- [x] Newtown selectable from the start; Endless and district both work.
- [x] Its plots and a fictional landmark or two of our own design (no real or copied buildings).
- [x] Screenshots; perf and flicker pass.

## Comments
- Newtown plays from the menu: NEW GAME has "ENDLESS - KOSICE / NEWTOWN" cards (`data-endless`) and a Newtown district card; Play is enabled on its map. `game.loadPlot('newtown', id)` builds no extract: the procedural city (`js/world.js`) is moved by minus the plot site (`setProcOffset`: ground, blocks, trees, lamps, backdrop, cars), the site stays at the world origin; people get the grid roads as routes in the shifted frame (`procRoutes` in `js/level-scene.js`). Plot sites moved slightly (data): plaza plot is now the real plaza (0,0), where Endless also runs; other sites nudged off the roads. `plotOffset` and `district-towers` handle x/z sites, so finished towers stand on their plots.
- Look: vegetation from `js/vegetation.js` (trees with sway, hedge rows, flower beds), asphalt and cobble normal maps (`js/surfaces.js`) on roads and plaza, paved pads under the plots, parkland trees round each plot, blocks kept clear of plots and landmarks (own clearance, random stream kept).
- Landmarks, our own invented designs, plain Three.js geometry (`js/landmarks/newtown.js`, no Blender, no external assets): Meridian Clock Tower (square shaft, glass bands, cantilevered crown with four canvas clock faces, spire; windows and faces glow at night) at (-72,-62), Lantern Bridge (footbridge with ramps and a steel arch over the east ring road, warm lanterns) at (44,-112). They feed the view bonus (`landmarksInView`, names in `js/district-map.js`).
- Tidy: osm.json removed from the Kosice manifest and the file deleted; `sLevelDone`, `ui.levelDone`, its buttons and the game.js level branch removed. `NEWTOWN.weather` now clear then rain at 10 for Endless. New `assets/levels/newtown/manifest.json` reuses the Kosice sky HDRI (no new asset, CREDITS unchanged). `check.mjs` got `--level newtown --plot N` (clicks the Endless card); new `tests/browser/newtown-run.mjs`.
- Numbers (1280x720): High 60 fps, p90 16.7 ms, 1397 draw calls (many separate procedural blocks), 0.3M triangles; Low 60 fps, 610 calls; flicker depth/shadow pass on both (game pose 0.51 %), no console errors. Kosice `check.mjs all` High and `plot-run.mjs` still pass. `npm test` 72 passed. `newtown-run.mjs` High and Low all PASS (plots 1, 2, 5 played, results saved, finished tower of plot 1 seen on plot 2, goal text, Endless).
- Screenshots: `tests/browser/out-s2-07/`.
- Open: ADR 0004 asks to drop Berlin, Dubai and New York from `levels.js`; not done here because tests (`district.test.js` expects 6 levels, `levels.test.js` uses berlin) and `js/music.js`/`js/people/styles.js` data would change. Newtown has no own music (falls back to the chiptune loop). Procedural blocks near the edge plot are tall (original generator).
