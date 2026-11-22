# 05: District map screen

**What to build:** a stylised top-down map of the city: five plots on a path from outskirts to centre, each with a card
(type, target, requirement, view/skyline bonus, stars), the residents bar to the goal, Play on the open plot, locked
plots dimmed. Reached from the city choice; keyboard, mouse and touch; phone layout.

**Blocked by:** 01, 02

**Type:** feature
**Status:** done
**Read:** plan "District map screen"; S0001 tickets 18 and 20 (use their look if they are done, otherwise keep to the
current UI style and leave hooks).

- [x] Map drawn from the plot data (positions from lat/lon), no hand-placed coordinates.
- [x] Bonuses visible before building.
- [x] Screenshots desktop and phone width.

## Comments
New screen `#sMap` with `js/district-map.js` (layout from plot lat/lon or x/z, fitted to the box; path, rings, pins as real buttons; five cards with type, target, requirement, view/skyline bonuses, stars; residents bar). Reached from NEW GAME > DISTRICT MODE (Kosice, Newtown cards); pins and cards select, keyboard arrows and Esc work through the existing screen handling. Phone (390 px) is one column, map first.
Play on an open plot starts the existing Kosice level run (ticket 04 will wire per-plot scenes); Newtown Play is disabled with a note. Migrated S0001 progress shows the cathedral plot as built, with no Play (opening rule kept). Screenshots in `tests/browser/out/s0002-05/` (desktop, phone, migrated, partial progress); no console errors. `npm test` green. Low quality not rechecked (no rendering touched).
