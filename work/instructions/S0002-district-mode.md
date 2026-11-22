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

## Decisions (grilling)
Round 1, 2026-11-22:
- **Plots:** 5 per city, opened one after another. **Order from the outskirts to the centre:** outskirts plots ask
  less (fewer floors, lower quality requirements), each plot towards the centre is harder; the plot at the heart of the
  city (in Kosice next to the cathedral) comes last and is the hardest.
- **Building type and target are fixed per plot** and shown on the district map.
- **Next city opens at a residents threshold** in the district (e.g. Kosice 1500); building all plots is not required;
  the district can be finished later.
- **Bonuses instead of neighbour rules:** "view" (+20 % residents for a tower whose upper floors see a landmark) and
  "skyline" (bonus when neighbouring towers differ clearly in height); both shown on the map before building.
- **Stars:** each plot keeps 1-3 stars by the old rules; the district shows the sum. Endless stays on any opened city.
- **Fictional city returns:** the original procedural city is a seventh city outside the map, open from the start,
  with Endless and its own 5-plot district. Working name **Newtown**.
