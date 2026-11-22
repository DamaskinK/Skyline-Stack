# 13: Kosice middle and far ring

**What to build:** the middle ring fills the view with Kosice-style buildings (instanced, lower detail); the far ring
shows the Hornad river and the wooded hills of the Slovak Ore Mountains as a stylised horizon. Traffic and pedestrians
fit the new streets. No empty plain to the horizon.

**Blocked by:** 12

**Type:** feature
**Status:** done
**Read:** plan "Scene in three rings"; brief decisions round 2.

- [x] Horizon relief in the real direction from the build site
- [x] Rings blend with fog; no visible seams
- [x] Budget kept on High and Low

## Comments
- `js/far-ring.js`: middle ring (330 m to ~1.5 km, ~2-3k buildings merged per facade variant, no shadows): pre-war 3-6 storey blocks with pastel plaster and red hip roofs,
  1950s slabs, panel estates (8-12 storeys, flat roofs) on the edges, family houses at the rim, church towers. Far ring: one polar terrain mesh to 4.8 km
  (fields, woods and city painted into a 768 px ground texture), rounded wooded hills (Ore Mountains north/north-west up to ~600 m, gentler east/south),
  Hornad valley and river ~1.8 km west running north-south. Terrain uses a fog that stops at 52-90 % so hills stay a faint layered silhouette.
  Procedural near city, far blocks, grass plain and pyramid hills are hidden on OSM levels (`backdrop` group). Camera far 6000, sky dome 5000, clear-weather fog pushed to ~1.8 km.
- Near ring: darker asphalt, warm stone-grey plaza and sidewalks, lower albedo; footprints under 2200 m2 without a tall tag are 2-4 storey old-town houses (hip roofs on convex
  footprints, red/brown tiles, pastel plaster), the rest plain facade with flat roof. New calm facades (`calmFacade`: 2 windows per 6 m tile, whole windows per wall).
- Traffic: cars drive along the real main/street polylines (right lane, turn round at the ends); street walkers follow footpaths; plaza walkers and parked cars as before.
- Checks (Kosice): npm test 44 pass; browser check all: High 60 fps, 521 draw calls (shadow pass counted), Low 60 fps, 144 draw calls, flicker PASS, no console errors.
  Looked at start/mid screenshots and the four compass views from 60 m height.
- Open: the title screen still shows the procedural demo city (levels load on run start); ticket 19 owns the menu. Hills are not real elevation data.
