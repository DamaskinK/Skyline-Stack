# 02: Core and data to TypeScript

**What to build:** convert js/core/*, js/config.js, js/levels.js, js/building-types.js, js/settings.js and their tests to strict TypeScript with real types (no `any` except at Three.js edges, explained),
no behaviour change.

**Blocked by:** 01

**Type:** improve
**Status:** done

- [x] Typecheck, Vitest and all browser checks (check.mjs High/Low, plot-run, newtown-run) pass.

## Comments
- Converted with `git mv`: js/core/{district-progress,district,run,stars,tram-route,weather}, js/{config,levels,building-types,settings} and all eight tests in tests/core. Imports keep `.js` specifiers.
- New js/types.ts holds the shared types for later batches: Level, Plot, District, BuildingTypeId/BuildingType/Trait, Difficulty, Weather/WeatherCycle/WeatherPhase/WeatherSegment, Block/BlockKind, RunOptions, the RunEvent union (+ RunEventType), RunResult, PlotResult, and the store shapes Progress, DistrictProgress, CityProgress, PlotState, EndlessEntry, Settings. DayArc now lives there (dayarc.ts re-exports it).
- No `any` in the converted files. Stored data is read as `unknown` and narrowed (`isObject` in stars.ts). Run still gets Tower/windAt/hookAt from physics.js, so their types are inferred from JS until physics moves; Run casts the fly() result to a FlyEvent union and `this.block`/`this.hook` where the flow guarantees them.
- tests/core/helpers.ts: `need`, `levelOf`, `findEvent` for strict tests.
- settings.saveDistrictResult and loadDistrictProgress now throw a clear Error for a city without a district (before: a TypeError). Same condition, clearer message.
- Results: `npm test` (tsc + 82 Vitest) green; `check.mjs all` High and Low PASS, plot-run and newtown-run PASS, `npm run build` ok. The checks rewrote tracked screenshots in out-s2-04/07; I restored them.
