# 02: Kosice houses from a Blender module kit

**What to build:** the near-ring houses stop being generic boxes: a Blender-built modular kit in Kosice style replaces
them, assembled per OSM footprint in code (instanced modules).

**Blocked by:** 00

**Type:** improve
**Status:** done

- [x] Old-town kit (Hlavna, centre): baroque/classicist burgher house modules - ground-floor arcade or shop portal,
      window bays with pilasters and frames, cornices, attic dormers, hip/gable roofs with tiles, pastel palette.
- [x] Estate kit (Terasa, Juzna): Czechoslovak panel-block modules - panels with joints, loggia bays, stair cores,
      entrance canopies, roof edges; a few colour schemes after renovation (as in real Kosice estates).
- [x] In-between kit (1950s-1930s blocks) for Kulturpark/Juzna transition.
- [x] Assembler in code: footprint -> modules along each edge, corners, roof; instancing keeps draw calls in budget.
- [x] Screenshots per plot before/after; perf at 2560x1440 DPR 2 High and Low.

**Rules for this ticket (developer, 2026-11-23):** logically correct placement and a look that matches the real place.
Look at real photos before modelling: Wikimedia Commons (search "Košice <place>"), Mapillary street-level images, OSM
notes; save the reference URLs (not the images) in Comments and compare your screenshots with them side by side. No
visual bugs: no overlapping textures, nothing standing on a road, bike lane or track, the S0004 00 audit stays green.

## Comments
- Built: `scripts/blender/housekit.py` -> `housekit.glb` (83 KB, 26 modules), `js/house-kit.ts` (assembler: bays per edge stretched to fit, cornice mitre overshoot at convex corners, dormers, instancing), `near-ring.ts` (kit path, gable roofs on ~40 % of rectangular old houses, shadow proxy, `?houses=procedural` fallback), `tests/browser/house-poses.mjs`, debug helpers `houseSpots/houseStats/hideModules`.
  Old kit: shop portals, arched gate, bays with pilasters and flat/triangular/segmental surrounds, cornice, parapet, dormers, hip/gable tile roofs, pastel plaster. Panel kit: joint grid, twin windows, loggia and balcony stacks, stair cores, entrance canopy, roof edge, 7 renovated colour schemes. In-between kit: plinth, paired windows, string course, door with canopy.
- Perf at 2560x1440 DPR 2: High 617 draw calls, 1.82 M triangles, p90 16.7 ms (S0004 01: 623 / 1.70 M); Low 182 calls, 0.64 M, p90 16.7 ms (183). Checks: `npm test` 116 pass; `check.mjs audit` 0 findings on all 5 plots; `flicker --plot all --quality all` PASS; console clean.
- Screenshots before/after (High, Low): `tests/browser/out-s4-02/before` and `after` (`kit-<q>-p<plot>-{aerial,old,panel,mid}-{street,high}.png`), game shots `out-s4-02/{high,low}`.
- References (looked at, not stored): Commons `File:Kosice - Hlavna ulica 16.jpg`, `File:Košice - Hlavná ulica -a.jpg`, `File:Južná trieda Košice.jpg`, `File:Krajový typ panelového domu K 61 na sídlisku Terasa, Košice.JPG`, `File:Košice Apartment Blocks.jpg`,
  `File:A block of flats, Bukovecká, Nad jazerom, Košice, Slovakia - 01.jpg` (https://commons.wikimedia.org/wiki/<file>). Mapillary was not reachable without login; not used.
- Open: detail radius is small (48 m High) because fine high-contrast geometry raises the 320x180 flicker measure; windows beyond are flat plates. Projections over the street stay at or below 0.45 m at ground level (canopy and balcony 0.85 m above 2.3 m); the audit does not check module projections themselves. Middle ring (far-ring.ts) still uses the old facades.
