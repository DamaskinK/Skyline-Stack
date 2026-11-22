# 04: Browser check harness (Playwright)

**What to build:** scripts that open the running game, start a run through `window.__game`, and report: screenshots at
fixed moments, frame-time p50/p90 over a sample, console errors, and a ground flicker check (two frames from a slowly
moving camera differ only where things move). First used on the current game to get a baseline.

**Blocked by:** None (can start immediately).

**Type:** feature
**Status:** done
**Read:** plan "Testing Decisions: Seam 2".

- [x] One command per check (shots, perf, flicker), with quality preset and level as options
- [x] Output to a git-ignored folder; a short text report (pass/fail, numbers)
- [x] Baseline run on the current game recorded in the ticket under Comments (flicker expected to fail)

## Comments
Built: `npm run check -- [all|shots|perf|flicker] [--app URL] [--quality low|medium|high] [--level kosice] [--budget ms] [--headed]`
(`tests/browser/check.mjs`), page hooks in `js/debug.js` (`window.__debug.snap / flicker / info`). Uses the system Chrome
with the real GPU, so frame times are real. Output in `tests/browser/out/` (git-ignored).

Flicker is measured two ways, with nothing in the scene moving between the two renders:
- **depth**: camera moves 4 mm; a clean scene changes only along edges (limit 1 % of pixels);
- **shadow**: only the sun's aim point moves 4 cm, as every frame while the camera follows the tower (limit 0.2 %).

Baseline 2026-11-22 (Apple M5 Pro, 1280x720):
- High: depth 0.11 / 0.43 / 0.54 % (menu / game / low), shadow 0.00 % on all poses; 60 fps, p90 16.7 ms,
  404 draw calls, 51k triangles; no console errors.
- Low: 60 fps, 394 draw calls.
- Shadow shimmer at a lower threshold (10/255): 0.01-0.06 % in every weather phase. Depth flicker in every phase < 1 %.
- **Not reproduced:** the floor flicker the developer reported does not show up as z-fighting or shadow swimming in
  these measurements. What the diff images do show: facade window textures alias at grazing angles (close tall
  buildings), and the high-contrast plaza checker pattern is a likely source of shimmer in motion. Ticket 05 should
  confirm with the developer what exactly flickers.
- Draw calls (~400) are above the plan's ~300 budget already; the near ring work must instance more.
