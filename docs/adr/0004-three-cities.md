# 0004: Three real cities instead of six

**Status:** accepted, 2026-11-23

## Context
Kosice took most of milestone M2 to reach an acceptable quality, and the developer judged it still too flat until the
rich stylised pass. Six cities at that bar do not fit a university project's time.

## Decision
Three real cities, ordered small to large: Kosice, Prague, Tokyo. Newtown (fictional) stays as a bonus city.
Berlin, Dubai and New York are dropped with their tickets (S0001 23-28 `wontfix`). Their building types (office,
glass, deco) stay available as data for plots inside the three cities and Newtown.

## Consequences
- The world map shows three cities on the route plus Newtown apart.
- Weather kinds heat haze and sandstorm have no city now; typhoon stays for Tokyo.
- Level data for the dropped cities is removed in the next ticket that touches `js/levels.js`.
