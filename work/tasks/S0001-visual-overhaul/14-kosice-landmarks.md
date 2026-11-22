# 14: Kosice landmarks and the shared landmark style

**What to build:** procedural low-poly models of St. Elisabeth Cathedral, the State Theatre and the Hlavna street
skyline, placed in the far ring at their real bearing with compressed distance. A shared landmark material set and
builder helpers (lathe, extrude, merged primitives) that later cities reuse.

**Blocked by:** 13

**Type:** feature
**Status:** done
**Read:** plan "Landmarks"; brief decisions round 2-3.

- [x] Each landmark 1-3k triangles, recognisable by silhouette from the game camera
- [x] Lit windows / floodlights at dusk
- [ ] Developer recognises the landmarks at once (ready-for-human check)

## Comments
- `js/landmarks/style.js` (shared: material set with lit-window / floodlit materials pushed into `glowMats`, canvas textures, `Parts` merge-per-material collector, lathe/extrude/gable helpers),
  `js/landmarks/kosice.js` (cathedral 1164 tris, theatre 2420, St. Urban's tower 284, St. Michael's chapel 98, Singing Fountain 212, Immaculata column 174), `js/landmarks/index.js` (level id -> module).
  Placed at the real footprints (centre and rotation from the OSM rectangles), not compressed. The OSM footprints of the cathedral, chapel and theatre are hidden (`hide` names passed to `buildNearRing`).
- Cathedral: north tower with a 59 m green Baroque spire, lower unfinished south (Matthias) tower with a low copper cap, glazed diamond roof tiles, pointed-arch windows, buttresses, transept, apse east.
  Theatre: cream front, six-column portico with pediment, central copper dome (~36 m) and four smaller domes, statues on the cornice.
- Night: windows and floodlit parts follow the scenery glow (`atm.night * 1.4` through `glowMats`); checked by forcing the intensity and rendering with `__debug.snap`, not by a real night phase (ticket 10 owns the time of day).
- Camera: default offset `camOffsets[0]` is now (-28, 9, -24), north-west of the tower looking south-east, so the cathedral stands behind and right of the tower. Menu orbit unchanged.
- Checks: npm test 48 pass; browser check all High 60 fps, 590 draw calls, Low 60 fps, 176 draw calls, flicker PASS, no console errors. Looked at start/mid shots and snap views of both landmarks.
- Open: "developer recognises the landmarks at once" waits for the developer. The cathedral is only ~21 m from the site (north tower) so it is large in the game view; the real 28 m plaza edge is close to its west front.
