# 08: Fix the S0004 review findings

**What to build:** the Opus review of 0ee93e0..5e02034 found 10 bugs visible from the game camera; fix all, plus two
look items. Reviewer's screenshots and pose helper: /private/tmp/claude-501/-Users-damaskin--claude-spares-spare-wnR6AF/63cfe9b4-8f4f-48ad-b90d-fc4833fae87b/scratchpad
(t0/, f3/, f4/, im/, s404-*/, night/, tools/pose.mjs).

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** claimed

- [ ] 1. Far facades shifted by half bays: `js/baked-facades.ts` ~72 `ux = phase * BAY` -> `ux = phase * c.bays * BAY`;
      verify bay alignment with the near modules on every plot (no half columns at corners, no jump at the switch).
- [ ] 2. Long estate facades drawn as blank end walls: choose end walls by orientation (edges across the footprint's
      short axis), not by edge length (`js/house-kit.ts` ~130/146, `js/far-ring.ts`); stepped OSM outlines of panel
      blocks must show window/loggia bays on the long sides like real Terasa/Juzna blocks.
- [ ] 3. Landmark models are invisible to placement: add each landmark's footprint (Singing Fountain rim, Immaculata
      base, all landmark GLBs) as `Site` obstacles; the fountain must clear the tower pad (it reaches 6.3 m from the
      tower) - keep the real position and shrink/shift the pad edge if needed, or confirm the real geometry; no musician
      in the fountain, no tree in the Immaculata pedestal; the audit must cover landmarks.
- [ ] 4. Tiny OSM footprints (< ~15 m2, 46 across the plots) become blank 7-14 m pillars: make them one-storey kiosks
      with a roof and a shop front, or skip them; never blank `fill` slabs.
- [ ] 5. Cars stop inside each other at red lights: car-following on the same route and direction (gap >= 6 m).
- [ ] 6. Tram wire sags in the wrong place: phase `((s - 12) % SPAN + SPAN) % SPAN / SPAN` (poles at 12 + 36k); the
      pantograph touches the wire at its height along the span.
- [ ] 7. People inside furniture: stand spots through `solidFree('person', ...)`; people included in the solid-overlap audit.
- [ ] 8. Centre-line dashes cut across bends: `js/core/street-detail.ts` ~153 clamp `acc` or walk along the polyline.
- [ ] 9. CREDITS row for the baked facade atlases (`housefacade_*`, built by housebake.py); correct `housekit.glb` bytes
      in the manifest (85484).
- [ ] 10. `tests/core/balance.test.ts`: assert max residents of plots 1-3 < goal <= plots 1-4.
- [ ] Look: Singing Fountain jets read as water (translucent, light, animated arcs or sprites), not grey spikes.
- [ ] Look: verify the Immaculata (plague column) position against OSM (`historic=*`, name) and Commons photos - it stands
      on Hlavna in front of the State Theatre; fix if the current spot (117 m north of the theatre) is wrong.
- [ ] npm test, audit --plot all, flicker --plot all --quality all, check.mjs all High/Low, gpu-leak pass; screenshots
      from the game camera per plot day and night.

**Rules:** S0004 photo-reference and no-visual-bugs rules apply.
