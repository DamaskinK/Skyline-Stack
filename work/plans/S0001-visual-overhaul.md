# S0001: Visual overhaul, six city levels and progression

**Type:** improve
**Status:** approved
<!-- draft -> approved (developer read it and agrees) -> done -->
**Triage:** ready-for-agent
**Source:** `docs/BRIEF.md` (goals, references and every grilling decision), ADRs 0001 and 0002.

## Problem Statement

The game plays well, but it looks and sounds like a quick prototype. Materials are flat, the floor flickers while the
camera moves, the city around the tower is one plaza with box buildings, and the land runs out into an empty grass
plane under a gradient sky. Floors are wide and flat and do not read as storeys of a building. There is one synthesised
music loop for the whole game. The menus are plain panels in a pixel font. The main mode has no progression: the same
weather cycle repeats forever, and the only other mode (City) closely follows the rules of an existing commercial game,
which an original university project should not do.

## Solution

The game becomes **Skyline Stack**: a tower-stacking game across six real cities, ordered by size: Kosice, Prague,
Berlin, Dubai, New York, Tokyo. Each level is one tower in that city with a target height. The scene is built so the
city is recognisable at once: the real street grid around the build site, the city's typical buildings around it, and
on the horizon its landscape and landmarks (St. Elisabeth Cathedral and the Slovak Ore Mountains in Kosice, the Castle
and the Vltava in Prague, up to Tokyo Tower, the bay and Mount Fuji). Each city has its own building type with one
gameplay trait, weather from its real climate, only its real events, a time-of-day arc that moves with height, and its
own track that follows what happens on screen. Everything is drawn in a stylised low-poly style made rich by light:
image-based lighting, soft shadows, bloom, ambient occlusion and colour grading, with no floor flicker. Floors are
taller. A new menu shows a 3D fly-over of the city and a world map with the six levels on a route; levels give 1-3 stars
and open the next one. Endless stays on any opened city. City mode is removed.

## User Stories

### Look and feel
1. As a player, I want the ground to stay still and clean at every camera angle, so that the game does not look broken.
2. As a player, I want lit surfaces to respond to a real sky (image-based light), so that buildings look solid and grounded.
3. As a player, I want soft shadows from the tower, the crane and the buildings, so that depth reads clearly.
4. As a player, I want windows, neon and street lights to glow at dusk and at night, so that the city feels alive.
5. As a player, I want soft contact shadows where objects meet (ambient occlusion), so that the scene does not look flat.
6. As a player, I want each city to have its own colour mood, so that levels feel different at a glance.
7. As a player, I want rain, snow, fog, heat haze, sandstorms and typhoons to look convincing, so that the weather matters emotionally, not only in numbers.
8. As a player, I want landing dust, sparks and debris to look better and match the city's style, so that every drop feels physical.
9. As a player, I want each floor to look like a real storey (taller block with windows and a slab), so that the stack reads as a building.
10. As a player, I want the crane to fit the new style, so that it does not look like a placeholder.
11. As a player on a phone, I want a Low preset that stays smooth, so that I can play on the go.
12. As a player on a laptop, I want a High preset with every effect at 60 fps, so that the game looks its best.
13. As a player, I want the Low, Medium and High presets to switch effects, shadow size and prop density, so that I can trade looks for speed.

