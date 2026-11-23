# 02: Kosice houses from a Blender module kit

**What to build:** the near-ring houses stop being generic boxes: a Blender-built modular kit in Kosice style replaces
them, assembled per OSM footprint in code (instanced modules).

**Blocked by:** 00

**Type:** improve
**Status:** claimed

- [ ] Old-town kit (Hlavna, centre): baroque/classicist burgher house modules - ground-floor arcade or shop portal,
      window bays with pilasters and frames, cornices, attic dormers, hip/gable roofs with tiles, pastel palette.
- [ ] Estate kit (Terasa, Juzna): Czechoslovak panel-block modules - panels with joints, loggia bays, stair cores,
      entrance canopies, roof edges; a few colour schemes after renovation (as in real Kosice estates).
- [ ] In-between kit (1950s-1930s blocks) for Kulturpark/Juzna transition.
- [ ] Assembler in code: footprint -> modules along each edge, corners, roof; instancing keeps draw calls in budget.
- [ ] Screenshots per plot before/after; perf at 2560x1440 DPR 2 High and Low.

**Rules for this ticket (developer, 2026-11-23):** logically correct placement and a look that matches the real place.
Look at real photos before modelling: Wikimedia Commons (search "Košice <place>"), Mapillary street-level images, OSM
notes; save the reference URLs (not the images) in Comments and compare your screenshots with them side by side. No
visual bugs: no overlapping textures, nothing standing on a road, bike lane or track, the S0004 00 audit stays green.
