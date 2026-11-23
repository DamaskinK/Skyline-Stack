# 19: 3D menu, city intro and transitions

**What to build:** the main menu sits over a slow 3D fly-over of the selected city; before a level an intro card with the
city name and a camera pass over its landmarks; smooth transitions between screens.

**Blocked by:** 14, 18

**Type:** feature
**Status:** done
**Read:** plan "Interface"; user stories 68, 72, 75.

- [x] Fly-over uses the level's scene (Kosice for now) with no extra download
- [x] Intro can be skipped with click / Space
- [x] Transitions do not drop frames below budget

## Comments
- Menu: on start the UI loads the real scene of the last played city (else Kosice) on its centre plot (Kosice: Cathedral square) behind a small "Loading ..." pill; the old procedural demo shows until it is ready, the swap happens behind a short black veil. Demo tower uses the city's building type. Camera is a slower orbit that rises and sinks. Quit to menu reloads the last played city's centre plot if another plot was open.
- Intro (plot mode only): place card (city, plot, "plot n of 5") over a camera pass through the plot's `landmarksInView` (path maths in `js/core/intro-path.ts`, tested); no landmarks in view gives a quarter turn round the plot. Space, Enter, Esc or click skips. The run starts after it. Endless and level starts have no intro (kept for the old checks).
- No extra download: the scene is the one the plot needs anyway. Checks `tests/browser/s1-19.mjs` (desktop and phone, low and high): frames p95 16.7 ms in menu, intro and play; check.mjs all high passes, no console errors. Screenshots in `tests/browser/out-s1-19/`.
- Open: the pass passes close to the theatre; distance/height of the viewpoints (`viewOf` in intro-path.ts) may want tuning by eye.
