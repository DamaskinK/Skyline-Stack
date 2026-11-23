# 06: The district comes alive as it fills

**What to build:** each finished plot adds life to the city: more pedestrians and cyclists, open shops with lit windows,
more traffic, small events (a market stall, a street musician) scaled by district progress.

**Blocked by:** 04, S0001 ticket 38

**Type:** feature
**Status:** done

- [x] Life density follows district progress (0 plots -> quiet, 5 plots -> busy), within the perf budget.
- [x] Screenshots at 0, 2 and 5 finished plots.

## Comments
- Density follows finished plots (0-5, counted plots of the city): `People.setDistrictLife(n)` is called from `showDistrictTowers` (js/district-towers.js), so game.js and ui.js needed no change. Share of the preset maximum: 30 / 45 / 62 / 78 / 90 / 100 %. Maximum per preset (Low / Medium / High): walkers 14 / 26 / 36, seated 3 / 6 / 8, standing 3 / 5 / 7, cyclists 3 / 5 / 7, cars 14 / 28 / 40 (`lifeCount` in js/fx.js; cars through `traffic.setCount`).
- New in js/street-life.js (instanced, count set by progress): shopfronts on the walls beside the streets (up to 16: 0 / 3 / 6 / 10 / 13 / 16), market stalls with vendors and customers (0 / 0 / 2 / 4 / 6 / 8), street musicians with an audience and drifting notes (1 from 3 plots, 2 at 5). Shop windows are lit at night through `glowMats` of world.js.
- Fixes from ticket 04: the middle ring (js/far-ring.js) keeps a 48 m circle round every finished plot (read from the progress store; the played plot excluded). Far finished towers: real height, a shaft that widens with distance, a lit crown (3.5 floors, glows at night) and a mast with a beacon; fog is off for them so the haze no longer swallows them at 1-2 km.
- Checks: `npm test` 72 passed; `check.mjs all` High and Low pass (High 640 calls, 60 fps; Low 193 calls); `plot-run.mjs --quality high` all PASS; new `tests/browser/district-life.mjs` seeds the progress store with 0 / 2 / 5 finished plots, High 2560x1440 DPR 2: 698 / 730 / 824 draw calls, p90 16.7 ms on all three; Low 198 / 208 / 220 calls, 16.7 ms. No console errors. Screenshots in tests/browser/out-s2-06 (plots0/2/5 `-game`, `-street`, `-stall`, `-busker`, `-far-tower`, night variants, `hd/`, `low/`).
- Open: the night shots light the windows by hand (the sky is not switched); the far tower is hidden behind nearer houses when seen from street level, it clears the roofs from the tower-top camera height.
