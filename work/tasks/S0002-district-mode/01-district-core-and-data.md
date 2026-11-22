# 01: District rules in the core, Kosice and Newtown plot data

**What to build:** a pure district module and the data: which plots are open, whether a plot result counts (target and
its requirement), plot stars, residents per tower with the view and skyline bonuses, district totals and whether the
residents goal opens the next city. Kosice gets five plots (outskirts panel estate -> cathedral), Newtown five plots.

**Blocked by:** None (can start immediately).

**Type:** feature
**Status:** done
**Read:** plan "Implementation Decisions" (Data, Core), user stories 1-8, 12-18, 24, 26.

- [x] Plot data shape as in the plan; Kosice plots with real sites (lat, lon) chosen from OSM: an outskirts estate
      (Terasa or KVP), two in between, one on Hlavna, the last at the current site; targets ~12, 15, 18, 22, 26;
      requirements none / none / max 2 lives lost / max 2 lives lost / min 40 % perfect; types panel, panel, hotel,
      hotel or office, the city's signature type; windScale rising.
- [x] Newtown entry (fictional, open from the start) with five plots on its procedural grid.
- [x] Core tests: opening order, counting with requirements, stars, residents with view (+20 %) and skyline bonuses,
      goal opens the next city, determinism.

## Comments
Built `js/core/district.js` (pure: isPlotOpen, nextPlot, resultCounts, plotStars, towerBonuses, towerResidents, recordPlot, districtTotals, goalReached),
Kosice `district` (goal 800) and a separate `NEWTOWN` export plus `DISTRICT_CITIES`/`cityById` in `js/levels.js` (not in LEVELS, so order, nextLevel and the world map stay six cities).
Plots stored as map plotId -> {stars, bestHeight, residents, counted}. Rules chosen: a result that misses the requirement gives 0 stars but keeps best height;
residents = floors x type rate (panel 14, hotel 11, office 9, deco 12, glass 10); view +20 % needs a landmark in sight and >= 10 floors; skyline +15 % when a counted tower within 800 m differs by >= 6 floors.
Goal 800: four plots reach it, three do not. Kosice sites (OSM/Overpass, open spaces): Terasa car park 48.71874/21.24033; Juzna trieda car park 48.71440/21.24912;
Kulturpark edge 48.71373/21.25634; Hlavna south end 48.71988/21.25874; cathedral 48.72100/21.25755 (today's site). Newtown sites are provisional {x,z} metres.
Open: S0001 progress migration is left to ticket 02. `npm test` 65 passed.
