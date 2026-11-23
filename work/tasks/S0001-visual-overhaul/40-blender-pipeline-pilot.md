# 40: Blender pipeline pilot: St. Elisabeth Cathedral as a GLB

**What to build:** a reproducible Blender pipeline (headless Python scripts in the repo) and, as the pilot, St. Elisabeth
Cathedral rebuilt in it, compared with the procedural version of ticket 14. Developer, 2026-11-22: Blender may make
better and more optimised models. Blender is installed at /Applications/Blender.app.

**Blocked by:** None (can start immediately).

**Type:** feature
**Status:** done

- [x] `scripts/blender/` with a build script per model run by `blender -b -P <script> -- <out.glb>`; shared helpers
      (materials from the landmark palette, bevel, boolean windows, UV unwrap, AO bake into an atlas, LODs, export).
- [x] Cathedral GLB: north tower with spire, unfinished south tower, glazed diamond-pattern roof, pointed-arch windows
      cut with real depth, buttresses, apse; one mesh per LOD with one atlas (base colour + baked AO, optional normal);
      2-3 LODs; meshopt or Draco compression with the matching decoder vendored for Three.js r160.
- [x] Loaded through the level manifest and placed exactly where the procedural one stands (same bearing, scale); the
      procedural version kept as fallback behind a flag.
- [x] Comparison in Comments with screenshots: look (close and at game distance), draw calls, triangles, file size,
      frame time at 2560x1440 DPR 2 High and on Low.
- [x] `docs/adr/0003-blender-pipeline.md`: when to use Blender (landmarks, crowns, lobbies, floor modules) and when to stay
      procedural (OSM city), how to rebuild models.

## Comments
- Main session 2026-11-23: headless Blender verified (bevel modifier, GLB export with Draco, EEVEE PNG render). Decision: scripts, not the Blender MCP (reproducible, works for subagents without a GUI). Vendor three r160 `DRACOLoader` and `libs/draco/` decoder for loading.
- Built (builder, 2026-11-23): `scripts/blender/lib.py` + `cathedral.py` (see ADR 0003 for the run command), `assets/levels/kosice/cathedral.glb` (manifest asset `cathedral`),
  `DRACOLoader` in `js/assets.js`, decoder in `vendor/draco/` (script `scripts/vendor-addons.mjs` extended, `build.mjs` copies it), `blenderCathedral` + `?cathedral=procedural` flag in `js/landmarks/kosice.js`,
  `tests/browser/cathedral-compare.mjs` (fixed poses, both models). Same local frame, position and rotation as the procedural one.
- Model: 5-facet apse, aisles with pointed windows cut 0.8 m deep and glazed with mullions, clerestory, transept gables with stepped 4-layer portals and hoods, west front with portal and big window,
  north tower 59 m (belfry louvres, angle piers, string courses, 12-facet Baroque spire, four corner turrets), lower Matthias tower with a small copper cap, flying buttresses, ~60 pinnacles, sanctus spirelet,
  glazed diamond roof (yellow, green, red, blue, black). Bevel helper exists but is off (tiny faces wasted atlas space; invisible at game distance).
- Numbers (GLB vs procedural): triangles LOD0/1/2 18422 / 9312 / 3833 vs 1164; cathedral draw calls 2 vs ~12 (frame at 2560x1440 DPR 2: High 704 vs 714 calls, 2.44M vs 2.40M triangles;
  Low 192 vs 206 calls, 0.558M vs 0.540M); file 1.37 MB (WebP atlas 2048 + ORM + emission, Draco meshes); frame time p50/p90 16.7 ms (vsync bound) for both on High and Low, no console errors.
  npm test 70 pass, `check.mjs all` High and Low PASS, dist build ok.
- Screenshots: Blender previews `tests/browser/out40/blender/` (ne, south, west, aerial, apse, portals, lod0-2); game poses `tests/browser/out40/compare/{glb,procedural}-high-{far,mid,northwest,close,west,south}.png`; full game shots `tests/browser/out40/glb-high`, `glb-low`.
- Open: atlas density is only ~10 px/m (packing efficiency 33 %), so stone is soft at close range; a 4096 atlas or fewer tiny islands would fix it. Roof pattern is more colourful than the real roof (mostly yellow and green); the developer may want it toned down. Optional normal map not done. The Blender "mesh not valid" warning on one role mesh is harmless (export and game fine). LOD2 is rough close up but only shows beyond 380 m.
