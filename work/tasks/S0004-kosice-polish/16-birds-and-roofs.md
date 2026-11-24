# 16: Real birds and lived-in roofs

**What to build:** developer, 2026-11-24: "birds look very strange and fly into the camera; panel-block roofs are empty;
tile roofs need unevenness; pigeons sitting would be nice".

**Blocked by:** None (can start immediately).

**Type:** improve
**Status:** ready-for-agent
**Model:** opus (skyline-modeler)

- [x] Bird models from Blender: pigeons (grey, iridescent neck), swallows/swifts, crows; flapping and gliding cycles
      (vertex animation or a few baked poses), LODs; flocks keep a minimum distance from the camera and never pass
      through it; pigeons sit on roof ridges, cornices, the cathedral and the square, and take off when the crane passes.
- [x] Panel-block roofs: parapet, lift machine rooms, stair exits, vent stacks, antennas, satellite dishes, roof
      membrane texture with patches and drains; varied per block.
- [ ] Tile roofs (old town): uneven tiles (slight sag and row offsets in the normal map or geometry), chimneys with
      caps, roof windows, gutters; moss/weathering variation.
- [ ] Draw calls within budget (instancing), audit and flicker pass; screenshots from the game camera.

## Comments
- Birds (skyline-modeler, 2026-11-24): `scripts/blender/birds.py` -> `assets/models/birds.glb` (73 KB, Draco, own manifest `assets/models/manifest.json`, loaded for every level). Feral pigeon (grey, dark head,
  green/purple neck, two black wing bars, dark primaries, pale underwing, dark tail band), common swift (sickle wings, forked tail, pale throat), hooded crow (grey body, black head/wings/tail,
  four slotted primaries). Lofted bodies, wings as cambered airfoils hinged at shoulder and wrist; each flyer has LOD0/LOD1 (pigeon 368/180, swift 290/160, crow 600/180 tris) with two morph
  targets (`up`, `down`, base = glide); the sitting pigeon (334 tris, red legs, folded wings) has `peck` and `look`. Three r160 has no per-instance morphs: `js/birds.ts` turns the deltas into
  vertex attributes and blends them per instance in the vertex shader (one material, 7 InstancedMeshes, no shadows).
- Behaviour: flocks fly loops around home points 40-110 m out (swifts a figure of eight), with banking, flap/glide cycles; every bird keeps 12 m from the camera and 7.5 m from the tower axis
  (positions inside are pushed to the sphere). Pigeons sit on tile ridges, flat-roof parapets (`near.userData.roofs`, collected in near-ring.ts), up-facing ledges of the landmark meshes above 6 m,
  and the plaza (pecking); they take off when the hook is within 13 m or the jib within 8 m (or now and then), circle, and land again. The old wire birds in world.ts are gone (the 42 random
  draws are kept so the plane and the balloon do not move).
- References: https://commons.wikimedia.org/wiki/File:Feral_pigeon_in_flight.jpg, File:Columba_livia_-flight-4.jpg, File:Pigeon_on_a_roof_(24068035560).jpg, File:Common_Swift_2025_07_18_01.jpg,
  File:Apus_apus_01.jpg, File:Hooded_crow_(Corvus_cornix_cornix)_in_flight_Kemeri.jpg (local copies /private/tmp/claude-501/refs/s4-16/).
- Checks (wip worktree, :8002): perf 2560x1440 DPR 2 High 575 calls / 1.54 M tris p90 16.7 ms, Low 133 / 0.48 M p90 16.7 ms; flicker PASS; audit 0 findings on plots 0, 1, 2, 4; plot 3 has
  2 building-water findings from the uncommitted OSM/plot data of ticket 12 (not birds). Previews /private/tmp/claude-501/s416/birds/, game poses tests/browser/out-s4-16/ (`tests/browser/bird-poses.mjs`).
- Panel roofs: `scripts/blender/roofprops.py` -> `assets/levels/kosice/roofprops.glb` (27 KB, 12 modules, one vertex-colour material with contact occlusion, bevelled boxes): lift machine room
  (door, louvre, cowl, 328 tris), stair exit with a mono-pitch slab, three capped vent heads on a plinth, soil pipe, TV mast with two Yagi arrays and guys, satellite dish, roof outlet, hatch;
  plus chimney, roof window, gutter and downpipe for the tile roofs. Textures (numpy, tiling): `roof_membrane_{col,nrm}.webp` (8 m: 1 m bitumen strips with lapped seams, staggered end
  laps, patches, ponding stains; 13 + 6 KB) on every flat roof, `roof_tiles_{col,nrm}.webp` (for the tile roofs). `js/roof-props.ts` places per panel block (and mid blocks over 12 m) a lift
  room per ~16 m stair section (stair exits on blocks up to 5 storeys), vents, drains, pipes, 1-3 masts, 0-4 dishes looking south near the parapet, a hatch, all varied by the block hash,
  kept 0.45 m off the parapet and apart; one InstancedMesh per module (High within 330 m, Low 170 m and fewer kinds). near-ring.ts: two lines (membrane material, `buildRoofProps`).
- Checks after the roofs: flicker --plot all --quality all PASS; audit --plot all 0 findings; perf 2560x1440 DPR 2 High 567 calls / 1.53 M tris p90 16.7 ms, Low 139 / 0.48 M p90 16.7 ms.
  Shots: tests/browser/out-s4-16/p0-high-roof-panel-{top,far}.png.
