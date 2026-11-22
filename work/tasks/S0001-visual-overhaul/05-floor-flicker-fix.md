# 05: Floor flicker fix

**What to build:** the ground never flickers at any camera angle or preset. Ground layers stop being stacked coplanar
planes: one merged ground mesh (roads, sidewalks, markings in an atlas or as geometry with real height steps), and a
higher camera near plane.

**Blocked by:** 04

**Type:** bug
**Status:** ready-for-agent
**Read:** plan "Rendering: Floor flicker fix"; brief "Now".

- [ ] Flicker check from 04 passes on Low, Medium and High, menu orbit and in-game cameras
- [ ] Roads, sidewalks, zebra crossings and dashes still look as before or better
- [ ] Frame time not worse than the 04 baseline
