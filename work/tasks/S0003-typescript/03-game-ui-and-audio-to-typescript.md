# 03: Game, UI and audio to TypeScript

**What to build:** convert js/game.js, js/ui.js, js/district-map.js, js/music.js, js/audio.js, js/assets.js to strict TypeScript with real types (no `any` except at Three.js edges, explained),
no behaviour change.

**Blocked by:** 02

**Type:** improve
**Status:** done

- [x] Typecheck, Vitest and all browser checks (check.mjs High/Low, plot-run, newtown-run) pass.

## Comments
- Converted with `git mv`: js/{game,ui,district-map,music,audio,assets,physics}. physics moved in this batch because Run's types depend on it (Tower, Wind, Hook, Pose, FlyResult, CollapseInfo now in js/types.ts; Block got `bounced?`).
- `Sfx` and `Music` became classes (`SfxEngine`, `MusicDirector`) with one exported instance each: same members and behaviour, but the nodes made at init are declared as fields. `GameUi`, `GameResult`, `PlotGameResult` are exported from game.ts; ui.ts returns a `GameUi`.
- No `any`. Casts are documented: DOM lookups (`$` asserts the element exists), the `webkitAudioContext` fallback, and `applyLevelAssets` (level-scene.js is still JS, its `= null` defaults infer as type null) called through a typed alias in game.ts. `building-types.test.ts` casts its partial Block and weather stubs.
- Results: `npm test` green (tsc + 82 Vitest); `check.mjs all` High and Low PASS, plot-run and newtown-run PASS, `npm run build` ok. audio-check: all PASS except "state reached: win", which fails the same way on the commit before this ticket (not caused by this batch). Tracked screenshots rewritten by the checks were restored.
