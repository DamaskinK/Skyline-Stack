# 12: OpenStreetMap pipeline and Kosice near ring

**What to build:** a script turns an OpenStreetMap extract around a level's build site into compact JSON (roads,
footprints, heights, parks, water) with fixed parameters. The Kosice near ring (about 150-300 m) is built from it with
CC0 kit pieces (Kenney / KayKit / Quaternius), instanced.

**Blocked by:** 03, 05

**Type:** feature
**Status:** ready-for-agent
**Read:** plan "Scene in three rings", "Assets and build"; brief references.

- [ ] Build site for Kosice chosen near the centre with the landmarks in the default camera view; noted in the level data
- [ ] Script and generated JSON committed; ODbL attribution in CREDITS; kit packs in CREDITS
- [ ] Ground uses the merged-mesh approach from 05 (no flicker)
- [ ] Draw calls and frame time within budget (04 checks)