### Cities and scene
14. As a player, I want to recognise the city within seconds of a level starting, so that each level has a strong identity.
15. As a player, I want the streets right around my tower to follow the real street grid of that city, so that the place feels authentic.
16. As a player, I want the buildings around the site to be the city's typical kind (Prague roofs, Manhattan towers, Tokyo density), so that the middle distance matches the city.
17. As a player, I want the horizon to show the city's real landscape (hills, rivers, sea, desert, a distant volcano), so that the geography is right.
18. As a player, I want 2-4 famous landmarks on the horizon in their real direction, so that I know where I am.
19. As a player in Kosice, I want St. Elisabeth Cathedral, the State Theatre, Hlavna street, the Hornad river and the wooded hills of the Slovak Ore Mountains, so that my home city is recognisable.
20. As a player in Prague, I want Prague Castle with St. Vitus, Charles Bridge, the Vltava, the Zizkov TV tower and Petrin hill.
21. As a player in Berlin, I want the TV tower, the Brandenburg Gate, the Reichstag dome, the Spree and flat land.
22. As a player in Dubai, I want Burj Khalifa, Burj Al Arab, Palm Jumeirah, the gulf and dunes.
23. As a player in New York, I want the Empire State, the Chrysler Building, One WTC, the Statue of Liberty, the Hudson and Central Park.
24. As a player in Tokyo, I want Tokyo Tower, the Skytree, the Rainbow Bridge, the bay and Mount Fuji far away.
25. As a player, I want the background to stay in view as the tower rises, so that the landmarks frame the climb.
26. As a player, I want traffic, pedestrians, birds and planes that fit each city, so that the scene moves.
27. As a player, I want the city to fill the view to the horizon without empty plains, so that the world feels big.

### Levels and progression
28. As a player, I want six levels ordered by city size, starting with Kosice, so that the game grows with me.
29. As a player, I want each level to have a clear target height (20, 30, 40, 50, 60, 75 floors), so that I know my goal.
30. As a player, I want to see my progress towards the target during the level, so that I can pace myself.
31. As a player, I want 1 star for reaching the target, 2 for losing at most one life, 3 for at least 50 % perfect landings, so that I have a reason to replay.
32. As a player, I want the next city to open when I earn at least one star, so that I progress.
33. As a player, I want my best stars and best height per level saved in this browser, so that my progress stays.
34. As a player, I want a clear result screen after a level (stars, height, perfects, residents), so that I see how I did.
35. As a player, I want to retry a level or go back to the map from the result screen, so that I can keep playing.
36. As a player, I want Endless on any opened city with that city's scene, weather and music, so that I can play without a goal.
37. As a player, I want to choose the building type in Endless, so that I can play with the trait I like.
38. As a player, I want Easy, Normal and Hard to apply to every level, so that I can choose my challenge.
39. As a returning player, I want the game not to break because of old saved City scores, so that an update does not hurt me.

### Building types
40. As a player, I want each city to build its own type of tower with its own facade, so that the building fits the city.
41. As a player in Kosice, I want a plain panel block that behaves like the basics, so that I learn the game.
42. As a player in Prague, I want a hotel with a mansard where the perfect window is narrower, so that precision matters.
43. As a player in Berlin, I want a concrete-and-glass office with heavy floors, so that offsets weigh more.
44. As a player in Dubai, I want a glass skyscraper with slippery roofs, so that speed at release matters.
45. As a player in New York, I want an art deco tower with strong wind between skyscrapers, so that I must read the wind.
46. As a player in Tokyo, I want a neon tower built at night where mostly the lights show, so that timing is harder.
47. As a player, I want heavy, light, bouncy and golden special blocks to keep working on every building type, so that runs stay varied.
48. As a player, I want the HUD and the how-to-play screen to explain the current building type's trait, so that I am not surprised.

### Weather, events and time of day
49. As a player, I want each city's weather to follow its real climate (Kosice clear then rain, Prague rain and fog, Berlin snow and fog, Dubai heat haze then sandstorm, New York wind and thunderstorm, Tokyo night, neon and typhoon), so that it feels true.
50. As a player, I want heat haze to shimmer the view, so that Dubai feels hot.
51. As a player, I want a sandstorm to tint the air, cut visibility and push the tower, so that Dubai has its own threat.
52. As a player, I want a typhoon with heavy rain and strong gusts, so that Tokyo's finale is intense.
53. As a player, I want earthquakes only in Tokyo and lightning only in New York and Tokyo, so that events match reality.
54. As a player, I want a warning before an event hits, so that I can react (anchor, slow-mo).
55. As a player, I want the light to move from start to finish of a level (Tokyo evening to night, Dubai noon to sunset), so that the climb feels like time passing.
56. As a player, I want windows to light up as dusk comes, so that the arc is visible on the buildings.

