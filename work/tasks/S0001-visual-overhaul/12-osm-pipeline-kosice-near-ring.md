# 12: OpenStreetMap pipeline and Kosice near ring

**What to build:** a script turns an OpenStreetMap extract around a level's build site into compact JSON (roads,
footprints, heights, parks, water) with fixed parameters. The Kosice near ring (about 150-300 m) is built from it with
CC0 kit pieces (Kenney / KayKit / Quaternius), instanced.

**Blocked by:** 03, 05

**Type:** feature
**Status:** done
**Read:** plan "Scene in three rings", "Assets and build"; brief references.

- [ ] Build site for Kosice chosen near the centre with the landmarks in the default camera view; noted in the level data
- [x] Script and generated JSON committed; ODbL attribution in CREDITS; kit packs in CREDITS
- [x] Ground uses the merged-mesh approach from 05 (no flicker)
- [x] Draw calls and frame time within budget (04 checks)

## Comments
- `scripts/build-osm-level.mjs kosice` (Overpass, mirrors with retry, bbox 600 m around the site) writes `assets/levels/kosice/osm.json` (189 KB):
  484 roads, 591 footprints (58 with a height tag, the rest get 9-17 m from a position hash), 95 parks, 7 water. `OSM_RAW=<file>` rebuilds from a saved response.
- `js/near-ring.js` builds it: ground layers (urban 1 cm, parks, water, roads, paths, plaza 6 cm) as merged meshes with real steps and a depth bias,
  walls merged per facade variant (8) plus one roof mesh, trees instanced, KayKit street lights, bushes and parked cars instanced.
  A 28 m plaza is kept at the origin, no buildings within 24 m. `js/world.js` puts the old near city in `nearProc` and hides it when the level has an `osm` asset;
  procedural background blocks moved to 310-480 m (30 blocks, own random stream).
- Checks (Kosice): flicker depth/shadow PASS, 60 fps; draw calls 196 on Low, ~630 on High (counts the shadow pass); no console errors.
- Open: the box "build site noted in level data" is not ticked: `js/levels.js` was off limits. Site stays 48.7206, 21.2578. From it (north = up):
  St. Elisabeth Cathedral 42 m at bearing 147 deg (south-east), National Theatre 130 m at 345 deg (north-north-west); Hlavna street runs past the site.
  Both are in `osm.json` under `landmarks`. Traffic is off on OSM levels (no cars on the real streets yet); parked cars only.
