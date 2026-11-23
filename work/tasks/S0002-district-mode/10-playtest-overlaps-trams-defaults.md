# 10: Playtest fixes: overlapping surfaces, trams and cars on the outskirts, Medium by default

**What to build:** remarks from the developer's playtest of the Kosice district, 2026-11-23.

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** ready-for-agent

- [ ] Overlapping textures: surfaces drawn on top of each other in one plane, e.g. the tower (foundation/plot pad) on a
      bike lane, bike lanes over roads or paving. Find every coplanar overlap on all five Kosice plots and the Newtown
      plots (bike lanes, roads, paths, plaza/plot pads, parks, basins, OSM area polygons that overlap each other) and
      fix them by the ticket 05 rule: real height steps or cutting one shape out of the other; nothing of the street
      network under the tower's foundation (clear a pad). Add a check that renders each plot's start view twice with a
      tiny camera move and fails on coplanar flicker (extend check.mjs flicker to --plot N for all plots).
- [ ] Trams: Kosice has trams; add `railway=tram` from OpenStreetMap to the plot extracts (rails in the street with a
      grass or paved track bed, overhead poles if cheap) and low-poly trams (Kosice-style, two or three sections) that
      run along the lines and stop at tram stops; on every Kosice plot that has lines (Terasa and Juzna have them).
- [ ] Cars on the outskirts plots: moving traffic along the OSM roads on Terasa and Juzna (and every plot), parked cars
      along streets and in car parks, scaled by preset and district life.
- [ ] Default graphics preset is Medium for new players (existing saved settings stay).
- [ ] npm test, check.mjs High/Low/Medium per plot, plot-run pass; screenshots of a tram and of the bike lane by the
      tower.
