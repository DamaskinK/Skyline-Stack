# 05: Remaining modules and strict everywhere

**What to build:** convert js/entities.js, js/textures.js, js/fx.js, js/people/*, js/landmarks/*, js/main.js, js/debug.js; then allowJs off to strict TypeScript with real types (no `any` except at Three.js edges, explained),
no behaviour change.

**Blocked by:** 04

**Type:** improve
**Status:** ready-for-agent

- [ ] Typecheck, Vitest and all browser checks (check.mjs High/Low, plot-run, newtown-run) pass.
