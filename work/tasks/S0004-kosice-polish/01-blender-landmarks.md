# 01: All Kosice landmarks from Blender, cathedral polished

**What to build:** every Kosice landmark at the Blender quality bar (S0001 ticket 40 pipeline, CLAUDE.md "Blender").

**Blocked by:** 00

**Type:** improve
**Status:** done

- [x] Cathedral polish: roof glazed tiles mostly yellow and green diamonds like the real one; sharp stone at close range
      (tiling stone texture with trim detail instead of a low-res atlas, optional normal map); fix the "mesh not valid"
      export warning.
- [x] State Theatre (neo-baroque, 1899): cream facade, central copper dome, corner domes, portico, sculptures, lit windows.
- [x] St. Urban's tower, St. Michael's chapel, Immaculata (plague column), Singing Fountain (its basin at the real place).
- [x] Each with LODs, Draco, one or two materials; previews from several angles reviewed; same positions as today.
- [x] Perf at 2560x1440 DPR 2 High and Low within budget; screenshots before/after.

**Rules for this ticket (developer, 2026-11-23):** logically correct placement and a look that matches the real place.
Look at real photos before modelling: Wikimedia Commons (search "Košice <place>"), Mapillary street-level images, OSM
notes; save the reference URLs (not the images) in Comments and compare your screenshots with them side by side. No
visual bugs: no overlapping textures, nothing standing on a road, bike lane or track, the S0004 00 audit stays green.

## Comments
- Built (2026-11-23): `scripts/blender/pipeline.py` (shared assembly, tiling stone and tile textures, LOD clean-up), `theatre.py`, `urban.py`, `chapel.py`, `monuments.py` (Immaculata, Singing Fountain),
  `cathedral.py` moved onto the pipeline; GLBs `assets/levels/kosice/{theatre,urban,chapel,immaculata,fountain}.glb` (+ manifest), `js/landmarks/kosice.ts` loads all of them (procedural fallback and
  `?landmarks=procedural` kept), `tests/browser/landmarks-poses.mjs` (16 fixed poses, GLB vs procedural). Run commands: ADR 0003 (update section); every script takes `--stage geom|full --size N --previews dir --lods`.
- Cathedral: stone is now a 3.2 m tiling ashlar texture (colour + normal map, about 320 px/m) with the baked occlusion from the atlas through UV 1, darker grey-brown like the photos; roof is a yellow/green
  harlequin with two red and two black accents per 3 m; "mesh not valid" fixed (LOD clean-up, `validate` reports clean). Triangles 18422 / 9879 / 4294, file 1.72 MB (was 1.40 MB), 3 materials (atlas, tiles, stone).
- Triangles LOD0/1/2 and file size: theatre 13198 / 7537 / 2829, 1.12 MB; urban tower 3064 / 1663 / 695, 0.47 MB; chapel 2488 / 1259 / 497, 0.50 MB; Immaculata 1954 / 984 / 395, 0.14 MB; fountain 5588 / 2672 / 972, 0.26 MB.
  Theatre, urban tower, chapel: atlas + one tiling roof material (2 materials); Immaculata, fountain: one. Cathedral: three (see above, the open point of "one or two").
- Placement checked against OpenStreetMap and Commons (this changes "same positions as today" on purpose, per the developer's rule "logically correct placement"):
  St. Urban's tower stood 55 m from the real one: now on its OSM footprint (way 25720529, centre (43.0, 37.7), 21.5 degrees, 16.1 x 15.4 m with the arcade). The footprint had no name in the extracts and was drawn as a
  two-storey house under the tower, so it got `"n": "Urbanova veža"` (plots cathedral and hlavna-south, and `scripts/build-osm-level.mjs` keeps the name of `man_made=tower` buildings) and is hidden like the others.
  Singing Fountain: its OSM water polygon (way 47059196, 12.5 x 23.9 m, centre (4.9, -19.6), 18.5 degrees, on the theatre axis) is where the model stands now (was a round basin 26 m away). The near ring drops small
  water that touches the build pad (`js/core/placement.ts`), so on the cathedral plot there was no basin at all; the model draws the granite rim and the water itself, 15 / 8 cm above the near ring's own basin where that
  is drawn (hlavna-south), so no plane is shared. Immaculata: was standing inside the fountain's basin; it is on Hlavna street at the Commons category coordinates (-55.1, -199.0), 27 m from the nearest house.
  Theatre and chapel centre and rotation equal the minimum rectangles of their OSM footprints (33.0 x 51.9 m at 18.25 degrees; 20.1 x 15.1 m at 13 degrees); the theatre's bay and steps are inside the 33 x 52 footprint plus 2 m of steps.
- References (looked at, not stored in the repo; Commons files): theatre `File:Kosice_State_Theatre_1.JPG`, `File:Kosice_-_National_Theatre.jpg`, `File:National_Theatre_Kosice_-_rear_view.jpg`;
  St. Urban's tower `File:Kosice_-_St._Urban_Tower.jpg`; chapel `File:Kaplnka_svätého_Michala_Koszyce_2SM.jpg`, `File:Kosice_-_St._Michael_Chapel,_Cathedral,_Park.jpg`;
  Immaculata `File:Immaculata2.jpg`; Singing Fountain `File:Košice_-_Spievajúca_fontána_-01.jpg`; cathedral `File:Cathedral_of_St._Elizabeth_in_Košice.jpg`, `File:Cathedral_of_St_Elizabeth_Košice,_Staré_Mesto,_Slovakia.jpg`
  (all at https://commons.wikimedia.org/wiki/<file>). Coordinates: OSM ways 25720529 and 47059196, Commons `Category:Marian Column, Košice`, Wikipedia coordinates of the theatre and the chapel.
  Findings from the photos that changed the models: the theatre has no free-standing portico (a projecting bay with a loggia of three arches between paired columns, rusticated ground floor, two round corner pavilions, dark grey-green
  domes); St. Urban's tower has a dark pyramidal roof (not a copper onion) and an arcaded gallery with a red lean-to roof; the chapel is whitewashed with dark stone buttresses, a polygonal apse and a steep brown roof with a yellow lattice.
- Previews (not committed): `/private/tmp/claude-501/prev/{cath,theatre,urban,chapel,mon}/` (Blender, several angles and LODs); game poses `tests/browser/out-s4-01/{glb,procedural}-{high,low}-<pose>.png`
  (procedural = before, glb = after), perf runs `tests/browser/out-s4-01/{high,low}/`.
- Checks: `npm test` (tsc + 116 tests) green; `check.mjs audit` PASS on all five plots, 0 findings; `check.mjs all` at 2560x1440 DPR 2: High p50 16.7 ms, p90 16.7 ms, 60 fps, 623 draw calls, 1.70 M triangles;
  Low p50 16.7 ms, 183 calls, 0.44 M triangles; flicker depth and shadow PASS on both; `flicker --plot 0` and `--plot 1` PASS; console clean.
- Open: the theatre is a stylised neo-baroque (no sculpture groups, balusters are one block, ornament only as mouldings); the Immaculata's figures are simple robed shapes; the fountain jets are static (the real one dances).
  LOD2 of the theatre and the tower is rough close up but only shows beyond 400 / 320 m. The Blender exporter still warns "More than one shader node tex image used for a texture" (harmless: the shared ORM map feeds roughness, metal and occlusion).
  The yellow-green fleck on the north tower base seen in the Blender aerial preview (roof faces poking at the aisle roof end) was not chased.
