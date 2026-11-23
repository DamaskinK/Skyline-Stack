# 00: Placement and overlap audit (runs first)

**What to build:** nothing in Kosice stands where it logically cannot (developer, 2026-11-23: "a house on the bike lane"),
and no surfaces fight each other. An automated audit that fails the build when it happens.

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** ready-for-agent

- [ ] An audit (core-side geometry, run in Vitest on the plot extracts and in a browser check on the built scene) that
      reports: buildings, props, trees, benches, kiosks, stops, parked cars, district towers and the player's plot pad
      overlapping roads, bike lanes, tram tracks, footways' centre lines, basins, river or each other; trees inside
      buildings; street furniture in the carriageway; people/cyclists/cars routes crossing buildings or water.
- [ ] Every finding on all five Kosice plots (and Newtown) fixed at the source (placement rules in near-ring, street
      life, vegetation, trams, district towers), not by hand-moving single objects.
- [ ] Coplanar surface check extended to every plot and every quality preset (S0002 10 flicker --plot all).
- [ ] The audit runs in `npm test` (data side) and in `check.mjs` (scene side); both green.
