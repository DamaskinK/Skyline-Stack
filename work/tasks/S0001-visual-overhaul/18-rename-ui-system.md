# 18: Rename to Skyline Stack and new UI system

**What to build:** the game is called Skyline Stack everywhere (title, logo, README, storage keys: settings reset once).
A clean modern visual system: one display font and one text font (OFL), colour and spacing tokens, arcade colours and
motion kept. All UI strings in one module. Existing screens and the HUD redrawn in the new style with every readout kept.

**Blocked by:** 01

**Type:** improve
**Status:** done
**Read:** plan "Interface"; user stories 74-78, 86.

- [x] No "Tower Bloxx" left in UI, code names or docs (except history)
- [x] Press Start 2P and VT323 removed; new fonts credited
- [x] Mouse, touch and keyboard still work on every screen; phone width checked

## Comments
- Renamed to Skyline Stack (title, logo, README, CLAUDE.md, package name, storage keys `skyline_*`). `js/settings.ts` copies the old `tb3d_*` values once to the new keys when those are empty (settings, progress, district progress, name), so progress is kept (this overrides "settings reset once"). Checked by `tests/browser/ui-shots.mjs`, which seeds the OLD keys.
- Fonts: Unbounded (display) and Figtree (text), OFL, from Google Fonts, in `CREDITS.md`. Press Start 2P and VT323 are gone. New CSS tokens: radius, lift shadow, same arcade colours and hazard stripe.
- All UI text in `js/strings.ts` (static page texts through `data-t` keys, dynamic ones as functions, popups and banners of `game.ts` too). Sentence case, buttons name the action. Difficulty labels in `config.ts` are now sentence case.
- Redrawn: title, New Game (Endless and district cards), district map, settings, scores, help, loading, pause, plot result, game over, HUD. Also fixed: tall screens were clipped at the top on a phone (`safe center`), and the touch Slow-mo button showed on menus.
- Checks: `npm test` 82 passed; `check.mjs all` high and low PASS; `ui-shots.mjs` PASS at 1280x720 and 390x844 touch (no horizontal scroll, keyboard Enter/arrows/Esc/P, no console errors). Screenshots in `tests/browser/out-s1-18/`.
- Open: the NEW GAME panel is taller than 720 px, so Start game needs a scroll on small laptop screens (as before).
