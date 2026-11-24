# 16: Real birds and lived-in roofs

**What to build:** developer, 2026-11-24: "birds look very strange and fly into the camera; panel-block roofs are empty;
tile roofs need unevenness; pigeons sitting would be nice".

**Blocked by:** None (can start immediately).

**Type:** improve
**Status:** ready-for-agent
**Model:** opus (skyline-modeler)

- [ ] Bird models from Blender: pigeons (grey, iridescent neck), swallows/swifts, crows; flapping and gliding cycles
      (vertex animation or a few baked poses), LODs; flocks keep a minimum distance from the camera and never pass
      through it; pigeons sit on roof ridges, cornices, the cathedral and the square, and take off when the crane passes.
- [ ] Panel-block roofs: parapet, lift machine rooms, stair exits, vent stacks, antennas, satellite dishes, roof
      membrane texture with patches and drains; varied per block.
- [ ] Tile roofs (old town): uneven tiles (slight sag and row offsets in the normal map or geometry), chimneys with
      caps, roof windows, gutters; moss/weathering variation.
- [ ] Draw calls within budget (instancing), audit and flicker pass; screenshots from the game camera.
