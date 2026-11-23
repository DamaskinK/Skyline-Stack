# 09: Fix the S0002 review findings

**What to build:** the findings of the Opus review of 810c9ec..37509a5 are fixed (details, line numbers and probe
scripts in the review summary below).

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** ready-for-agent

- [x] 1. Blender cathedral disappears on the second Kosice plot load / every Retry: `js/landmarks/kosice.js`
      `blenderCathedral(src)` moves LOD nodes out of the cached GLTF scene and disposes them. Build from
      `src.clone(true)` (or clone each LOD node). Test: load plots 4, 3, 4 -> cathedral meshes present every time.
- [x] 2. GPU buffer leak per plot load: (a) `js/district-towers.js` dispose only frees InstancedMesh - dispose the
      per-tower foundation/crown geometries (or cache them); (b) `js/level-scene.js` `disposeGroup` must call
      `InstancedMesh.dispose()`. Test: 3 rounds of 5 Kosice + 5 Newtown plot loads with finished towers -> WebGL buffer,
      VAO and texture counts stay flat (add the probe to tests/browser).
- [x] 3. Newtown draw calls (1397 on High): procedural `cityBlock` boxes (`js/world.js` ~193/196) draw 6 groups each -
      merge shop boxes per shop material and roofs into one mesh (or at least two groups per box); merge each finished
      tower's floors into one mesh per material (`js/district-towers.js` realTower). Target: Newtown High under ~700.
- [x] 4. Skyline bonus can never be earned in Kosice: raise `SKYLINE_RADIUS_M` (js/core/district.js) to ~1000 m (and
      test with a full district at targets that at least one plot earns it).
- [x] 5. Two towers on one spot after the district map: `startGame` and `toMenu` (js/ui.js) clear or rebuild district
      towers without the current plot.
- [x] 6. "Next city opens at the goal" is not implemented: when the goal is first reached mark the next city opened in
      the store and have the city choice read it; Newtown's line must not say "whole district is built" while plots
      are unbuilt.
- [x] 7. Quality change resets cars: call `People.applyTraffic()` in the quality handler instead of fixed counts.
- [x] 8. Remove Berlin, Dubai, New York data (js/levels.js, js/music.js TRACKS, js/people/styles.js, tests); Tokyo becomes
      order 3, `nextLevel('prague')` is Tokyo (ADR 0004).
- [x] 9. Newtown music: use the now unused CC0 track Empacotatron (`assets/audio/music/berlin.ogg`, Fupi) for Newtown;
      convert it to mp3 for Safari (no ffmpeg here: Blender can mix down audio headless via the sequencer,
      `bpy.ops.sound.mixdown`), add it to the Newtown manifest and `TRACKS` (bpm and key), fix CREDITS "Used for".
- [x] 10. Migrated S0001 progress: set `counted` with the plot's own rules (`resultCounts`), keep best height and stars.
- [x] 11. CREDITS.md Draco/cathedral rows into the table; delete `scripts/blender/__pycache__` and ignore it.
- [x] `npm test`, check.mjs High/Low (Kosice and Newtown), plot-run, newtown-run, district-life pass.

## Comments

- 1: `blenderCathedral` clones the cached GLTF scene and its materials; plots 4, 3, 4 each show 6 cathedral meshes in 3 LODs (tests/browser/cathedral-reload.mjs).
- 2: tower geometry is merged per tower and freed on clear; `disposeGroup` calls `InstancedMesh.dispose()`. 4 rounds of 5 Kosice + 5 Newtown loads with a full district:
  buffers 1386 -> 2273 before (+300 a round), 725 -> 766 after (flat within lazy-upload noise, +4 %). tests/browser/gpu-leak.mjs asserts under +10 %.
  Texture count creeps by a few per round in Kosice both before and after (not from this ticket).
- 3: Newtown High with a full district (tests/browser/draw-calls.mjs): 2347 -> 763 draw calls (blocks 873 -> 103 in the near ring, towers 846 -> 96); without towers 1481 -> 631.
  check.mjs now reports 515 (Newtown) and 648 (Kosice) calls on High, 175 / 196 on Low. A total of 763 is a little over the ~700 target, the rest is shadow pass and scenery.
- 4: radius 1000 m; a Kosice test shows the Juzna plot earns it with a full district.
- 5: `startGame` rebuilds district towers without the current plot (or clears them), `toMenu` clears them.
- 6: the first time the goal is reached the next city (`nextLevel`) is marked opened in the store; the city choice lists an opened but unbuilt city as a disabled card.
  Newtown's line now reads "Newtown has no next city; keep building it."
- 7: quality change calls `People.applyTraffic()`; the fixed 14/34 in `applyQuality` is gone.
- 8: Berlin, Dubai, New York removed from levels, TRACKS, people styles and tests; Tokyo is order 3. Left alone: `dubai.mp3`, `new-york.mp3` and their CREDITS rows (unused files).
- 9: `scripts/blender/ogg_to_mp3.py` mixed Empacotatron to `assets/audio/music/newtown.mp3` (160 kbps, 80.7 s like the OGG); `berlin.ogg` removed; Newtown manifest and TRACKS (bpm 168, root F, measured in the browser) wired; CREDITS and SOURCES updated.
- 10: migration rebuilds a result from the S0001 stars and asks `resultCounts`; 2 stars at 27 floors no longer count on the cathedral (40 % perfect rule unknown), 3 stars do.
- 11: Draco and cathedral rows moved into the CREDITS table; `__pycache__` untracked and ignored.
- Checks: npm test 74 pass; check.mjs high/low for Kosice and Newtown PASS; plot-run, newtown-run, district-life PASS.
