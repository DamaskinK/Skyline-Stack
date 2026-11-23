# 04: Play a plot end to end; finished towers stay in the city

**What to build:** starting a plot runs a tower with the plot's type, target, requirement, wind and weather; the result
counts or not, stars and residents (with bonuses) are saved; finished towers stand at their plot positions in later
runs (real model in the loaded rings, simple instanced tower further away) and the result screen shows the district
progress and whether the next city opened.

**Blocked by:** 01, 02, 03

**Type:** feature
**Status:** done
**Read:** plan Solution, user stories 9-18.

- [x] Requirement shown during the run (HUD) and on the result screen (counted / not counted and why).
- [x] Finished towers visible from other plots; crowns from S0001 ticket 39.
- [x] Next city opens at the goal; replays keep the best.
- [x] Core and browser checks pass.

## Comments
- Play on the map calls `game.loadPlot` then `game.startPlot(city, plot)` (js/game.js): Run gets the plot's type, target, weather and a new `windScale` option (core, 2 new tests; run result also carries `livesLost`). The HUD shows the requirement live (`#hReq`: lives lost, perfect share, red when broken). The old Kosice level card is gone from NEW GAME; districts are played from their cards, and Endless / START now runs on the centre plot (cathedral extract) instead of osm.json (`osm.json` still in the manifest, unused by this flow).
- Result screen `#sPlot`: COUNTED / NOT COUNTED with the reason, stars, height, perfects, lives lost, residents and bonuses, residents bar and plots built, and "Next city opened: Prague" when the goal is reached. Results go through `saveDistrictResult` (best kept, counted never lost). DISTRICT MAP returns to the map with the next open plot selected and the residents bar updated; RETRY replays.
- Finished towers: `js/district-towers.js`. A counted plot's tower stands on its site (floors = best height, foundation, facade blocks and its crown) within 800 m of the loaded plot, otherwise one instanced box (far ring). The plot being played is left out; after a result the map shows it on its own site. Seen only as the real model in the own-tower view (`tests/browser/out-s2-04/own-tower-high.png`); the far tower is about 10 m high at 800 m and hardly visible by design.
- Juzna flicker fixed: window-frame relief radius 150 -> 110 m (High, `--plot 1` game pose 1.01 % -> 0.52 %; plots 0-4 are 0.5 % or below, Low plot 1 0.95 %). Anisotropy 16 did not help.
- Checks: `npm test` 72 passed; `check.mjs all` High and Low pass (High 60 fps, 700 calls; Low 205 calls); `node tests/browser/plot-run.mjs --quality high|low` (new script: plays plots 1, 2 and 5 with targets lowered to 3, checks HUD, result text, saved store, map after, towers, next city) all PASS, no console errors. Screenshots in `tests/browser/out-s2-04/`.
- Open: the Newtown Play stays disabled; the middle ring may still show a building under a finished tower; `--plot` of check.mjs unchanged.
