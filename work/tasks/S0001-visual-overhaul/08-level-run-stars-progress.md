# 08: Level run with target, stars, result screen and progress

**What to build:** levels are data definitions; Kosice is the first and only one so far, using the current scene. A run
has a target height; reaching it ends the level with 1-3 stars (target / at most one life lost / at least 50 % perfect).
A result screen shows stars, height, perfects and residents with Retry and Continue. Progress (best stars, best height,
opened levels, Endless scores per city) is saved under new versioned keys.

**Blocked by:** 02

**Type:** feature
**Status:** done
**Read:** plan "Level definitions", "Progress store", user stories 28-39.

- [x] Core tests: star rules, target reached ends the run, next level opens on one star
- [x] Progress survives reload; old keys are ignored without errors
- [x] HUD shows progress to the target
- [x] Endless keeps going past any target

## Comments
- Core: `Run(diff, { level })` ends the run on reaching the target with a `target` event (stars) then `over` (result: completed, stars, landings). Pure rules in `js/core/stars.js` (stars add up: 1 target, +1 at most one life lost, +1 at least 50 % perfect landings of all landings; unlock on 1 star). Level data in `js/levels.js` (Kosice full, five others `built: false`).
- Progress under `tb3d_progress_v3` (best stars, best height, opened, Endless top 10 per city). Old `tb3d_scores_v2` is no longer read; Endless scores moved into the new store, so old Endless scores are gone.
- UI: mode cards on New Game (Kosice, Endless), HUD `TARGET n / target`, level result screen (stars, height, perfects, residents; Retry, Continue to menu).
- Checked: 22 core tests; scripted browser run with the target lowered to 3 (result screen, progress saved, survives reload, garbage old and new keys give no errors); check.mjs all PASS. HUD still shows the old weather text ("RAIN IN 14 FL"): weather segments belong to a later ticket.
