# 15: Demo bug hunt: real road widths, two-way traffic with trams, pedalling cyclists, straight roofs

**What to build:** developer, 2026-11-24, demo tomorrow: "roads are very narrow; except Hlavna, Kosice main roads have
tram tracks in the middle and car lanes in both directions; cyclists don't pedal; roofs are crooked; just look and fix
bugs".

**Blocked by:** 14

**Type:** bug
**Status:** claimed

- [ ] Real carriageway widths from OSM (`lanes`, `width`, highway class; Kosice main roads like Juzna trieda and
      Sturova are 2x2 lanes with the tram line in the middle on its own bed). Two-way traffic: cars drive on the right
      in both directions on every two-way road, one-way only where OSM says so; tram tracks inside the road where the
      real line runs there. Lane markings follow.
- [ ] Cyclists ride on bike lanes and pedal (legs and pedals turn with speed; wheels turn).
- [ ] Roofs: no crooked/skewed hip or gable roofs on irregular footprints (fall back to flat or simple roofs where the
      shape cannot be roofed cleanly); check every plot from the game camera.
- [ ] Free bug hunt on every plot, day and night, High and Low: floating/sunk objects, cars through cars or buildings,
      z-fighting, gaps, wrong scale; fix what you find; list the findings in Comments.
- [ ] audit, flicker --plot all --quality all, check.mjs all, plot-run, npm test pass.
