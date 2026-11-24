# 07: Distant houses look like the kit (baked facades)

**What to build:** beyond the 48 m (High) / 32 m (Low) kit radius of S0004 02, houses are flat plates with painted
windows, and the game camera sees most houses from 30-150 m. Bake the Blender kit modules into facade textures
(base colour + normal + AO, per module type and colour scheme, atlas) in scripts/blender, and use them on the far
version of every house so the old town and the estates read the same from the game camera as up close.

**Blocked by:** 03

**Type:** improve
**Status:** done

- [x] Baked atlases per kit (old town, panel, in-between); windows with a hint of interior/reflection instead of flat blue.
- [x] Far houses use them with correct bay alignment to the near modules (no visible jump at the switch).
- [x] Flicker, audit and perf (2560x1440 DPR 2 High/Low) pass; screenshots from the game camera on every plot.
- [x] Middle ring (js/far-ring.ts) uses the same atlases.

**Rules:** S0004 photo-reference and no-visual-bugs rules apply.

## Comments
- Built: `scripts/blender/housebake.py` (Cycles, emission-only passes: albedo, class masks, depth -> normal, AO; 14 cells at 64 px/m) -> `assets/levels/kosice/housefacade_{col,nrm,msk}.webp` (27 + 304 + 28 KB) and `housefacade.json`; `js/baked-facades.ts` (one material, repeating-cell shader, `FacadeBuilder`); used by far houses of the near ring (`house-kit.ts` `far`) and by the whole middle ring (`far-ring.ts`, no cornice/parapet quads). Windows now show a room (curtain, ceiling, warm wall) and a sky streak; lit per bay at night. `housekit.py` only got a `__main__` guard. ADR 0003 updated.
- Alignment: same bay count, stretch, origin and pattern phase as `addHouse` (old a/b and c/d parity, panel 4-bay period with seed offset), so the switch at 48/32 m shows no shift (`out-s4-07/poses/kit-high-p3-old-street.png`).
- Checks: `check.mjs audit --plot all` 0 findings; `flicker --plot all --quality all` PASS; perf 2560x1440 DPR 2: High 597 calls / 1.36 M tris (was 664 / 1.88 M), Low 156 / 0.39 M (was 186 / 0.66 M), p90 16.7 ms both; `npx vitest run` 122 pass (`npm test` fails only on a pre-existing `node:fs` type error in tests/core/street-detail.test.ts).
- Screenshots (game camera, floor 0 and 10, every plot): `tests/browser/out-s4-07/before/{high,low}` and `after/{high,low}`; near-ring poses in `poses`.
- Open: the middle ring keeps its old panel palette (light) while near-ring estates use the renovated schemes only where the plot data says so; no photo comparison redone for the baked glass look.
