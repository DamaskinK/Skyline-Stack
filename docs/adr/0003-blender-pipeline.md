# 0003: Blender pipeline for hand-modelled landmarks

**Status:** accepted, 2026-11-23

## Context
The procedural landmarks of ticket 14 (boxes, lathes, merged by material) top out at about 1.2k triangles for the cathedral and
cannot carry windows with depth, stepped portals, flying buttresses or baked ambient occlusion. Blender 5.3 is installed and
runs headless, so models can be built from scripts that live in the repo (no GUI, no MCP).

## Decision
- `scripts/blender/lib.py` (helpers) and one script per model (`cathedral.py`). Run:
  `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/blender/cathedral.py -- assets/levels/kosice/cathedral.glb --stage full --size 2048 --previews <dir> --lods`
  (`--stage geom` skips texturing for fast shape iteration, about 5 s; a full bake takes about 30 s).
- Pipeline: closed shells in game coordinates -> Exact boolean (union of masses, cut windows and stepped portals with real depth)
  -> role per face (stone, tiles, copper, gold, glass, dark) -> UV unwrap with a texel density per role -> one packed atlas
  (Cycles bake of colour, AO, emission, roughness/metal; AO goes in the red channel of the ORM map as glTF occlusion)
  -> Decimate LODs (planar dissolve + collapse) -> Draco GLB -> EEVEE previews to look at.
- Roof tiles are the one exception to "one atlas": the glazed diamond pattern repeats, so it is a 3 m tiling texture on its own material
  (atlas texels at ~10 px/m would blur a 0.5 m tile). Each LOD is therefore one mesh with two primitives.
- Game side: the GLB is a level asset (manifest, type gltf); `js/assets.js` has a `DRACOLoader` with the decoder in `vendor/draco/`
  (vendored by `scripts/vendor-addons.mjs`, copied to `dist/` by `build.mjs`). Placement and rotation stay in the landmark module.
  Procedural fallback: `?cathedral=procedural` in the URL, or automatically when the GLB failed to load.
- Night: the atlas carries an emission map (lit windows, floodlit stone); the game scales it with the scenery glow (`glowMats`).

## When to use Blender, when not
Use it for landmarks, tower crowns and lobbies, floor modules (anything with few instances, rich shape, seen close).
Stay procedural for the OpenStreetMap city (hundreds of unique footprints, generated from data), vegetation, and anything
that must change at run time.

## Consequences
- Models are rebuilt by running the script; the GLB is committed (it is a level asset). Previews are not committed.
- Cost of the cathedral: LOD0 18.4k triangles (procedural 1.2k), 2 draw calls instead of about 14, 1.4 MB file (mostly the WebP atlas).
- Texture memory: a 2048 colour atlas, 2048 ORM and a 2048 emission map (emission could drop to 512 later).

## Update 2026-11-23 (S0004 01): all Kosice landmarks, tiling stone
- `scripts/blender/pipeline.py` holds the shared assembly (`assemble`): union, cut, roles, UV, bake, LODs, GLB, previews. A model script only builds its shells
  (`theatre.py`, `urban.py`, `chapel.py`, `monuments.py --which immaculata|fountain`, `cathedral.py`) and says which roles tile.
- A role that repeats gets its own material (3 m roof tiles; the cathedral's ashlar stone, 3.2 m period, 1024 colour + normal map). Its occlusion still comes from the atlas
  through a second UV set (`ao`, glTF `texCoord` 1), so portals and window reveals stay dark. The cathedral therefore has three materials (atlas, tiles, stone); the other models
  have one or two.
- The decimated LODs are cleaned (degenerate faces dissolved, `Mesh.validate`) before export: the "mesh not valid" exporter warning is gone.
- Game side: `js/landmarks/kosice.ts` loads every model through one `blenderModel(id)`; materials without an emission map get a flat warm night tint by name (`_tiles`, `_stone`).
  `?landmarks=procedural` keeps the procedural parts for all of them.

## Update 2026-11-23 (S0004 02): house kit
- `scripts/blender/housekit.py` builds `assets/levels/kosice/housekit.glb`: 26 small modules (one 3 m bay, one 3.4 m storey) in three kits (old town, panel block, in-between) plus a flat `_far` partner each.
  No bake, no atlas: material classes (`kit_plaster`, `kit_accent` tinted per instance, `kit_detail` and `kit_glass` with vertex colours and a hand-set occlusion), UVs in metres.
- `js/house-kit.ts` instances them along every footprint edge (one InstancedMesh per module and class, about 40 draw calls per plot); `js/near-ring.ts` keeps hip roofs (new: gable roofs, dormers) and draws the shadow from an
  invisible proxy of the walls, because modules do not cast shadows. Detail radius 48 m (High) / 32 m (Low); beyond it the flat plates. `?houses=procedural` keeps the old facades.
- Lessons: no coplanar faces closer than 3 cm (flicker check), flat strips instead of 5 cm deep frame bars, an interior wall behind every module so a camera inside a footprint sees a plain wall.

## Update 2026-11-24 (S0004 07): baked far facades
- `scripts/blender/housebake.py` (run after `housekit.py` changes) renders the near modules in front view per cell (one storey of 1-4 bays, or a cornice / parapet strip) with Cycles in emission-only passes
  (albedo, class masks, depth, ambient occlusion) into three 2048x1024 atlases next to `housekit.glb`: `housefacade_col.webp` (sRGB, lossy), `_nrm.webp` (normal x,y from the depth pass, AO in blue) and `_msk.webp`
  (R plaster, G accent, B glass), 8 px wrapped gutters, plus `housefacade.json` (cell rectangles). About 0.35 MB in all (KTX2 is not available).
- Game side: `js/baked-facades.ts` draws far walls as plain quads that repeat a cell along the wall (shader `textureGrad` on `fract` of the wall coordinate), tinted per house through the masks, glass lights at night per bay.
  Near-ring houses beyond the kit radius and the whole middle ring use it (one mesh each); bays, order and stretch match `addHouse`, so the switch to the real modules does not shift.
  Without the files the old flat `_far` plates and canvas facades stay.
- Lesson: `onBeforeCompile` sees `#include <chunk>` unexpanded; to change a line inside a chunk, replace the include by the edited `THREE.ShaderChunk` text.
