# Handoff, 2026-11-24 evening (demo tomorrow)

Branch `s/S0001-visual-overhaul` is pushed to GitHub (DamaskinK/Skyline-Stack) at `e6ae4b5` and is the demo build:
`npm test` 130 pass; `check.mjs all` High and Low PASS (audit 0 findings on all plots, 60 fps, no console errors);
`flicker --plot all --quality all` PASS.

Done since the last handoff (S0004): 12 business-centre plot (next to Aupark Tower, trams), 13 modern kit
(Kulturpark barracks, new flats, offices), 16 Blender birds and lived-in roofs, 17 camera closer, 18 street profile
(tram bed in the middle, lanes, kerb, bike lane, sidewalk), real bus models, garages one storey, Terasa moved to the
tram line, 19 light menu (pixel panorama, no city load) and pixel-art icons.

The work worktree `/Users/damaskin/Projects/skyline-wip` (branch `s/S0004-wip`, merged) can be removed:
`git worktree remove ../skyline-wip`. `git stash` still holds S0001 20 (world map WIP) for after the demo.

Open after the demo: S0004 10 (Opus remodel of tram, house kit, tower floor/crown), 06 (Kosice review + developer
playtest), S0001 20 world map, Prague and Tokyo. Read `CLAUDE.md` first (agents: Sonnet builds code, Opus models).
