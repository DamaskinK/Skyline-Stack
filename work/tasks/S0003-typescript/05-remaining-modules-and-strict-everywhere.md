# 05: Remaining modules and strict everywhere

**What to build:** convert js/entities.js, js/textures.js, js/fx.js, js/people/*, js/landmarks/*, js/main.js, js/debug.js; then allowJs off to strict TypeScript with real types (no `any` except at Three.js edges, explained),
no behaviour change.

**Blocked by:** 04

**Type:** improve
**Status:** done

- [x] Typecheck, Vitest and all browser checks (check.mjs High/Low, plot-run, newtown-run) pass.

## Comments
- Converted with `git mv`: entities, textures, fx, debug, main, people/{figure,styles}, landmarks/{index,kosice,newtown,style}. `allowJs` and `checkJs` are gone from tsconfig; no .js is left under js/. build.mjs bundles js/main.ts (index.html keeps `js/main.js`, the dev server maps it).
- Casts that only existed because textures.js was JS are removed (canvas2d returns a typed [canvas, 2d context]). New types: TexPair, Outfit/CityStyle, PartOpts, Life/Walker/Cyclist in fx. No `any`; the one remaining cast pattern is `getContext('2d') as CanvasRenderingContext2D` in canvas2d and the clock texture.
- Small guards instead of silent nulls: People.arrive returns without a camera, updateCrane needs both block and mesh, main.ts checks tower and block view before the hanging-block tilt. Window handles (`__game`, `__debug`, ...) are declared in main.ts / debug.ts.
- scripts/*.mjs and tests/browser/*.mjs stay plain .mjs (Node tooling), noted in CLAUDE.md.
- Results: `npm test` green (tsc strict + 82 Vitest), `npm run build` ok, `check.mjs all` High (60 fps, 602 draw calls) and Low PASS, plot-run and newtown-run PASS, kosice-high-mid screenshot looked at. Tracked screenshots rewritten by the checks were restored.
