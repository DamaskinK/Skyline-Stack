# 11: Back to the retro pixel UI

**What to build:** developer, 2026-11-24: the clean modern UI of S0001 18 does not fit; bring back the retro pixel
style of the original game (square pixel tiles in the logo, Press Start 2P + VT323 fonts, pixel borders, chunky
shadows, blinking cursor) for every screen, including the ones made since (district map, plot result, world map,
credits, loading, intro card) and the HUD. Keep the name Skyline Stack, `js/strings.ts`, the storage migration and
all behaviour.

**Blocked by:** None (can start immediately).

**Type:** change
**Status:** ready-for-agent

- [ ] Look of the original title/menu restored (compare with git history before S0001 18, e.g. commit d4a75d6^ .. 5dcb74e^).
- [ ] All screens and the HUD in the same pixel style; readable at 390 px phone width and at ~560 px narrow windows
      (today the logo is cut and the footer overlaps the menu at ~560 px wide).
- [ ] Fonts credited (OFL); ui-shots.mjs and s1-19.mjs pass.
