# 09: Weather segments and events per city

**What to build:** each level lists its weather as segments by floor (Kosice: clear, then rain) instead of the global
15-floor cycle; Endless loops the city's segments with growing strength. Events (lightning, earthquake, sandstorm gust)
happen only in the cities that list them, each with a warning before the hit. The global earthquake rule goes.

**Blocked by:** 08

**Type:** improve
**Status:** claimed
**Read:** plan "Weather", "Events"; brief decisions round 2-3.

- [ ] Core tests: segment by floor per level; events only where listed; warning always before hit
- [ ] Kosice plays clear then rain, no earthquakes, no lightning
- [ ] HUD weather card and "next weather" use the segments
