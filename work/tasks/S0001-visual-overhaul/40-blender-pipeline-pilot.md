# 40: Blender pipeline pilot: St. Elisabeth Cathedral as a GLB

**What to build:** a reproducible Blender pipeline (headless Python scripts in the repo) and, as the pilot, St. Elisabeth
Cathedral rebuilt in it, compared with the procedural version of ticket 14. Developer, 2026-11-22: Blender may make
better and more optimised models. Blender is installed at /Applications/Blender.app.

**Blocked by:** None (can start immediately).

**Type:** feature
**Status:** ready-for-agent

- [ ] `scripts/blender/` with a build script per model run by `blender -b -P <script> -- <out.glb>`; shared helpers
      (materials from the landmark palette, bevel, boolean windows, UV unwrap, AO bake into an atlas, LODs, export).
- [ ] Cathedral GLB: north tower with spire, unfinished south tower, glazed diamond-pattern roof, pointed-arch windows
      cut with real depth, buttresses, apse; one mesh per LOD with one atlas (base colour + baked AO, optional normal);
      2-3 LODs; meshopt or Draco compression with the matching decoder vendored for Three.js r160.
- [ ] Loaded through the level manifest and placed exactly where the procedural one stands (same bearing, scale); the
      procedural version kept as fallback behind a flag.
- [ ] Comparison in Comments with screenshots: look (close and at game distance), draw calls, triangles, file size,
      frame time at 2560x1440 DPR 2 High and on Low.
- [ ] `docs/adr/0003-blender-pipeline.md`: when to use Blender (landmarks, crowns, lobbies, floor modules) and when to stay
      procedural (OSM city), how to rebuild models.

## Comments
- Main session 2026-11-23: headless Blender verified (bevel modifier, GLB export with Draco, EEVEE PNG render). Decision: scripts, not the Blender MCP (reproducible, works for subagents without a GUI). Vendor three r160 `DRACOLoader` and `libs/draco/` decoder for loading.
