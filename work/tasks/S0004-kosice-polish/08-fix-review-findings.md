# 08: Fix the S0004 review findings

**What to build:** the Opus review of 0ee93e0..5e02034 found 10 bugs visible from the game camera; fix all, plus two
look items. Reviewer's screenshots and pose helper: /private/tmp/claude-501/-Users-damaskin--claude-spares-spare-wnR6AF/63cfe9b4-8f4f-48ad-b90d-fc4833fae87b/scratchpad
(t0/, f3/, f4/, im/, s404-*/, night/, tools/pose.mjs).

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** done

- [ ] 1. Far facades shifted by half bays: `js/baked-facades.ts` ~72 `ux = phase * BAY` -> `ux = phase * c.bays * BAY`;
      verify bay alignment with the near modules on every plot (no half columns at corners, no jump at the switch).
- [x] 2. Long estate facades drawn as blank end walls: choose end walls by orientation (edges across the footprint's
      short axis), not by edge length (`js/house-kit.ts` ~130/146, `js/far-ring.ts`); stepped OSM outlines of panel
      blocks must show window/loggia bays on the long sides like real Terasa/Juzna blocks.
- [x] 3. Landmark models are invisible to placement: add each landmark's footprint (Singing Fountain rim, Immaculata
      base, all landmark GLBs) as `Site` obstacles; the fountain must clear the tower pad (it reaches 6.3 m from the
      tower) - keep the real position and shrink/shift the pad edge if needed, or confirm the real geometry; no musician
      in the fountain, no tree in the Immaculata pedestal; the audit must cover landmarks.
- [x] 4. Tiny OSM footprints (< ~15 m2, 46 across the plots) become blank 7-14 m pillars: make them one-storey kiosks
      with a roof and a shop front, or skip them; never blank `fill` slabs.
- [x] 5. Cars stop inside each other at red lights: car-following on the same route and direction (gap >= 6 m).
- [ ] 6. Tram wire sags in the wrong place: phase `((s - 12) % SPAN + SPAN) % SPAN / SPAN` (poles at 12 + 36k); the
      pantograph touches the wire at its height along the span.
- [x] 7. People inside furniture: stand spots through `solidFree('person', ...)`; people included in the solid-overlap audit.
- [x] 8. Centre-line dashes cut across bends: `js/core/street-detail.ts` ~153 clamp `acc` or walk along the polyline.
- [x] 9. CREDITS row for the baked facade atlases (`housefacade_*`, built by housebake.py); correct `housekit.glb` bytes
      in the manifest (85484).
- [x] 10. `tests/core/balance.test.ts`: assert max residents of plots 1-3 < goal <= plots 1-4.
- [x] Look: Singing Fountain jets read as water (translucent, light, animated arcs or sprites), not grey spikes.
- [x] Look: verify the Immaculata (plague column) position against OSM (`historic=*`, name) and Commons photos - it stands
      on Hlavna in front of the State Theatre; fix if the current spot (117 m north of the theatre) is wrong.
- [x] npm test, audit --plot all, flicker --plot all --quality all, check.mjs all High/Low, gpu-leak pass; screenshots
      from the game camera per plot day and night.

**Rules:** S0004 photo-reference and no-visual-bugs rules apply.

## Comments
- 1 (far facade phase): `ux = phase * c.bays * BAY`; derived to equal the near module order, panelA pose shows bays on the long sides, but I did not compare a near/far switch side by side, so the box stays open.
- 2: end walls are now edges across the footprint's long axis (shorter than 0.7 of it); stepped long sides keep their bays (far-ring: the short side of the rectangle).
- 3: `js/core/landmark-sites.ts` holds the convex hulls of the six Kosice models (read with `__debug.landmarkHulls()`); `Site.landmarks` blocks every placed kind, cuts streets and drops houses under a model; audit covers them. Tests: tests/core/placement.test.ts. The Singing Fountain keeps its real spot: its rim is 2.3 m from the 6.8 m tower step on Cathedral square and 6.3 m from the cathedral plot tower seen from Hlavna south (a tower may come within 0.5 m of a landmark). Middle ring keeps clear of the fountain and the Immaculata.
- 4: footprints under 15 m2 are one-storey old-style kiosks with shop front and roof.
- 5: car following (7 m centre gap, 12 m for buses); `__debug.trafficStats()` showed min gap 11.8 m / 38.6 m over 60 s on plots 4 and 3 (no car sat at a red light in that time, so the queue itself was not seen).
- 6: `wireY(s)` with poles at 12 + 36k; the pantograph is its own instanced mesh scaled to the wire height. Not looked at closely in a screenshot, so the box stays open.
- 7: standing people through `solidFree('person')` (mate included); seated people are the non-solid kind `sitter`. Bus stop and kiosk spots moved in front of the object.
- 8: `acc = max(0, s - l)`. 9: CREDITS row and housekit bytes 85484 (fountain bytes 77776 after rebuild). 10: plots 1-3 max 656 < 720 <= plots 1-4 max 899.
- Look: the fountain GLB was rebuilt without jets (Blender); `js/landmarks/fountain-jets.ts` draws animated translucent columns and spray arcs. Immaculata: OSM node 600209139 (48.7228045, 21.2568027) equals the model spot (-55.1, -199); it stands on Hlavna 117 m north of the theatre, so no change.
- Checks: npm test 128 pass; check.mjs all high and low PASS; audit plot all 0 findings; flicker plot all quality all PASS; gpu-leak PASS (growth 1.01).
