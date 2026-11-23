# 04: Camera and intro tuning

**What to build:** the camera always shows the tower, the block and the city at its best.

**Blocked by:** 00

**Type:** polish
**Status:** claimed

- [ ] Intro pass keeps a comfortable distance from the cathedral and theatre (S0001 19 Comments: `viewOf` in
      js/core/intro-path.ts), framed like a postcard.
- [ ] Start view on each plot: the cathedral spire and the city skyline are not cut off at floor 0 (raise the camera
      pitch slightly or widen the field of view at low floors); ticket 07's criteria kept.
- [ ] Screenshots per plot at floor 0 and floor 10.

**Rules for this ticket (developer, 2026-11-23):** logically correct placement and a look that matches the real place.
Look at real photos before modelling: Wikimedia Commons (search "Košice <place>"), Mapillary street-level images, OSM
notes; save the reference URLs (not the images) in Comments and compare your screenshots with them side by side. No
visual bugs: no overlapping textures, nothing standing on a road, bike lane or track, the S0004 00 audit stays green.
