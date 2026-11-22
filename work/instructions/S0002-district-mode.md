# S0002: District mode and the fictional city

**Type:** feature
**Status:** ready
<!-- draft -> ready (run grilling) -> planned (plan and tasks exist) -> done -->

## Task
1. **District mode** (developer's choice 2026-11-22, "district on the map"): each city is a real district from
   OpenStreetMap with 4-6 empty plots on real streets. On each plot the player builds a tower of a building type with
   its own target. The district comes alive as it fills (residents, shops, people). The next city opens when the
   district reaches a number of residents. No neighbour rules: bonuses for a view of a landmark and for a good skyline.
   It must be our own mechanic, not the 3x3 neighbour-rule city mode of an existing game (ADR 0002).
2. **The fictional city returns** (developer, 2026-11-22: "bring back the mode from the beginning, the non-existent
   city, so it exists too"): the original procedural city (plaza, two road rings, background towers) stays playable
   as its own city next to the six real ones.

## Why
The single-tower level gives no sense of building a city; the developer wants a city-building step to advance, as the
genre usually has. The fictional city was fun and should not disappear.

## Good result
- A city screen with the district map, plots, a residents goal and progress; picking a plot starts a tower there.
- Completed towers stay in the district for good; the camera and city show them.
- The fictional city is playable from the start.

## Limits
- Original rules (no copied grid or neighbour rules). Deterministic core. Performance budget of ticket 35.

## References
- S0001 plan and tickets 08 (levels, stars, progress), 12-14 (OSM rings, landmarks), 20 (world map), 38 (city life).
- ADR 0002 (City mode removed and why).
