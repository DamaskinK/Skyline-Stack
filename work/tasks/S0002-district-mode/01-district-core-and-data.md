# 01: District rules in the core, Kosice and Newtown plot data

**What to build:** a pure district module and the data: which plots are open, whether a plot result counts (target and
its requirement), plot stars, residents per tower with the view and skyline bonuses, district totals and whether the
residents goal opens the next city. Kosice gets five plots (outskirts panel estate -> cathedral), Newtown five plots.

**Blocked by:** None (can start immediately).

**Type:** feature
**Status:** ready-for-agent
**Read:** plan "Implementation Decisions" (Data, Core), user stories 1-8, 12-18, 24, 26.

- [ ] Plot data shape as in the plan; Kosice plots with real sites (lat, lon) chosen from OSM: an outskirts estate
      (Terasa or KVP), two in between, one on Hlavna, the last at the current site; targets ~12, 15, 18, 22, 26;
      requirements none / none / max 2 lives lost / max 2 lives lost / min 40 % perfect; types panel, panel, hotel,
      hotel or office, the city's signature type; windScale rising.
- [ ] Newtown entry (fictional, open from the start) with five plots on its procedural grid.
- [ ] Core tests: opening order, counting with requirements, stars, residents with view (+20 %) and skyline bonuses,
      goal opens the next city, determinism.
