# 09: Fix the S0002 review findings

**What to build:** the findings of the Opus review of 810c9ec..37509a5 are fixed (details, line numbers and probe
scripts in the review summary below).

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** ready-for-agent

- [ ] 1. Blender cathedral disappears on the second Kosice plot load / every Retry: `js/landmarks/kosice.js`
      `blenderCathedral(src)` moves LOD nodes out of the cached GLTF scene and disposes them. Build from
      `src.clone(true)` (or clone each LOD node). Test: load plots 4, 3, 4 -> cathedral meshes present every time.
- [ ] 2. GPU buffer leak per plot load: (a) `js/district-towers.js` dispose only frees InstancedMesh - dispose the
      per-tower foundation/crown geometries (or cache them); (b) `js/level-scene.js` `disposeGroup` must call
      `InstancedMesh.dispose()`. Test: 3 rounds of 5 Kosice + 5 Newtown plot loads with finished towers -> WebGL buffer,
      VAO and texture counts stay flat (add the probe to tests/browser).
- [ ] 3. Newtown draw calls (1397 on High): procedural `cityBlock` boxes (`js/world.js` ~193/196) draw 6 groups each -
      merge shop boxes per shop material and roofs into one mesh (or at least two groups per box); merge each finished
      tower's floors into one mesh per material (`js/district-towers.js` realTower). Target: Newtown High under ~700.
- [ ] 4. Skyline bonus can never be earned in Kosice: raise `SKYLINE_RADIUS_M` (js/core/district.js) to ~1000 m (and
      test with a full district at targets that at least one plot earns it).
- [ ] 5. Two towers on one spot after the district map: `startGame` and `toMenu` (js/ui.js) clear or rebuild district
      towers without the current plot.
- [ ] 6. "Next city opens at the goal" is not implemented: when the goal is first reached mark the next city opened in
      the store and have the city choice read it; Newtown's line must not say "whole district is built" while plots
      are unbuilt.
- [ ] 7. Quality change resets cars: call `People.applyTraffic()` in the quality handler instead of fixed counts.
- [ ] 8. Remove Berlin, Dubai, New York data (js/levels.js, js/music.js TRACKS, js/people/styles.js, tests); Tokyo becomes
      order 3, `nextLevel('prague')` is Tokyo (ADR 0004).
- [ ] 9. Newtown music: use the now unused CC0 track Empacotatron (`assets/audio/music/berlin.ogg`, Fupi) for Newtown;
      convert it to mp3 for Safari (no ffmpeg here: Blender can mix down audio headless via the sequencer,
      `bpy.ops.sound.mixdown`), add it to the Newtown manifest and `TRACKS` (bpm and key), fix CREDITS "Used for".
- [ ] 10. Migrated S0001 progress: set `counted` with the plot's own rules (`resultCounts`), keep best height and stars.
- [ ] 11. CREDITS.md Draco/cathedral rows into the table; delete `scripts/blender/__pycache__` and ignore it.
- [ ] `npm test`, check.mjs High/Low (Kosice and Newtown), plot-run, newtown-run, district-life pass.
