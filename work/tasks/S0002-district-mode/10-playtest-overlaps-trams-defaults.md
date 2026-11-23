# 10: Playtest fixes: overlapping surfaces, trams and cars on the outskirts, Medium by default

**What to build:** remarks from the developer's playtest of the Kosice district, 2026-11-23.

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** done

- [x] Overlapping textures: surfaces drawn on top of each other in one plane, e.g. the tower (foundation/plot pad) on a
      bike lane, bike lanes over roads or paving. Find every coplanar overlap on all five Kosice plots and the Newtown
      plots (bike lanes, roads, paths, plaza/plot pads, parks, basins, OSM area polygons that overlap each other) and
      fix them by the ticket 05 rule: real height steps or cutting one shape out of the other; nothing of the street
      network under the tower's foundation (clear a pad). Add a check that renders each plot's start view twice with a
      tiny camera move and fails on coplanar flicker (extend check.mjs flicker to --plot N for all plots).
- [x] Trams: Kosice has trams; add `railway=tram` from OpenStreetMap to the plot extracts (rails in the street with a
      grass or paved track bed, overhead poles if cheap) and low-poly trams (Kosice-style, two or three sections) that
      run along the lines and stop at tram stops; on every Kosice plot that has lines (Terasa and Juzna have them).
- [x] Cars on the outskirts plots: moving traffic along the OSM roads on Terasa and Juzna (and every plot), parked cars
      along streets and in car parks, scaled by preset and district life.
- [x] Default graphics preset is Medium for new players (existing saved settings stay).
- [x] npm test, check.mjs High/Low/Medium per plot, plot-run pass; screenshots of a tram and of the bike lane by the
      tower.

## Comments
- Overlaps: heights and polygon offsets now rise in one order (urban, park, water, road, car park 3.4 cm, tram bed 3.8 cm, footway 4.5 cm, bike lane 5.5 cm, paint 6.5 cm, plaza 6 cm); bike lanes were 2 mm from their paint and under footways. `trimNetwork` (js/near-ring.js) cuts roads, footways, rails and with them the bike lanes out of a 32 m pad square round the tower and drops basins that touch it, so the foundation stands on bare plaza. `check.mjs flicker --plot all` builds all five plots and checks the 12 poses x (depth, shadow) on each (new `ground` pose at grazing angle); with the bike layer put back into the road plane it fails (8 % on Terasa), so it does see coplanar layers. It now freezes the tree sway and skips poses whose camera sits in a tree crown (that was a pre-existing false alarm on Low plot 3). Kosice plots 0-4 pass on High, Medium and Low, Newtown plots pass on High and Low. Newtown is the procedural city and has no bike lanes or street network to overlap.
- Trams: `build-osm-level.mjs` also fetches tram stops, stop positions and `amenity=parking`; plot JSON regenerated (rails, stops, parking). OSM has no tram line within 250 m of Terasa, Kulturpark and Cathedral square (the ticket expected Terasa to have one): only Juzna (two tracks 145 m west, 4 stops) and Hlavna street (one stop at the edge) get trams. `js/trams.js` + `js/core/tram-route.js` (8 new tests): track bed (paved beside a street, grass elsewhere), steel rails, overhead wire and poles, platforms with a shelter, and own low-poly three-section red and white trams that run along the lines, stop 7 s at the stops and start again. Number follows preset and finished plots (1 / 2 / 3 at most). No external asset.
- Cars: moving traffic uses the 18 streets nearest to the tower (was any street); parked cars along streets (every street of 5.5 m or more) and in car parks (bays in rows), nearest first, 24 / 46 / 70 at most by preset and scaled by finished plots (`People.applyTraffic`).
- Default preset Medium for new players (settings.js); saved settings are kept (checked with none, high and low saved).
- Checks: npm test 82 passed; check.mjs all per plot (0-4) High 600-616 calls, Medium 310-317, Low 182+, 60 fps, all PASS; plot-run, newtown-run, district-life, gpu-leak PASS. Screenshots in tests/browser/out-s2-10 (`p1-high-tram0.png`, `p3-high-tram0.png`, `p1-high-stop0.png`, `p4-high-tower-ground.png` bike lane by the tower, `p0-*` Terasa car park); `tests/browser/s2-10.mjs` makes them.
- Open: Hlavna and Juzna platforms on bends look a little rough; trams are not lit at night; the Low frame budget of the district-life script was not re-run.
