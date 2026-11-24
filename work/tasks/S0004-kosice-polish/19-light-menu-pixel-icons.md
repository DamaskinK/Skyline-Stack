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
**Status:** ready-for-agent

- [ ] Title appears instantly; no frame drops on the menu (measure frame times on the menu for 5 s at 2560x1440 DPR 2).
- [ ] All icons pixel art in one palette; desktop, 562 px and 390 px screenshots; ui-shots.mjs and s1-19.mjs pass.
