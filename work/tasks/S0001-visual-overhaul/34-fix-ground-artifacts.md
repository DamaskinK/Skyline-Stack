# 34: Fix the ground artifacts in Kosice

**What to build:** the ground of the Kosice near ring looks clean and believable (developer's screenshot at ticket 17,
2026-11-22, default camera at the start of a run).

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** done
**Now:** in front of the tower a huge flat blue OSM water polygon lies on the square (reads as a puddle, not a fountain);
parks are flat bright-green polygons with a dashed outline; patches of the old checker paving and darker paving
overlap the new plaza; some ground pieces look like stacked flat colour shapes.

- [x] Water on Hlavna/the square: small water areas (fountains, pools) become proper features (a basin with a rim and
      a water surface slightly below it, or the Singing Fountain model from ticket 14); only real river water stays a
      flat surface. Nothing blue lies loose on the paving.
- [x] Parks: grass with a kerb or low border, a softer natural green that fits the light, no dashed outline; trees and
      paths stay.
- [x] One paving surface for the square: no leftover checker patches or darker overlapping pieces from the procedural
      plaza or from overlapping OSM polygons (pedestrian areas, squares, footways). No coplanar overlaps (ticket 05 rule).
- [x] Screenshots from the default camera at the start and at floor 8, High and Low; flicker check passes.

## Comments
Built in js/near-ring.js only. Water polygons under 1500 m2 (fountains, pools) are now basins: 0.9 m stone rim 0.55 m high, water surface at 0.32 m;
bigger water (river) stays a flat layer. Parks: own soft-green specks texture (the shared grass texture had its specks on a lattice, which
drew the "dashed outline" lines), 0.3 m kerb, skipped where polygons overlap each other or lie under the plaza; triangles grown 5 cm so cracks never show.
Plaza slab now uses the same stone as the paths and has the top depth bias, so no checker patches or path ribbons cut into it.
Checks (High and Low, 1280x720 and 1600x900): flicker depth/shadow all PASS (max 0.56%), perf 60 fps, console clean, npm test 48 passed;
screenshots at start and floor 8 in tests/browser/out34 viewed.
Open: simulated people walk into the basin (ticket 36 area: they should avoid water); the thin dark line across the basin and plaza is the crane rope shadow, not ground.
The Singing Fountain landmark model was not touched.
