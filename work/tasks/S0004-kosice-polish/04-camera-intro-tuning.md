# 04: Camera and intro tuning

**What to build:** the camera always shows the tower, the block and the city at its best.

**Blocked by:** 00

**Type:** polish
**Status:** done

- [x] Intro pass keeps a comfortable distance from the cathedral and theatre (S0001 19 Comments: `viewOf` in
      js/core/intro-path.ts), framed like a postcard.
- [x] Start view on each plot: the cathedral spire and the city skyline are not cut off at floor 0 (raise the camera
      pitch slightly or widen the field of view at low floors); ticket 07's criteria kept.
- [x] Screenshots per plot at floor 0 and floor 10.

**Rules for this ticket (developer, 2026-11-23):** logically correct placement and a look that matches the real place.
Look at real photos before modelling: Wikimedia Commons (search "Košice <place>"), Mapillary street-level images, OSM
notes; save the reference URLs (not the images) in Comments and compare your screenshots with them side by side. No
visual bugs: no overlapping textures, nothing standing on a road, bike lane or track, the S0004 00 audit stays green.

## Comments
- Intro: `viewOf` (js/core/intro-path.ts) now puts the camera 120 m from each landmark, 46 m up, looking at a point 26 m up (was 55 m / 26 m / 14 m: the pass ran through the cathedral walls). Test added: every landmark view of the real Kosice plots 2-4 is at least 60 m away and looks down on it.
- Floor 0: while the tower has fewer than 10 floors the look-at point rises up to 5 m and the field of view opens up to 8 degrees (50 to 58), both fading to nothing by floor 10 (js/main.ts, camera modes 0 and 1; top view and intro/menu unchanged). The cathedral spire and skyline now fit on plot 4; ticket 07 criteria kept (block, target roof, wind arrow visible). CAM_OFFSETS unchanged.
- Screenshots: `tests/browser/out-s4-04/before/` and `after/` (`p<N>-<plot>-floor0|floor10|intro-<pct>.png`, script `tests/browser/s4-04.mjs`).
- References (not copied), compared by eye: commons.wikimedia.org File:Hlavná_from_St_Elizabeth_tower.jpg, File:Dóm_sv._Alžbety,_Hlavná_ulica,_Košice_-_panoramio.jpg, File:Kosice_(Slovakia)_-_Main_Street_5.jpg (cathedral seen whole with its spire over the street and plaza; the intro frames match that view).
- Checks: `npm test` intro tests green (other failures in tests/core/district*.test.ts come from the parallel balance ticket S0004 05); check.mjs all high and low PASS, 60 fps, no console errors; s1-19.mjs ALL PASSED.
