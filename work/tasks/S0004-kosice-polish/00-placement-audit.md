# 00: Placement and overlap audit (runs first)

**What to build:** nothing in Kosice stands where it logically cannot (developer, 2026-11-23: "a house on the bike lane"),
and no surfaces fight each other. An automated audit that fails the build when it happens.

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** done

- [x] An audit (core-side geometry, run in Vitest on the plot extracts and in a browser check on the built scene) that
      reports: buildings, props, trees, benches, kiosks, stops, parked cars, district towers and the player's plot pad
      overlapping roads, bike lanes, tram tracks, footways' centre lines, basins, river or each other; trees inside
      buildings; street furniture in the carriageway; people/cyclists/cars routes crossing buildings or water.
- [x] Every finding on all five Kosice plots (and Newtown) fixed at the source (placement rules in near-ring, street
      life, vegetation, trams, district towers), not by hand-moving single objects.
- [x] Coplanar surface check extended to every plot and every quality preset (S0002 10 flicker --plot all).
- [x] The audit runs in `npm test` (data side) and in `check.mjs` (scene side); both green.

## Comments
- Built `js/core/geometry2d.ts` (ring / polyline / circle / box distances, area overlap, line cutting) and `js/core/placement.ts`: one `Site` holds every obstacle by its real size
  (houses, carriageways by width, footways, bike lanes, tram beds, basins with their 0.9 m rim, river, the plaza pad, finished towers of other plots) and a per-kind `RULES` table says what each
  thing keeps clear of. Every placement now goes through it: `planNearRing` (trees, hedges, beds, bushes, lamps, parked cars, bike lanes, trams' poles and platforms, benches, bins, racks,
  planters, kiosks, stops, signs, shops, stalls, musicians, seated and standing people, car / walk / bike routes). `js/near-ring.ts`, `js/street-life.ts`, `js/trams.ts` only draw the plan
  (kept on `group.userData.plan`). Newtown: `newtownFurniture` / `newtownSite` in core, `placeProc` in `js/world.ts` for its houses and trees. Middle ring: footprints are checked as whole rings in `js/far-ring.ts`.
- Rules fixed at the source: houses must not overlap (smaller one dropped); streets, lanes and footways are cut where they run through a house (80 % / 0.6 m clear of walls), so cars, people, lanes
  and furniture follow; bike lanes are cut at houses, water and tram beds; furniture, trees, hedges, cars, poles keep off carriageways, bike lanes, tram beds, basins, river, footways (trees and hedges by
  the whole width, furniture by the centre line); street cars skip streets with a bike lane; the pad trim now grows by half the road width (a pre-existing bug also let a two-point footway stay on
  the plaza); finished towers of other plots inside an extract (Hlavna street and Cathedral square share one) clear houses, roads, water and trees round their site; middle-ring houses stay out of the
  near square, tower and landmark circles, the river and each other; Newtown hedge row moved 0.7 m onto the plaza, no lamps in the crossing carriageway, no overlapping houses, trees on roads or sidewalks.
- Findings before -> after, five Kosice plots summed (audit of the old rules, same objects): on footways 1687 -> 0, in carriageways 1460 -> 0, in or on houses 672 -> 0 (+1 house on house),
  on bike lanes 202 -> 0, on tram beds 21 -> 0, in basins 5 -> 0, on the plaza pad 15 -> 0, on a finished tower 13 -> 0, object on object 127 -> 0, routes through houses 20 -> 0,
  middle ring (near square 135, house on house 216, in cleared circles 45) 396 -> 0. Newtown: hedge on footway 72, lamp in carriageway 16, house on house 20, house on road / footway / tree 3 -> 0.
  Counts of the old rules count the strict criteria (whole footway width for trees and hedges); the old code only tested the centre point.
- Checks: `npx vitest run` 112 passed (new `tests/core/placement.test.ts`, 19 tests: geometry, audit sees seeded faults, every Kosice plot, Newtown); `node tests/browser/check.mjs audit` PASS on all five
  Kosice plots (1.3k-1.7k scene objects each, 3.5k middle-ring footprints, 0 findings, 0 count mismatches) and Newtown (356 objects); `flicker --plot all --quality all` PASS on Kosice and on Newtown (new
  `--quality all` runs low, medium, high in turn); `check.mjs all` High 642 draw calls, Low 182, 60 fps, console clean; plot-run and screenshots in `tests/browser/out-s4-00` looked at.
- Open: `npm test` as a whole is red in this working tree because of another ticket's unfinished files (`js/credits-screen.ts`, `js/world-map.ts` type errors, `tests/core/credits.test.ts`); nothing from this ticket.
  Landmark models are only covered through the footprints they replace (hidden OSM buildings stay obstacles); the Lantern Bridge over the Newtown ring road stands on the road by design.
  Trees and hedges are fewer (park paths and roads cut through the parks; e.g. Terasa trees 1151 placed, 216 refused).
