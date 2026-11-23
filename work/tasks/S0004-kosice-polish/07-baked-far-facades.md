# 07: Distant houses look like the kit (baked facades)

**What to build:** beyond the 48 m (High) / 32 m (Low) kit radius of S0004 02, houses are flat plates with painted
windows, and the game camera sees most houses from 30-150 m. Bake the Blender kit modules into facade textures
(base colour + normal + AO, per module type and colour scheme, atlas) in scripts/blender, and use them on the far
version of every house so the old town and the estates read the same from the game camera as up close.

**Blocked by:** 03

**Type:** improve
**Status:** ready-for-agent

- [ ] Baked atlases per kit (old town, panel, in-between); windows with a hint of interior/reflection instead of flat blue.
- [ ] Far houses use them with correct bay alignment to the near modules (no visible jump at the switch).
- [ ] Flicker, audit and perf (2560x1440 DPR 2 High/Low) pass; screenshots from the game camera on every plot.
- [ ] Middle ring (js/far-ring.ts) uses the same atlases.

**Rules:** S0004 photo-reference and no-visual-bugs rules apply.
