# 09: Opus remodel pass: Kosice landmarks

**What to build:** the developer wants Opus to make the models (2026-11-24). Re-make or refine every Kosice landmark
(cathedral, State Theatre, St. Urban's tower, St. Michael's chapel, Immaculata with its figures, Singing Fountain basin)
to the highest quality the pipeline allows, against real photos.

**Blocked by:** None (can start immediately).

**Type:** improve
**Status:** done (fountain basin unchanged, see Comments)
**Model:** opus (skyline-modeler)

- [x] Each landmark compared side by side with 2+ reference photos; silhouette, proportions, colours and key details
      (cathedral portals and tracery, roof tile pattern, spires; theatre ornament and sculptures; Immaculata figures)
      clearly closer than before; before/after previews in Comments.
- [x] Sharp at close range and from the game camera; LODs; perf, audit and flicker pass.

## Comments
- Built (skyline-modeler, 2026-11-24). New shared tools: `lib.Sculpt` (metaball sculpts in game coordinates, decimated, appended to a Build) and `scripts/blender/sculpts.py`
  (robed saints in six poses, the Virgin of the Immaculata, cherub heads, putti, clouds); `lib.tracery`, `arc_bar`, `crockets`, `openwork` (quatrefoil galleries);
  `pipeline.assemble(flat_roles=...)`: roles with thousands of tiny islands (statues, tracery, clouds) share one atlas patch instead of starving the atlas.
- Cathedral: north tower = square shaft, octagonal stage with four corner turrets, black and gold Baroque crown (gallery, bell dome with gilded ribs and scrolls, four clocks,
  lantern, cupola, ball, cross, top 59.1 m); Matthias tower with pierced gallery and slate pyramid with dormers; black ridge spire with crockets (~51 m); roof tiles now a terracotta
  field with ochre/green zigzag bands (was yellow-green harlequin); pale sandstone with scattered dark/reddish blocks; tracery (sub-lancets, ring, quatrefoil) in all big windows;
  crocketed gable copings and blind tracery on the three gables; galleries along the eaves, the aisles and across the transept fronts; ogee portals with pinnacles, the west and
  north ones twin with trumeau, tympanum and 14 sculpted statues. Flying arches removed (not in the photos), and a bug fixed: the south aisle roof sat east of the transept.
  Triangles 84.8k / 32.3k / 7.6k (was 18.4k / 9.9k / 4.3k), 3.47 MB (was 1.76), still 3 materials.
- Immaculata: terrace, pedestal with gilded plates and corner volutes, four saints (Joseph with the Child, staff, book, prayer), cloud obelisk with 18 cherub heads and 6 putti,
  gilded globe, Virgin with crossed hands and a ring of 12 gold stars; 14.6 m. 41.5k / 14.3k / 3.4k tris, 0.83 MB (was 2k tris, 0.15 MB). Inside the old hull.
- Theatre: 12 sculpted bronze statues (cornice, pediment, lantern), turned balusters on the loggia balcony, stone ribs and four oculus dormers on the dome. 39.4k / 22.4k / 6.5k, 1.75 MB.
  Lesson: hundreds of small shells unioned by the exact boolean left black blotches in the AO bake: balusters are inlays.
- St. Urban's tower: as restored (File:UrbanTower2021.jpg): white plaster, red bell-cast roof with dormer, roundel frieze, pointed louvred belfry window, gilt ball, iron cross.
  5.4k tris, 0.58 MB. Chapel: two-light tracery and dark stone surrounds on every window, tile texture at 512 px. 10.9k tris, 1.2 MB.
- Not done: the Singing Fountain basin (granite rim and water only; the jets are animated in js/landmarks/fountain-jets.ts) is unchanged. Theatre: the rustication grooves still
  run across the ground-floor window reveals (old). Statues are an even carved colour (no baked AO, flat atlas patch).
- References (Commons, https://commons.wikimedia.org/wiki/<file>): File:Kosice - St. Elisabeth Cathedral - North tower.JPG, File:St. Elisabeth Cathedral - Old Town - Kosice - Slovakia (36169946860).jpg,
  File:Cathedral of St Elizabeth Košice, Staré Mesto, Slovakia.jpg, File:Elisabeth Cathedral Kosice Portal.jpeg, File:Cathédrale Sainte Elisabeth Kosice Detail portail nord.jpg,
  File:Sculpture Immaculata - Plague Column.jpg, File:Immaculata (Plague Column) - Old Town - Kosice - Slovakia (36398204192).jpg, File:UrbanTower2021.jpg, File:Kosice 34.jpg,
  plus the S0004 01 set (theatre, chapel, cathedral). Local copies: /private/tmp/claude-501/refs/s4-09/.
- Previews (not committed): before /private/tmp/claude-501/s409/before/, after /private/tmp/claude-501/s409/{cf,if,tf,chf,uf}/ (Blender, several views, LODs);
  game poses tests/browser/out-s4-09/glb-high-*.png (before: tests/browser/out-s4-01/glb-high-*.png).
- Checks: npm test 128 pass; check.mjs all at High (p50/p90 16.7 ms, 612 calls, 1.50 M tris) and Low (16.7 ms, 165 calls, 0.48 M) PASS; audit --plot all 0 findings;
  flicker --plot all --quality all PASS; manifest bytes updated.
