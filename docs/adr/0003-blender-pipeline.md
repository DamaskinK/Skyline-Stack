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
