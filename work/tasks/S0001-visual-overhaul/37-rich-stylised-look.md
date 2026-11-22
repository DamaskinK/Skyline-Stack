# 37: Rich stylised look for Kosice

**What to build:** Kosice stops looking flat and primitive while staying stylised (developer's choice at the ticket 17
playtest, 2026-11-22: "rich stylised", not semi-realistic PBR). It becomes the art bar for the other cities.

**Blocked by:** 34, 35

**Type:** improve
**Status:** done
**Now:** smooth single-colour walls, windows only painted in a texture, single-colour ground, simple trees, flat light.

- [x] Facades with real depth on the near-ring houses and the panel-block floors: cornices, window frames/sills and
      recesses as geometry (instanced or merged), plinths, roof eaves; pastel plaster colours with slight variation.
- [x] Surfaces with relief: CC0 normal/roughness maps (ambientCG or Poly Haven) for cobblestone paving, asphalt,
      plaster, roof tiles, stone of the cathedral; tiled at a stylised scale, colours kept from the palette.
- [x] Richer vegetation: fuller trees (several canopy lumps, colour variation, slight wind sway), hedges, flower beds.
- [x] Sky and light: soft stylised clouds with volume (sprites or low-poly puffs lit by the sun), warmer and more
      contrasted sunlight with coloured shadows, stronger contact shadows on High.
- [x] Budget kept: ticket 35's High target at 2560x1440 DPR 2, Low phone-friendly; all new assets in CREDITS.md.
- [ ] Before/after screenshots from the default camera at the start and at floor 8; developer approves (ready-for-human).

## Comments
- Facades (`js/near-ring.js`): per wall a plinth, a cornice (or a stringcourse under the eaves), parapet on flat roofs, and sill / lintel / jamb boxes per window
  within 150 m (75 m on Low, no jambs), all merged into one relief mesh; hip roofs got 0.5 m eaves with a fascia; per-building plaster tint through vertex colours.
  Tower panel floors (`js/entities.js`): shared relief geometry with sills, lintels, loggia slab, railing and slab-edge ledge on all four faces.
- Surfaces: new `js/surfaces.js` loads CC0 Poly Haven normal and roughness maps (512 px, `assets/textures/`, credited) for asphalt, cobblestone (paths and plaza),
  plaster (calm facades), roof tiles and the cathedral stone. Colours stay in the palette.
- Vegetation (`js/vegetation.js`): trees with six canopy lumps, light tops, per-tree tint and vertex-shader wind sway; hedge rows along park kerbs; flower beds.
- Sky and light (`js/world.js`, `js/post.js`): clouds smooth-shaded and flattened for volume; warmer sun (x1.15), bluer hemisphere fill for cool shadows; GTAO radius/scale/blend raised on High.
- Numbers (Kosice, 2560x1440 DPR 2): High p90 16.7 ms, 60 fps, 714 calls, ~2.4M triangles (was 678 calls, 0.67M); GPU-bound loop 11.6 ms vs 10.1 ms before this ticket.
  Low p90 16.7 ms, 209 calls, 0.54M triangles. Flicker checks pass, npm test 70 passed, console clean.
- Crown check (ticket 39): target lowered from the page only (4 floors), bot finished the level: crown world y 13.6 = tower top, top floor at 12.2, so it sits on the topmost floor;
  the earlier "mid-tower" screenshot was not reproduced (tests/browser/out37/after/crown-*.png).
- Screenshots: before in `tests/browser/out37/before`, after in `tests/browser/out37/after` (start and floor 8, High and Low, close-ups of houses, bed, tower).
- Open: the last box (developer approves the before/after) stays unticked. Trees on the procedural city (other levels) keep the old look; only the OSM near ring uses the new vegetation.
