# 18: Real street profile, correct car models, trams on Terasa

**What to build:** developer's playtest of the Terasa plot, 2026-11-24 (screenshot
/private/tmp/claude-501/terasa-feedback.webp):

**Blocked by:** None (start when the near-ring/street files are free: after S0004 12, 13, 16 in this worktree)

**Type:** bug
**Status:** done

- [x] Car models: some cars are stretched long (limousine-like yellow cars) - fix scaling (uniform scale from the real
      car length, no non-uniform stretch along the road); no parked or moving car on or touching the tower pad
      (they stand right at the tower's base on Terasa).
- [x] Street cross-section of main roads, from the centre outwards: tram tracks on their own bed in the middle ->
      car lanes in each direction -> kerb -> bike lane -> sidewalk (then grass/buildings). Applies wherever OSM has a
      main road with a tram line (Trieda SNP at Terasa, Juzna trieda, Sturova...); roads without trams: lanes -> kerb
      -> (bike lane if tagged or main road) -> sidewalk. Placement rules and audit updated.
- [x] Trams on Terasa: Trieda SNP's tram line runs through Terasa in reality - widen the rail/stop fetch radius for
      the plot extracts (rails can come from further than the near ring) or move the plot site within the estate so
      the tram road is in view; trams run and stop there.
- [x] audit, flicker --plot all --quality all, check.mjs all High/Low pass; screenshots from the game camera on
      Terasa and Juzna showing the street profile and a tram.
- [x] Tall blank pale pillars along the road on the Kulturpark plot (seen by the S0004 13 modeler) - find their source and fix.
- [x] Far-facade glass of offices shows a room with curtains - offices get an office interior/reflective glass cell.
- [x] FIRST: flicker regression in this worktree - after S0004 16 tile roofs the depth check on game/low poses rose to 0.75-0.8 % mean, 1.0-1.27 % max on every plot (was 0.26 %). Likely the new high-frequency clay-tile/membrane textures aliasing (check mipmaps, anisotropy, texel scale) or another WIP; bisect over the s/S0004-wip commits and fix so flicker --plot all --quality all passes again.
- [x] Barracks roofs (S0004 13) should read as dark metal, not tinted clay tiles.

## Comments
- Flicker regression: not the tile textures. Ticket 19's menu picture skips `updateWeather` while the menu shows, so the rain/snow/streak pools stayed at their creation default `visible = true` (rain lines from random points to the origin) and moved between the two flicker renders. `js/fx.ts` creates the pools hidden. depth game/low back to 0.21 % mean / 0.38 % max on plot 1; `check.mjs flicker --plot all --quality all` PASS.
- Barracks roofs: own `metal` builder and `metalRoofMaterial` in near-ring.ts (dark coated steel, 0.5 m standing seams, metalness 0.45); shot tests/browser/out-s4-18/kit-high-p2-barracks-high.png. flicker all presets passed with it.
- Cars: the stretched yellow cars were the buses of the moving traffic (the car body scaled 1.5 x 2.3, 9.7 m long). `js/world.ts`: a real bus model (`busGeo`, 11 m, windows, wheels, lights; own instanced meshes, no non-uniform scale anywhere). Parked cars keep 3 m from the tower's pad (`CAR_PAD_GAP` in `js/core/placement.ts`, test added), moving cars turn round / re-enter 4 m before the end of a route, so none reaches the pad where the streets are cut. Shots (`tests/browser/s4-18.mjs`, loadPlot + fixed poses): tests/browser/out-s4-18/p0-high-high.png (no car near the pad), bus-high.png. npm test 129, audit all plots 0 findings.
- Pillars: the Kulturpark extract has ~160 untagged footprints of 15-45 m2 (garage rows, sheds, e.g. five 20 m2 boxes at x 4..18, z -63) that near-ring.ts built as 2-4 storey old-town houses, i.e. 6-12 m tall blank towers 4 m wide. `tiny` now covers footprints under 45 m2 without a height tag of 5.5 m or more: one storey (garage with a roof). Shot tests/browser/out-s4-18/p2-high-garages.png (before: three storey slivers).
- Office glass: `paint_office_glass` in scripts/blender/housebake.py (sky mirror, light at the top of each pane, dark towards the floor plate, two glints, no room or curtain) for the `of_*` cells; rebaked, only housefacade_col.webp changed (nrm, msk, json identical). Shot tests/browser/out-s4-18/kit-high-p3-office-high.png.
- Street profile (`js/core/placement.ts` `planBikes`, `PROFILE`): from the middle outwards the OSM rails (track bed), the carriageways, the kerb (street-detail), a 1.5 m bike lane OUTSIDE the kerb (was painted inside the carriageway), a 2.2 m sidewalk (drawn in near-ring.ts with the footway paving, `plan.walks`, `site.foot` strips flagged `walk`: trees, hedges and beds keep off them, lamps, benches and bins stand on them). Lanes and sidewalks are planned only where no OSM cycleway / footway already runs beside the road, are cut at houses, crossings, traffic lights (lanes), other carriageways and track beds, and are left out on the median of a divided road. A "main road" is `k main`, a street 9 m or wider (Kosice's boulevards are two streets of 10-14 m with the tram bed between; the extracts hold no `k main`) or a street with a bike tag; lamps stand on its sidewalk. Audit: new category `building-walk`; test `terasa: the street profile` in placement.test.ts.
- Terasa: the nearest tram of Trieda SNP was 478 m west of the old site (checked with the OSM API: 4 tram ways in a 1.1 km box), too far for any fetch radius. The site moved 410 m west (48.7191, 21.23475; open ground between estate blocks, 41 m from houses, 74 m from the line; `levels.ts`), `ONLY_PLOT=terasa node scripts/build-osm-level.mjs kosice plots` rebuilt only that extract (OSM API fallback; 2 rails, 1 stop). `far-ring.ts`: the stylised Hornad moved from x -1800 to -2350 (city frame) because it now ran across the new Terasa site. Trams run and stop there: tests/browser/out-s4-18/p0-high-tram-close.png; Juzna profile with a tram on its own street: p1-high-profile.png; Terasa: p0-high-profile.png, p0-high-streetN.png, p0-high-top.png.
- Checks (wip server :8002): npm test 130 pass; audit --plot all 0 findings; check.mjs all high and low PASS; flicker --plot all --quality all PASS; plot-run PASS.
- Open: reference photos not compared; the Terasa balance (plot target 12) uses the same pad rules, bot curve test unchanged. Trams at Juzna come from the old extract's rails (the line is 195 m from the plot).
