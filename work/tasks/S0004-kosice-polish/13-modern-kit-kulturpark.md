# 13: Modern building kit (Kulturpark, business centre)

**What to build:** developer, 2026-11-24: Kulturpark does not look like today's Kulturpark - it is now newer buildings.
A Blender kit of contemporary Kosice architecture: renovated barracks of Kulturpark (brick and plaster, new glass
additions), new residential blocks (white/grey render, large windows, balconies with glass rails, flat roofs),
office buildings (glass curtain walls, aluminium fins, ground-floor lobbies) for Kulturpark and the business centre
plot; far facades baked like S0004 07; near-ring assembler picks it by OSM tags/area.

**Blocked by:** None (can start immediately).

**Type:** improve
**Status:** ready-for-agent
**Model:** opus (skyline-modeler)

- [ ] References from real photos of Kulturpark Kosice and the office buildings at Namestie osloboditelov / Sturova.
- [ ] Kulturpark and business-centre plots look like the real places from the game camera; perf, audit, flicker pass.

## Comments
- Built: `scripts/blender/modernkit.py` -> `modernkit.glb` (81 KB, 23 modules, 8-205 tris each; same frame and material classes as the house kit) in three kits: `bk_` renovated barracks (rusticated base under a cordon, segmental-arch windows with dark frames and keystones, sill courses, arched door, eaves cornice; plain-window variant), `rs_` new flats (white render, anthracite windows, cladding strips, balconies with glass rails and screens, glazed ground floor, entrance canopy, coping), `of_` offices (curtain wall with aluminium mullions, fins or coloured panels as on Aupark Tower, ribbon-glazing variant, recessed lobby with piers, entrance canopy, roof screen). `housebake.py` bakes 13 more far cells into the same 2048x1024 atlas.
- Selection: `scripts/build-osm-level.mjs` gives a building `m` = barracks (inside the "Kasarne Kulturpark" area), office (office/hotel 4+ levels or 900+ m2, shops 3+ levels or 2500+ m2), resi (flats since 1995 or named projects); never within 420 m of the cathedral. `near-ring.ts` maps `m` to the style (barracks: dark metal gable/hip roofs, no dormers), `house-kit.ts` / `baked-facades.ts` assemble it; without `modernkit.glb` the modern styles fall back to the in-between kit.
- References (looked at, not stored; https://commons.wikimedia.org/wiki/<file>): `File:Kasárne-Kulturpark - panoramio.jpg`, `(2)`, `(4)`, `File:Kulturpark Kasárne Košice 2013.JPG`, `File:Kasárne - panoráma - panoramio.jpg`, `File:Podvečer v Kulturparku Kasárne - panoramio.jpg`, `File:Aupark Tower - juh.jpg`, `File:Námestie osloboditeľov KE.jpg`, `File:Námestie osloboditeľov Košice centrum.jpg`, `File:Tatra Banka Košice.jpg`, `File:Štúrova 7, Košice, SK.jpg`, `File:Business Centre Kosice.jpg`; OSM data from api.openstreetmap.org (Overpass was down).
- Checks (worktree skyline-wip, :8002): perf 2560x1440 DPR 2 Kulturpark High 590 calls / 1.54 M tris p90 16.7 ms, Low 141 / 0.48 M p90 16.7 ms; business plot High PASS; flicker all plots all presets PASS; audit plots 0,1,2,4 0 findings; plot 3 (hlavna-south, uncommitted data of ticket 12) has 2 building-water + 1 zebra findings and 3 failing vitest cases from that data, not from the kit.
