# Handoff, 2026-11-24 (demo tomorrow)

Branch `s/S0001-visual-overhaul`, HEAD `218017c` + this file. **HEAD is the demo-safe state**: `npm test` 128 pass,
`check.mjs all --quality high` PASS (audit 0 findings on all 5 Kosice plots, 60 fps, no console errors). Nothing is
pushed yet; the developer wants everything finished first, then a push.

Read first: `CLAUDE.md` (TypeScript, dev server `npm run serve` on :8000, Blender pipeline, agents and models:
Sonnet `skyline-builder` writes code, Opus `skyline-modeler` makes Blender models, Opus `skyline-reviewer` reviews).
Talk to the developer in Russian; repo files in English. Quality bar: logically correct placement, look matching real
photos of Kosice, zero visual bugs.

## Unfinished work (git stash)
`git stash list`:
- `stash@{0}` **S0004 12+13+16 WIP**: interrupted by the usage limit, mixed work of three agents:
  - 16 birds and roofs (Opus): new `js/birds.ts`, `scripts/blender/birds.py`, `assets/models/`, `tests/browser/bird-poses.mjs`,
    edits in `js/world.ts`, `js/entities.ts`, `js/level-scene.ts`, maybe `js/near-ring.ts`. Roof props not started.
  - 13 modern kit for Kulturpark (Opus): `scripts/blender/modernkit.py` (was writing it), edits in `js/near-ring.ts`,
    `scripts/blender/housebake.py`. The OSM class tagging is already committed (`218017c`).
  - 12 business-centre plot (Sonnet): edits in `scripts/build-osm-level.mjs` (OSM API fallback, Overpass was down),
    `js/levels.ts`, `assets/levels/kosice/plots/*.json`. Probably half done.
  Pop it (`git stash pop stash@{0}`), run `npm test` and `node tests/browser/check.mjs all`, and finish each ticket from
  its file; if a piece is broken and time is short, drop that piece (`git checkout -- <files>`) rather than ship a bug.
- `stash@{1}` and `stash@{2}`: **S0001 20 world map** WIP (after the demo).

## Tickets still open (work/tasks/S0004-kosice-polish/)
1. **16 birds and roofs** (Opus modeler): highest visible value for the demo (birds flying into the camera look bad).
2. **13 modern kit Kulturpark** (Opus modeler).
3. **12 business-centre plot** (Sonnet): needs OSM data; Overpass was down all day (TLS resets); try the OSM API
   `api/0.6/map?bbox=` fallback with polite limits. If no data, keep plot 4 as it is.
4. 10 Opus remodel of house kit, tram, tower floor/crown (after the demo).
5. 06 Kosice review + developer playtest.

## Before the demo
- `npm test`, `node tests/browser/check.mjs all --quality high` and `--quality low`, `node tests/browser/check.mjs flicker --plot all --quality all`, `node tests/browser/plot-run.mjs` must pass.
- Then push: `git push -u origin s/S0001-visual-overhaul` (GitHub DamaskinK/Skyline-Stack). Do not merge into main without the developer.
- Demo tips for the developer: `npm run serve`, open http://localhost:8000 in Chrome full screen, Medium graphics on
  weaker machines; show District mode -> Kosice (intro over the cathedral, Terasa plot) and Endless -> Kosice.
