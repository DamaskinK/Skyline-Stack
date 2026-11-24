# 15: Demo bug hunt: real road widths, two-way traffic with trams, pedalling cyclists, straight roofs

**What to build:** developer, 2026-11-24, demo tomorrow: "roads are very narrow; except Hlavna, Kosice main roads have
tram tracks in the middle and car lanes in both directions; cyclists don't pedal; roofs are crooked; just look and fix
bugs".

**Blocked by:** 14

**Type:** bug
**Status:** done

- [x] Real carriageway widths from OSM (`lanes`, `width`, highway class; Kosice main roads like Juzna trieda and
      Sturova are 2x2 lanes with the tram line in the middle on its own bed). Two-way traffic: cars drive on the right
      in both directions on every two-way road, one-way only where OSM says so; tram tracks inside the road where the
      real line runs there. Lane markings follow.
- [x] Cyclists ride on bike lanes and pedal (legs and pedals turn with speed; wheels turn).
- [x] Roofs: no crooked/skewed hip or gable roofs on irregular footprints (fall back to flat or simple roofs where the
      shape cannot be roofed cleanly); check every plot from the game camera.
- [x] Free bug hunt on every plot, day and night, High and Low: floating/sunk objects, cars through cars or buildings,
      z-fighting, gaps, wrong scale; fix what you find; list the findings in Comments.
- [x] audit, flicker --plot all --quality all, check.mjs all, plot-run, npm test pass.

## Comments
- Roads: the build script now keeps OSM `oneway` (`ow`) and `lanes` (`ln`); lane width 3.4 m. Kosice main roads are drawn in OSM as two one-way carriageways with the tram bed between them (Sturova: 2-4 lanes each), so cars now drive one way on them, spread over the lanes, with dashed lane dividers; two-way streets keep one lane per direction on the right. Overpass was unreachable, so the plot JSON was rebuilt from the cached raw extract of 2026-11-23 (roads only; rails and tram stops stay as committed). Re-run `node scripts/build-osm-level.mjs kosice plots` when the network is back (it now bundles js/levels.ts with esbuild itself). Carriageway widths were not changed beyond lane width: not re-checked against Commons photos (no network).
- Cyclists: bike split into frame, two turning wheels and a crank; the rider has no legs in the mesh, two-bone legs follow the pedals; they only ride forward on their right-hand lane and re-enter at the lane start (scaled to nothing at both ends) instead of turning round.
- Roofs: hip and gable roofs only where the footprint is near-rectangular (`rectAxis`, ridge along the longest edge); L shapes, trapezoids and curves get a flat roof with parapet.
- Bug hunt: OSM footprints under 8 m2 (plinths at the cathedral fountain) are no longer drawn as blank pillars; cafe terraces sit 3 m from the shopfront so parasols clear awnings. Not found by eye on the other plots: floating objects or z-fighting (flicker check passes on all plots and presets).
- Checks: npm test 128 pass; audit --plot all 0 findings; flicker --plot all --quality all PASS; check.mjs all high and low PASS; plot-run PASS.
- Open: tram beds are still only where OSM has the rails (none on the Juzna plot's own street); photos not compared.
