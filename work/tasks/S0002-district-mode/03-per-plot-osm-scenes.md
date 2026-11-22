# 03: A scene for every plot from its own OpenStreetMap extract

**What to build:** the OSM script writes one compact extract per plot (~150-200 m radius around its site); the near ring
builds around the plot being played; the middle and far rings stay per city and are offset correctly for each plot.

**Blocked by:** 01, S0001 ticket 38

**Type:** feature
**Status:** ready-for-agent
**Read:** plan "Scenes"; S0001 tickets 12, 13, 34, 38 Comments.

- [ ] Five Kosice plot extracts generated and committed; ODbL credit kept; total ~2-3 MB.
- [ ] Loading a plot shows its real streets: panel estate on the outskirts plot, baroque around the centre plots.
- [ ] Landmarks and the far ring sit at their real bearing/distance from each plot.
- [ ] Perf at 2560x1440 DPR 2 on High within the ticket 35 budget; flicker passes; screenshots per plot.
