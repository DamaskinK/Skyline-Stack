# 19: Light main menu without lag, pixel-art icons everywhere

**What to build:** developer, 2026-11-24.
1. "The menu lags at the start because it tries to load Kosice; let there always be one main menu so it does not lag."
   The main menu no longer loads a city scene. It shows one fixed, light background: a pre-rendered pixel-style
   panorama image of Kosice (rendered once from the game or Blender, a few hundred KB, with a slow parallax/pan and the
   pixel logo), or an equally light static scene. The city loads only when a game or district starts (behind the
   loading screen/intro). Remove the S0001 19 menu city loading; keep the intro.
2. "Make all icons - heart, wind arrow, score star, people, etc. - in pixel style, so everything is one style."
   Every icon in the HUD and menus as crisp pixel art (SVG rects on a pixel grid or small PNGs with
   image-rendering: pixelated): hearts (full/empty), score star, residents, wind compass and arrow, weather icons
   (clear, rain, snow, storm, fog, typhoon...), mute/unmute, camera, pause, anchor, back arrows, lock, stars of the
   district map, plot pins.

**Blocked by:** None (can start immediately).

**Type:** change
**Status:** done

- [x] Title appears instantly; no frame drops on the menu (measure frame times on the menu for 5 s at 2560x1440 DPR 2).
- [x] All icons pixel art in one palette; desktop, 562 px and 390 px screenshots; ui-shots.mjs and s1-19.mjs pass.

## Comments
- Menu: no city scene loads for it any more. `#menuBg` shows one pre-rendered pixel panorama of Kosice (`assets/ui/menu-kosice.png`, 400x225, 11 levels per channel, 82 KB, made by `scripts/menu-panorama.mjs` from the game scene: cathedral plot, pose 4) with a slow CSS pan; the canvas is hidden and not drawn while a menu screen shows. The city loads in startGame (behind the loading screen), the intro is kept. `body.menu-bg` toggles in show()/hideScreens(). Removed loadMenuScene, the loading pill, toMap's 3D rebuild.
- Icons: `js/pixel-icons.ts` draws every icon from character bitmaps as SVG paths (crispEdges, one palette, size = grid x `--px`): hearts (full/empty), stars (full/empty), person, wind compass (pixel disc, arrow snapped to 15 degrees), 8 weather icons, mute/unmute, camera, pause, anchor, lock, check (map pins). Back arrow was already pixel CSS. HUD icons come from `data-icon` spans in index.html.
- Checks: `tests/browser/s4-19.mjs` (new): title visible 305 ms after load, menu at 2560x1440 DPR 2 p95 16.7 ms / worst 16.8 ms over 5 s, no city loaded, all icons pixel svgs at 1280, 562, 390 px. s1-19.mjs updated to the new menu and passes; ui-shots.mjs passes; npm test 129 pass. Shots in tests/browser/out-s4-19.
- Open: check.mjs all (high and low) fails only `flicker depth game/low` (1.15 / 1.25 % vs 1.0 %), a rendering metric; this ticket changes no rendering, other uncommitted work (roof props / near ring) is in the tree. The panorama is our own render (CC0 kits and own models); no CREDITS row added.