### Music and sound
57. As a player, I want each city to have its own track whose character I link to it (Slovak folk motifs, classical or accordion, electronic, eastern scale, jazz or swing, city pop or synthwave), so that the city has a sound.
58. As a player, I want the music to be calm and slightly muffled while I build steadily, so that it does not tire me.
59. As a player, I want the music to open up during a perfect streak, so that success feels rewarding.
60. As a player, I want a tension layer to rise when the tower is close to falling, so that danger is audible.
61. As a player, I want a short drop-out in the music on a collapse or a lost life, so that the hit lands.
62. As a player, I want a short win sting when I reach the target, so that the finish feels like an event.
63. As a player, I want tracks long enough or alternated so they do not repeat in an annoying way.
64. As a player, I want a menu track, so that the menu has its own mood.
65. As a player, I want recorded sound effects for drops, landings, crashes, thunder, wind, rain and the city, so that the sound matches the new look.
66. As a player, I want the game to still make sound if a file fails to load, so that it never goes silent by accident.
67. As a player, I want separate music and effects volume and a mute key, so that I control the mix.

### Menu and interface
68. As a player, I want the main menu over a slow 3D fly-over of the selected city, so that the first screen is impressive.
69. As a player, I want a stylised world map with the six cities on a route, so that I see my journey.
70. As a player, I want a card per city with stars, best height and a preview, so that I can choose where to play.
71. As a player, I want locked cities dimmed with what opens them, so that I know what to do next.
72. As a player, I want an intro card with the city name and a camera pass over the landmarks before a level, so that each level starts with a moment.
73. As a player, I want a loading screen with progress while a city loads, so that I know the game is working.
74. As a player, I want a clean modern interface with one display font and one text font, keeping the arcade colours and motion, so that UI and graphics match.
75. As a player, I want smooth transitions between screens, so that the game feels polished.
76. As a player, I want the HUD restyled to the new look while keeping score, floor, target, lives, wind, weather, stability, slow-mo, anchor and next block, so that I lose no information.
77. As a player, I want menus to work with mouse, touch and keyboard, so that I can play my way.
78. As a player, I want the new title and logo "Skyline Stack" everywhere, so that the game has its own identity.
79. As a player, I want a credits screen listing every asset author and licence, so that the work of others is respected.

### Developer
80. As the developer, I want every level described by one data definition (city, order, target, building type, weather segments, events, time-of-day arc, track, palette, landmarks, build site), so that adding or tuning a level is editing data.
81. As the developer, I want the game rules and physics to run without a browser or Three.js, so that I can test them fast and deterministically.
82. As the developer, I want a script that turns an OpenStreetMap extract into compact street and footprint data for a level, so that the near ring is reproducible.
83. As the developer, I want each city's landmarks in their own module with a shared low-poly style, so that they are easy to build and tweak.
84. As the developer, I want assets per level listed in a manifest and loaded on demand, so that only the current city is downloaded.
85. As the developer, I want a screenshot and frame-time script for each level, so that I can check looks and the 60 fps budget after each milestone.
86. As the developer, I want all UI text in one file, so that Slovak or Russian can be added later.
87. As the developer, I want every external asset in `CREDITS.md`, so that licences are always clear.

## Implementation Decisions

### Architecture
- **Simulation core (new seam).** Game rules and physics move into a core that has no Three.js, DOM or audio. It takes a
  level definition and a difficulty, accepts `drop`, `anchor` and slow-mo input, advances by fixed steps, and reports
  events (spawn, landing with its kind, slip, bounce, collapse, life lost, weather change, event warning and hit,
  target reached, run over) plus a readable state (floors, lives, combo, score, residents, stability, wind, sway,
  hook and block positions). Rendering, audio and UI subscribe to the events and read the state. Today's `Game`
  becomes a thin adapter on top. Determinism stays: same level, difficulty, seed and input times give the same events.
- **Level definitions.** One data module lists the six levels. Shape (decision, not final code):
  `{ id, city, country, order, target, buildingType, site: { lat, lon }, weather: [{ fromFloor, kind }], events: [kind],
  dayArc: { start, end }, palette, track, landmarks: [id], rings: { near, middle, far } }`.
  Endless uses the same definition without a target; its weather loops through the city's segments with growing strength.
