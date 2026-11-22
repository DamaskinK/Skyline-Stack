# 05: Floor flicker fix

**What to build:** the ground never flickers at any camera angle or preset. Ground layers stop being stacked coplanar
planes: one merged ground mesh (roads, sidewalks, markings in an atlas or as geometry with real height steps), and a
higher camera near plane.

**Blocked by:** 04

**Type:** bug
**Status:** done
**Read:** plan "Rendering: Floor flicker fix"; brief "Now".

- [x] Flicker check from 04 passes on Low, Medium and High, menu orbit and in-game cameras
- [x] Roads, sidewalks, zebra crossings and dashes still look as before or better
- [x] Frame time not worse than the 04 baseline

## Comments
- Ground rebuilt: grass 0, roads +2 cm, markings +3.5 cm, plaza and sidewalks 6 cm slabs with a curb; road and sidewalk
  strips are cut where they cross, so no two surfaces overlap in one plane. Roads, sidewalks and plaza are 3 merged meshes
  with world-space UVs (draw calls 404 -> 393). Props on the slabs were lifted to the slab top.
- Camera near plane 0.1 -> 0.5 (5x depth precision). Texture anisotropy 4 -> 8 (less shimmer at grazing angles).
- Flicker checks pass on Low, Medium and High (depth <= 0.58 %, shadow 0.00 %); 60 fps on High.
- The original flicker was never reproduced by the checks (see 04). **Ask the developer to look again** in the game; if
  something still flickers, describe where (ground, facades, shadows) and when (menu, in game, which weather).
