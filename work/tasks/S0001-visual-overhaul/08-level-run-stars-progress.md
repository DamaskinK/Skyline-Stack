# 08: Level run with target, stars, result screen and progress

**What to build:** levels are data definitions; Kosice is the first and only one so far, using the current scene. A run
has a target height; reaching it ends the level with 1-3 stars (target / at most one life lost / at least 50 % perfect).
A result screen shows stars, height, perfects and residents with Retry and Continue. Progress (best stars, best height,
opened levels, Endless scores per city) is saved under new versioned keys.

**Blocked by:** 02

**Type:** feature
**Status:** claimed
**Read:** plan "Level definitions", "Progress store", user stories 28-39.

- [ ] Core tests: star rules, target reached ends the run, next level opens on one star
- [ ] Progress survives reload; old keys are ignored without errors
- [ ] HUD shows progress to the target
- [ ] Endless keeps going past any target