- **Building types** are data: facade style, floor mesh variant, and one trait expressed as multipliers the core
  understands (perfect window, mass, roof friction, wind on hook and tower, night visibility). Special blocks stay
  separate and stack on top of the type.
- **Floor size** becomes `W 4 x H 2.8 x D 4`. Drop gap, rope length, camera offsets, sway mode shape and collapse
  rules are retuned; final numbers come from a prototype on the Kosice scene.
- **Weather** becomes a list of segments by floor per level instead of one global cycle. New kinds: heat haze
  (screen-space shimmer, high glare, light wind), sandstorm (tinted fog, particles, low visibility, push event),
  typhoon (heavy rain, strong gusty wind). Existing kinds keep their friction and wind meaning.
- **Events** are per level: lightning (New York, Tokyo), earthquake (Tokyo only), sandstorm gust (Dubai). Each has a
  warning before the hit. The global "earthquake every 40 floors" rule goes.
- **Time-of-day arc** is driven by progress towards the target (Endless: by floors, looping): sun direction and colour,
  sky, fog, exposure, window and street-light emissive.
- **Progress store** replaces City scores: per level best stars, best height and opened state, plus Endless high
  scores per city. New storage keys with a version; old keys are ignored, not migrated.

### Rendering
- **Post-processing** with the Three.js r160 addons: render pass, ambient occlusion (GTAO, High only), bloom
  (Medium and High), colour grading per level (LUT or a grading pass), output pass. Addons are vendored next to
  `three.module.js`.
- **Image-based lighting** from one CC0 HDRI per level (Poly Haven) as the environment map; the visible sky stays a
  stylised dome so the HDRI's street-level view never shows.
- **Floor flicker fix:** no more stacked coplanar ground planes. Each ring's ground is one merged mesh (roads,
  sidewalks, markings baked into an atlas or as geometry with real height steps), and the camera near plane goes up.
- **Scene in three rings.** Near ring: street grid and footprints from a pre-processed OpenStreetMap extract around the
  level's site, built from CC0 kit pieces (Kenney, KayKit, Quaternius), instanced. Middle ring: generated filler in the
  city's style, instanced, lower detail. Far ring: stylised terrain silhouette (hills, river, sea, dunes, Fuji), water,
  and the landmarks at their real bearing with compressed distance.
- **Landmarks** are procedural, one module per city, shared low-poly material set, 1-3k triangles each. CC-BY models
  only where clearly better, credited.
- **Quality presets** map to: pixel ratio, shadow map size, AO on/off, bloom on/off, prop and traffic density,
  middle-ring density. Budget: 60 fps on High on the developer's Mac, about 300 draw calls, Low playable on a phone.

### Assets and build
- Per-level asset manifest; a loader with progress feeds the loading screen; models in GLB, textures compressed where
  it pays off, music in OGG with an MP3 or AAC fallback for Safari if needed.
- About 15 MB per level, loaded one level at a time. Procedural textures stay where they look good enough.
- Build: esbuild bundles the code; the build copies the asset folders into `dist/`. The single-file build is removed
  (ADR 0001).
- OpenStreetMap extracts are turned into compact JSON by a script with fixed parameters; the JSON is committed, the
  script is the source of truth. ODbL attribution in the credits.

### Audio
- A **music director** owns the current level track and its states: calm (lower volume, gentle low-pass), streak
  (full), danger (tension layer in, louder; driven by stability under 30 %), drop-out (short duck on collapse or lost
  life), win sting. Two tracks per level with a crossfade, or one track of 2+ minutes. Menu track separate.
- The tension layer is a second audio file per level or a synthesised pulse in the level's key.
- Sound effects from Kenney and Freesound (CC0 only). The current synth stays as a fallback when a file fails.
- Choosing the actual tracks is a research ticket; each one is checked and credited before use.

### Interface
- Main menu over a 3D fly-over of the selected city; world-map level select with six pins on a route and a card per
  city; locked cities dimmed with their condition; intro card and landmark camera pass before a level; loading
  screen; result screen with stars; credits screen.
- New visual system: one display font and one text font (OFL); `Press Start 2P` and `VT323` go. Arcade colours and
  motion stay. HUD keeps every current readout, adds target progress and the building-type trait.
