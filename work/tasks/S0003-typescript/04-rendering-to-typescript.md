# 04: Rendering to TypeScript

**What to build:** convert js/world.js, js/post.js, js/near-ring.js, js/far-ring.js, js/street-life.js, js/vegetation.js, js/surfaces.js, js/level-scene.js, js/district-towers.js to strict TypeScript with real types (no `any` except at Three.js edges, explained),
no behaviour change.

**Blocked by:** 03

**Type:** improve
**Status:** done

- [x] Typecheck, Vitest and all browser checks (check.mjs High/Low, plot-run, newtown-run) pass.

## Comments
- Bug first (own commit): the music director already receives the `target` event in district runs; the win sting only never fired because audio-check started an Endless run, which has no target since S0002. The check now plays district plot `terasa` with a target of 12. audio-check: RESULT PASS, all states reached including win.
- Converted with `git mv`: js/{world,post,near-ring,far-ring,street-life,vegetation,surfaces,level-scene,district-towers,trams}. entities, fx, textures, landmarks, people, main, debug stay JS (ticket 05).
- New types in js/types.ts: OsmExtract (OsmRoad, OsmPoly, OsmBuilding, OsmPark), LevelAssets, Pt2. Exported from the modules: Vec/UvFn (near-ring), TramHost/TramLine, LifeHost/Spot, MiddleFarOptions, TrafficRoute, FullGrade. The `= null` cast workaround for applyLevelAssets in game.ts is gone.
- No `any`. Casts are documented in place: `canvas2d(...)` from textures.js is cast to [canvas, 2d context] (textures.js is still JS), the sky `scene.fog` is a THREE.Fog set at the top of world.ts, `mesh()` results that are known non-null after an `empty` check, and Newtown sites read as grid metres.
- Results: `npm test` green (tsc + 82 Vitest); `check.mjs all` High and Low PASS, plot-run and newtown-run PASS, `npm run build` ok, start screenshot looked at. Tracked screenshots rewritten by the checks were restored.
