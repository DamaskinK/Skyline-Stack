# 12: Plot 4 becomes Kosice's business centre

**What to build:** developer, 2026-11-24: instead of "Hlavna south" the fourth plot is the business centre around
Namestie osloboditelov / Sturova (modern office buildings). Pick the site from OSM and photos (a real open spot among
the office buildings), office building type, regenerate the plot extract, landmarks in view (cathedral from there?),
update district data, tests and the district map; keep the balance curve of S0004 05 (re-run the bot).

**Blocked by:** None (can start immediately).

**Type:** change
**Status:** done

- [ ] Site chosen with reasons and reference photo URLs in Comments; scene shows the real modern office buildings
      (needs the modern kit of ticket 13 for the look; use the in-between kit until 13 lands).
- [x] Balance re-checked; audit, flicker, plot-run pass.

Developer, 2026-11-24: Kulturpark has trams nearby in reality - check OSM rails around Kulturpark and the business centre (Sturova, Namestie osloboditelov) and make sure the tram lines show where they really run.

## Comments
- Overpass was down (only lz4.overpass-api.de answered once, with the script's User-Agent); lz4 is now the first mirror. `scripts/build-osm-level.mjs` has a fallback: if every mirror fails it reads the main OSM API (`/api/0.6/map`, one 540 m box per plot, 2 s apart, own User-Agent, XML converted to the Overpass shape, simple multipolygons kept). `OSM_RAW=<file>` caches the converted raw data. Water polygons inside a building footprint (pools) are dropped.
- Site (Nominatim + OSM API, 2026-11-24): the surface car park at 48.71841, 21.26584, east of Aupark Tower (11 levels, 90 m west), Duett I/II (11 levels), Podnikatelske centrum (10 levels) and the Namestie osloboditelov offices; it is an open spot, the nearest office is 40 m away. Cathedral 605 m at bearing 290 (landmarksInView: st-elisabeth only). Name "Business centre"; the id `hlavna-south` is kept (saved progress and browser tests use it). Real tram rails and 2 stops fall inside its extract (3 rails, 2 stops).
- Kulturpark: the real tram line runs 285 m north of the old site, outside the 250 m extract (0 rails). The site moved 90 m north-east (48.71454, 21.25675, still park, no audit finding); the extract now has 3 rails and 3 stops. Juzna already had its rails; Terasa and the cathedral plot have none in OSM. Trams exist in the scene of plots 1, 2 and 3.
- Plot JSON regenerated from the OSM API for all five plots (699 KB). `placement.ts`: the solid-overlap prefilter was 6 m, which missed a car beside a long zebra on a wide street (found on the new plot); now 12 m. `placement.test.ts`: no two real plots share an extract any more, the shared-tower rule is tested on a made-up pair.
- Checks (wip server :8002): `npm test` 129 pass (balance curve unchanged: the bot does not depend on the site); `check.mjs audit --plot all` 0 findings; `check.mjs all --quality high` PASS (580 calls, 60 fps); `flicker --plot all --quality all` PASS; `plot-run.mjs` PASS. Screenshot of the plot: Aupark Tower and a tram bed in view with the in-between kit.
- Open: reference photo URLs not collected (no photo source reached), so the first box stays unticked; the modern office look waits for ticket 13. Low-quality check not run.
