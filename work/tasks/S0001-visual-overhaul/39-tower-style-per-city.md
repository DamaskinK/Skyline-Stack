# 39: The player's tower looks like a building of its city

**What to build:** the stacked tower reads as a real building of the level's city, with a proper top instead of the old
roof with an antenna (developer, 2026-11-22: "for each city its own house style and textures; the house with the
antenna is not nice").

**Blocked by:** None (can start immediately).

**Type:** improve
**Status:** done
**Now:** the menu demo tower and Endless still use the old blue blocks with a flat roof, a water tank and an antenna;
the lobby is the old shop-front with the old sign.

- [x] A crown/top per building type replaces the antenna roof when a level is completed and on the menu demo tower:
      panel block - flat roof with a small lift house and parapet; hotel - mansard with dormers; office - glass crown;
      glass skyscraper - spire; art deco - stepped crown; neon tower - lit sign frame. Only panel must look final now.
- [x] A lobby / ground floor per building type (panel: entrance canopy and ground-floor shop; others as data with a
      shared fallback). No old game name on any sign (use the city name or a shop name).
- [x] The menu demo tower uses the selected city's building type, floors and crown.
- [x] Facade textures per building type have a crisp, attractive style (shared with ticket 37's look); special blocks
      keep their own colours.
- [x] Screenshots of the demo tower and of a completed Kosice tower.

## Comments
- `makeCrown(typeId)` in `js/entities.js`: panel (parapet + lift house), hotel (mansard), office (glass box), glass (spire),
  deco (stepped, gold trim), neon (lit frame). Only panel is meant to be final; the others are first versions.
  Added to the top floor mesh when a level is completed, and on the demo tower. The old tank and antenna roof is gone.
- `makeFoundation(x, z, typeId, city)`: per-type lobby texture (`lobbyTexture`), entrance canopy, shop sign from the type
  (`sign`, Kosice panel: POTRAVINY) or the city name. No old game name remains on a sign.
- `buildDemo(levelId)` uses the level's building type, facade and crown (default Kosice; ui.js still calls it without an
  argument, so a city picker later only needs to pass the id).
- `js/textures.js`: facade styles hotel/office/glass/deco/neon (`typeFacade`) next to the panel one; special blocks keep their colours.
  `building-types.js` gained `crown`, `sign` and facade ids.
- Not verified in the live game: crowns of non-panel types on a finished level (no other city is built); they were checked on the demo tower.
- Screenshots: `tests/browser/out39/` (demo/top/base per type, kosice-completed.png).