- All UI strings in one module, English only for now.
- Rename to Skyline Stack: title, logo, README, storage keys (resets settings once).
- City mode removed: plot picker, building neighbour rules, city scores tab (ADR 0002).

## Testing Decisions

- **Good tests check behaviour at the highest seam**: give the simulation core a level, a difficulty and a list of
  input times, run it, and assert on the events and final state (floors, stars, lives, level complete). They never
  assert on internal variables or private helpers, so the core can be refactored freely.
- **Seam 1, simulation core (Vitest, Node, no browser).** Covers: determinism (same input, same events), landing
  kinds at the edges of the windows for each building type trait, slip and collapse with the new floor height, star
  rules, target reached ends the level, next level opens on one star, weather segments by floor per level, events only
  in their cities with a warning before each hit, Endless keeps going past any target, progress store reading old keys
  without crashing.
- **Seam 2, the running game in a browser (Playwright scripts, like the Alium `tests/shots` and `tests/perf`).**
  Uses the existing `window.__game` hook. Per level: load, wait for assets, take screenshots at fixed moments (start,
  mid-climb, finish; Low and High), sample frame times against the budget, check the console has no errors, and
  check that the ground does not flicker (two frames from a slowly moving camera differ only where things move).
- No unit tests for shaders, landmark geometry or UI layout: these are checked by screenshots and by eye at each
  milestone review.
- **Prior art:** none in this repo yet. The Alium repo uses Vitest for unit tests and Playwright scripts for screenshot
  diffs and frame budgets; the same patterns are copied here.

## Out of Scope
- Online leaderboards, accounts, multiplayer, monetisation, ads.
- Photogrammetry, Google 3D tiles or other heavy real-world meshes.
- Blender pipelines (landmarks are procedural; revisit only if a landmark cannot be done in code).
- Translations beyond English (strings are prepared for them).
- A new district-building mode replacing City mode.
- More than six levels.

## Further Notes
- **Milestones (vertical slice):** M1 foundation (core seam, folder build, asset loader, post-processing, flicker fix,
  tall floor prototype and retune); M2 Kosice complete as the quality bar (three rings, landmarks, weather, day arc,
  music director, stars); M3 menu, world map, progress, title and logo; M4 Prague, Berlin, Dubai, New York, Tokyo on
  the Kosice template; M5 polish, credits screen, phone check. Code review, screenshots and the frame budget after
  each milestone.
- **Research tickets before their milestone:** CC0 tracks per city (M2 for Kosice, M4 for the rest), OSM extract and
  build site per city, HDRI per city, kit pieces that fit each city's style.
- **Originality:** title, logo, art, levels, rules and music are our own or CC0/CC-BY; nothing from existing
  tower-stacking games.
- **Seams to confirm with the developer:** the simulation core as the main tested seam, and browser scripts for
  looks and speed.

## Changes after build

Changes dated 2026-11-22 (ticket 07, tall floors):
- `CFG.H` 1.6 -> 2.8 (floor is W 4 x H 2.8 x D 4).
- `CFG.ropeLen` 14 -> 17 (longer rope: crane jib sits higher, block tilt angle follows the rope).
- `CFG.dropGap` stays 3.5: the simulation does not depend on H, and with gap 3.5 the fall time and every core result match the old balance exactly (gap 4.5 made Hard worse).
- `CFG.METERS_PER_FLOOR` stays 3.2; `FOUND_H` stays 2.4.
- Sway mode shape `(y/H)^2` and collapse thresholds stay: they use the ratio y/(H*n), so they are height-independent. Tilt slope per floor falls with H, matching the same sway displacement.
- Camera offsets (`camOffsets` in `js/main.js`): (9,4,22) / (22,4,9) / (0,19,9) -> (12,6,30) / (30,6,12) / (0,26,12); camera target height `topY + 2.5` -> `topY + 4.5`.
- Facade texture canvas 256x128 -> 256x179 (aspect of W x H), layout stretched vertically so windows are not squashed.
- Menu demo tower 18 floors -> 10 floors (`DEMO_FLOORS`); menu camera look height 17 -> 19.
