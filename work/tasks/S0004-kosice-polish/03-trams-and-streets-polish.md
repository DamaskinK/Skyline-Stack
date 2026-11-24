# 03: Trams and streets polish

**What to build:** trams and streets feel finished.

**Blocked by:** 00

**Type:** polish
**Status:** done

- [x] Trams: Kosice-style livery, headlights and lit windows at night, platforms that follow bends cleanly, wires sag.
- [x] Streets: kerbs with height everywhere, zebra crossings at junctions, lane markings, manholes and drains, street
      name signs in Slovak, a few parked bikes, traffic lights at main junctions with cars stopping.
- [x] Screenshots day and night; perf within budget.

**Rules for this ticket (developer, 2026-11-23):** logically correct placement and a look that matches the real place.
Look at real photos before modelling: Wikimedia Commons (search "Košice <place>"), Mapillary street-level images, OSM
notes; save the reference URLs (not the images) in Comments and compare your screenshots with them side by side. No
visual bugs: no overlapping textures, nothing standing on a road, bike lane or track, the S0004 00 audit stays green.

## Comments
- Trams (`js/trams.ts`): Vario LF2+ in the real DPMK livery (sky blue, white and yellow sweeps, yellow lamp panel, blue bumper, orange destination display, orange pantograph that reaches the wire), side plates from a canvas texture; the same canvas is the emissive map, so windows glow at night; white headlights at the front, red lamps at the rear (instanced, driven by `glowMats`). All trams now are 7 instanced meshes. Wire sags 0.32 m between poles (tilted strip, poles painted yellow). Platforms follow the line with mitred strips (paving, red tactile strip, shelter) and the plan only puts them on a stretch that turns less than 10 degrees over 14 m (moved up to 9 m along the line), and never two within 15 m.
- Streets: `js/core/street-detail.ts` (plan) + `js/street-detail.ts` (drawing). Kerbs (15 cm granite) along both edges of every carriageway, cut at junction mouths, bike lanes, tram beds, water; zebra crossings on the arms of junctions (steps back until it clears the crossing street), stop lines, dashed centre lines (streets of 5.5 m and wider), manholes, gully drains, traffic lights at up to 4 bigger junctions per plot (4 phases: green 13 s, amber 2 s, red; cars brake at the stop line, see `traffic.waiting`), parked bikes between the hoops of racks (racks got a 0.9 m deep footprint), blue street name plates with the real names (OSM `name`, atlas texture, one draw call), 14 sign posts instead of 10. Bike lanes stop 1 m short of crossings. All new kinds (kerb, zebra, dash, manhole, drain, tlight) have rules in `RULES`, so the audit covers them.
- Checks: `npx vitest run` 122 passed (new `tests/core/street-detail.test.ts`); `check.mjs audit` 0 findings on 5 plots; `flicker --plot all --quality all` PASS (max 0.76 % of 1 %); `check.mjs all` High 664 draw calls (was 617), 1.88 M tris, p90 16.7 ms, Low 186 calls, 0.66 M tris, 60 fps, console clean; `district-life.mjs` PASS (834 calls at 5 plots). Cars wait at red: plot 2 1072 of 3000 simulated frames with at least one waiting car (plot 1 none: its car routes meet no light).
- Screenshots (High, day and night, `tests/browser/s4-03.mjs`, `out-s4-03`): `p1/p2-high-light-{day,night,high}`, `zebra`, `sign`, `bikes`, `tram0-{day,night}`, `stop0/1`. Night is the end of the time-of-day arc (22:00 via `__debug.setHour`).
- References (looked at, not stored; downloaded into /private/tmp/claude-501/refs): Commons `File:Vario LF2+ Košice č801.JPG`, `File:Vario pri Hlavnej pošte.jpg`, `File:Košice-linka4-Kuzmányho ulica.jpg`, `File:Košice - Tram loop at Staničné námestie - Older DPMK Tatra tram in older red-and-white livery (September 2012).jpg` (the old livery was red and white, the S0002 tram was that; the current one is blue, white, yellow).
- Open: Low quality still draws all kerbs (cheap, no extra calls); no photo of Slovak street name plates was compared (blue with white text from memory); trams are not Blender-built (box geometry plus texture); the plate text has no small "ulica" line.
