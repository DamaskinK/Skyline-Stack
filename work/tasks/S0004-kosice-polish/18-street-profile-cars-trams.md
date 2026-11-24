# 18: Real street profile, correct car models, trams on Terasa

**What to build:** developer's playtest of the Terasa plot, 2026-11-24 (screenshot
/private/tmp/claude-501/terasa-feedback.webp):

**Blocked by:** None (start when the near-ring/street files are free: after S0004 12, 13, 16 in this worktree)

**Type:** bug
**Status:** ready-for-agent

- [ ] Car models: some cars are stretched long (limousine-like yellow cars) - fix scaling (uniform scale from the real
      car length, no non-uniform stretch along the road); no parked or moving car on or touching the tower pad
      (they stand right at the tower's base on Terasa).
- [ ] Street cross-section of main roads, from the centre outwards: tram tracks on their own bed in the middle ->
      car lanes in each direction -> kerb -> bike lane -> sidewalk (then grass/buildings). Applies wherever OSM has a
      main road with a tram line (Trieda SNP at Terasa, Juzna trieda, Sturova...); roads without trams: lanes -> kerb
      -> (bike lane if tagged or main road) -> sidewalk. Placement rules and audit updated.
- [ ] Trams on Terasa: Trieda SNP's tram line runs through Terasa in reality - widen the rail/stop fetch radius for
      the plot extracts (rails can come from further than the near ring) or move the plot site within the estate so
      the tram road is in view; trams run and stop there.
- [ ] audit, flicker --plot all --quality all, check.mjs all High/Low pass; screenshots from the game camera on
      Terasa and Juzna showing the street profile and a tram.
- [ ] Tall blank pale pillars along the road on the Kulturpark plot (seen by the S0004 13 modeler) - find their source and fix.
- [ ] Far-facade glass of offices shows a room with curtains - offices get an office interior/reflective glass cell.
