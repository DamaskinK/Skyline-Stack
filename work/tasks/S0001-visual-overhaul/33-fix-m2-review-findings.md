# 33: Fix the M1-M2 review findings

**What to build:** the findings of the Opus review of c623cdb..53827ec are fixed. Each item names the place and the fix.

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** claimed

- [ ] 1. Level runs no longer write into the Endless high scores (`js/ui.js` ~233 `addScore(game.cityId, ...)`,
      `js/game.js` ~57 and ~197 `prevBest` from the Endless list). Save form and NEW RECORD / fanfare only in Endless.
      A failed level run shows the level result screen with height and 0 stars (Retry, Menu), not the Endless save form.
      Core or UI test where it fits.
- [ ] 2. Black rectangles on High: GTAO draws sprites and transparent `depthWrite: false` meshes (dust puffs from
      `FX.dust`, `js/fx.js` ~28) into its normal/depth buffer as solid squares. After `new GTAOPass(...)` in `js/post.js`
      ~48, wrap `gtao.overrideVisibility` (and its restore) so it also hides `isSprite` objects and transparent
      materials with `depthWrite === false`. Verify on High with camera modes 0, 1 and 2 right after a landing
      (freeze a frame, as the reviewer did; repro script idea: hide sprites -> boxes vanish).
- [ ] 3. `js/post.js` `build()` disposes the old bloom pass, grade pass and output pass before rebuilding (GPU leak on
      every quality switch).
- [ ] 4. `js/far-ring.js` ~130 `blocksView` clears tall blocks from the sector behind the tower as seen from the
      current default camera: derive it from `camOffsets[0]` (export one shared camera constant) instead of the
      hard-coded (-9, -22).
- [ ] 5. `js/ui.js` ~83 Endless note no longer says "Weather turns every 15 floors"; build it from the city's weather
      segments or drop the sentence.
- [ ] 6. `js/level-scene.js` ~22 disposes geometries, materials and textures of the old level group before `clear()`.
- [ ] 7. The loading screen does not wait for `type: 'audio'` assets (`js/assets.js` ~40): start the game when the
      rest is in, hand the audio to the music director when it arrives (`music.js` already handles late audio).
- [ ] 8. `scripts/serve.mjs` ~17: bad percent-encoding answers 400 instead of crashing the server.
- [ ] 9. `build.mjs` copies `CREDITS.md` into `dist/` (attribution for CC-BY tracks and OSM until the credits screen).
- [ ] `npm test` and `node tests/browser/check.mjs all` (High and Low) pass; screenshots on High in camera modes 0-2
      show no dark squares.
