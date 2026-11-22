# 09: Weather segments and events per city

**What to build:** each level lists its weather as segments by floor (Kosice: clear, then rain) instead of the global
15-floor cycle; Endless loops the city's segments with growing strength. Events (lightning, earthquake, sandstorm gust)
happen only in the cities that list them, each with a warning before the hit. The global earthquake rule goes.

**Blocked by:** 08

**Type:** improve
**Status:** done
**Read:** plan "Weather", "Events"; brief decisions round 2-3.

- [x] Core tests: segment by floor per level; events only where listed; warning always before hit
- [x] Kosice plays clear then rain, no earthquakes, no lightning
- [x] HUD weather card and "next weather" use the segments

## Comments
- New `js/core/weather.js`: `weatherAt(level, n, loop)` and `nextWeather(...)`. Weather table `WEATHER` in `js/config.js` now has heat haze, sandstorm and typhoon (friction, wind, visibility; visuals fall back to clear, warm fog, storm).
- `Run` takes `{ level, endless }`. A level's `events` list is the only source of events: lightning (in storm/typhoon), `quake` (every `CFG.quakeEvery` floors, warning 2 floors before), `sandstormGust` (in sandstorm, reuses the lightning kick; events `gustWarning`/`gust`). No level = old global cycle and quake rule.
- Game now starts Endless on the chosen city (Kosice today): clear, rain, then loops with +20 % strength per cycle (period 25 floors). Level runs do not loop; HUD "next weather" is empty when nothing follows.
- Weather event now fires on every segment change (also back down after a collapse). 34 tests pass; browser check high PASS (HUD showed "RAIN IN 2 FL" at floor 8).
- Open: weather-change card for new kinds uses new inline icons; sandstorm/typhoon/heat haze visuals come with the Dubai/Tokyo tickets.
