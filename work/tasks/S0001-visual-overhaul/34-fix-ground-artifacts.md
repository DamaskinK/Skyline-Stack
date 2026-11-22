# 34: Fix the ground artifacts in Kosice

**What to build:** the ground of the Kosice near ring looks clean and believable (developer's screenshot at ticket 17,
2026-11-22, default camera at the start of a run).

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** claimed
**Now:** in front of the tower a huge flat blue OSM water polygon lies on the square (reads as a puddle, not a fountain);
parks are flat bright-green polygons with a dashed outline; patches of the old checker paving and darker paving
overlap the new plaza; some ground pieces look like stacked flat colour shapes.

- [ ] Water on Hlavna/the square: small water areas (fountains, pools) become proper features (a basin with a rim and
      a water surface slightly below it, or the Singing Fountain model from ticket 14); only real river water stays a
      flat surface. Nothing blue lies loose on the paving.
- [ ] Parks: grass with a kerb or low border, a softer natural green that fits the light, no dashed outline; trees and
      paths stay.
- [ ] One paving surface for the square: no leftover checker patches or darker overlapping pieces from the procedural
      plaza or from overlapping OSM polygons (pedestrian areas, squares, footways). No coplanar overlaps (ticket 05 rule).
- [ ] Screenshots from the default camera at the start and at floor 8, High and Low; flicker check passes.
