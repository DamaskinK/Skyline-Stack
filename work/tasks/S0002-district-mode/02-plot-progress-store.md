# 02: Plot progress and migration from S0001

**What to build:** progress per plot (best stars, best height, residents, counted) and per city (opened, goal reached)
in a new versioned key; S0001 Kosice level progress carried over.

**Blocked by:** 01

**Type:** feature
**Status:** done
**Read:** plan "Progress store"; S0001 ticket 08 Comments (current store).

- [x] Read/write helpers with tests; bad or old data never breaks loading.
- [x] S0001 Kosice stars and best height map onto one Kosice plot (choose the simplest mapping, note it in Comments).
- [x] Endless high scores per city unchanged.

## Comments
Pure store in `js/core/district-progress.js` (sanitizeDistrict, recordCityPlot, migrateFromLevels, cityProgress); browser helpers `loadDistrictProgress` / `saveDistrictResult` in `js/settings.js`.
New key `tb3d_district_v1`, shape `{ v: 2, cities: { id: { plots: { plotId: {stars, bestHeight, residents, counted} }, opened, goalReached } } }`; bad/old data gives an empty store.
Migration (first load without Kosice district data, S0001 key read-only): S0001 Kosice stars and best height -> the cathedral plot (last, the S0001 site); counted = stars >= 1; the earlier plots stay empty, so the cathedral shows as built but not yet reachable by the opening rule (ticket 03+ may treat it as is).
S0001 key `tb3d_progress_v3` and its Endless functions are untouched. `npm test` 70 passed (5 new). Browser check not run (no rendering touched); store smoke-tested in Node with a fake localStorage.
