# Brief: visual overhaul, city levels and progression

**Type:** improve (size L)
**Status:** ready
<!-- draft -> ready (run grilling) -> planned (plan and tasks exist) -> done -->

University project, not for sale. This brief is the input for grilling, then `/to-spec` -> `/to-tickets` -> build.
Workflow copied from the Alium repo: plan in `work/plans/`, tasks in `work/tasks/<topic>/NN-*.md`, terms in `GLOSSARY.md`,
hard decisions in `docs/adr/`.

## Now
The game works (Three.js r160, plain ES modules, esbuild into one HTML file). Everything visual is generated in code:
- Materials are flat `MeshStandardMaterial` with canvas textures (`js/textures.js`). No post-processing, no environment map.
- The ground is a stack of planes 0.01-0.05 units apart, held apart by `polygonOffset` (`js/world.js:81`). With camera
  `near 0.1 / far 1200` the depth buffer is coarse and the floor flickers (z-fighting), seen as "glare on the floor".
- The city is one plaza, two road rings and box buildings. Ground outside is a flat grass texture to the horizon. The
  background is a gradient sky shader with procedural clouds.
- One floor block is `W 4 x H 1.6 x D 4` (`js/config.js`): wide and flat.
- Sound: synthesised effects and one chiptune loop with two moods (`js/audio.js`).
- Menus are plain HTML panels in a retro font (`index.html`, `css/style.css`).
- Endless has no progression: weather loops every 15 floors. City is a single 3x3 block.

## Goals
1. **Graphics that look finished.** Real PBR textures, image-based lighting, soft shadows, post-processing (bloom on
   lights and windows, ambient occlusion, colour grading), better weather and particle effects. No floor flicker.
2. **A living city around the tower.** Dense streets with real 3D models (buildings, cars, trees, street furniture),
   detailed ground (asphalt, sidewalks, parks, water), and layered background skyline to the horizon.
3. **Progression in the main mode: 5 levels.** Each level is a city inspired by a real one, with its own layout, skyline,
   palette, weather, music and goal. Bigger playing field than today; the plan of the city changes per level.
4. **More building types**, each with its own look and a gameplay difference.
5. **Taller floor blocks.** Proportions closer to a real storey stack (for example `W 4 x H 2.8`, to be decided),
   with physics and camera retuned.
6. **Several soundtracks** (menu, one per level, tension layer) and recorded sound effects instead of only synth.
7. **A beautiful menu**: animated 3D background, level select map, transitions, consistent visual style.

## Decisions (grilling)
Round 1, 2026-11-22:
- **Art style:** stylised low-poly (CC0 kits: Kenney, KayKit, Quaternius) made rich by lighting: HDRI, soft shadows,
  bloom, ambient occlusion, colour grading.
- **Build:** a static folder (`dist/`) with assets loaded per level and a loading screen. The one-file build is dropped.
- **Levels:** 6 levels, ordered by city size, **Kosice (Slovakia) is level 1**. Few levels, each one well crafted.
  The background shows the city's real landmarks, landscape and geography, so the city is recognisable at once.
- **Level = one tower** in that city with a target height. Stars: 1 = target reached, 2 = at most one life lost,
  3 = at least 50 % perfect landings. The next level opens with 1 star. Endless stays as a separate mode on any opened city.
- **City mode (3x3 block) is removed.**
- **Floor block:** `W 4 x H 2.8 x D 4`; camera, drop gap, rope and sway retuned, final values after a prototype.
- **Working title:** Skyline Stack.
- **Process:** git, `work/plans/`, `work/tasks/<topic>/NN-*.md`, `GLOSSARY.md`, `docs/adr/`, `CREDITS.md`, a short
  `CLAUDE.md`; one branch per task.

Round 2, 2026-11-22:
- **Order and targets:** Kosice 20, Prague 30, Berlin 40, Dubai 50, New York 60, Tokyo 75 floors (tune after tests).
- **Scene in three rings:** near ring = real street grid from OpenStreetMap around the build site, built from the kits;
  middle ring = the city's typical buildings; far ring = horizon relief and 2-4 landmarks at their real bearing,
  distance compressed to fit the frame.
- **Landmarks and geography:** Kosice: St. Elisabeth Cathedral, State Theatre, Hlavna street, Hornad river, wooded hills
  of the Slovak Ore Mountains. Prague: Prague Castle with St. Vitus, Charles Bridge, Vltava, Zizkov TV tower, Petrin hill.
  Berlin: TV tower, Brandenburg Gate, Reichstag dome, Spree, flat land. Dubai: Burj Khalifa, Burj Al Arab, Palm
  Jumeirah, the gulf, dunes. New York: Empire State, Chrysler, One WTC, Statue of Liberty, Hudson, Central Park.
  Tokyo: Tokyo Tower, Skytree, Rainbow Bridge, the bay, Mount Fuji far away.
- **Landmark models:** made by us in one stylised low-poly style (silhouette first, 1-3k triangles). CC-BY models only
  where clearly better, listed in `CREDITS.md`.
- **Building type per level** (facade + one gameplay trait): Kosice panel block (plain, tutorial), Prague hotel with
  mansard (narrow perfect window), Berlin concrete-and-glass office (heavy blocks), Dubai glass skyscraper (slippery
  roofs), New York art deco (strong wind between towers), Tokyo neon tower (night, only the lights show). Type is
  selectable in Endless. Special blocks (heavy, light, bouncy, golden) stay.
- **Weather by real climate:** Kosice clear then rain; Prague rain and fog; Berlin snow and fog; Dubai heat haze then
  sandstorm; New York wind and thunderstorm; Tokyo night, neon and typhoon. New weather: heat haze, sandstorm, typhoon.
- **Time of day moves with height:** each city has its own arc (Tokyo evening to night, Dubai noon to sunset); windows
  light up, bloom at dusk.
- **Music:** each level has its own track that the player links to that city and that follows what happens on screen
  (calm building vs. a tower about to fall), without becoming tiring. Plus a menu track. CC0 sound effects (Kenney,
  Freesound CC0). Synth only as a fallback. Every file checked and listed in `CREDITS.md`.

Round 3, 2026-11-22:
- **Adaptive music:** one track per level in the city's character (Kosice Slovak folk motifs, Prague classical or
  accordion, Berlin electronic, Dubai eastern scale, New York jazz or swing, Tokyo city pop or synthwave). Calm building:
  quieter, slightly muffled; perfect streak: full and open; stability under 30 %: a tension layer (pulse, drums) and
  louder; collapse or lost life: a short drop-out; finish: a short win sting. Tracks of 2+ minutes or two per level
  with a crossfade. Picking the actual CC0 tracks is its own research task.
- **Menu:** slow 3D fly-over of the selected city behind the main menu; level select on a stylised world map with 6 pins
  on a route, a card per city (stars, best height, preview), locked cities dimmed; city intro card and a camera pass
  over the landmarks before a level. Clean modern UI: one display font and one text font (OFL), `Press Start 2P` goes;
  the arcade feel stays in colour and motion.
- **Performance budget:** 60 fps on High on the developer's Mac; Low playable on a phone (no AO, smaller shadows);
  about 15 MB per level, levels loaded one at a time; about 300 draw calls, instancing for repeats.
- **Landmarks are procedural** in code (Lathe, Extrude, merged primitives), one module per city. Blender only later and
  only if needed.
- **Events follow reality:** earthquakes only in Tokyo, lightning in New York and Tokyo, the sandstorm pushes the tower
  in Dubai. Easy / Normal / Hard stay for all levels; the best stars per level are saved.
- **UI language:** English, every text in one file, ready for Slovak or Russian later.
- **Order of work (vertical slice):** M1 foundation (git, folder build, asset loader, post-processing, floor flicker fix,
  tall block prototype and physics retune); M2 Kosice complete (three rings, landmarks, weather, time of day, music,
  stars) as the quality bar; M3 new menu, level map, progress, new title and logo; M4 levels 2-6 on the Kosice
  template; M5 polish, credits, phone check. Review and screenshots after each milestone.

Grilling finished 2026-11-22: all branches settled.

## Not in scope
- Online leaderboards, accounts, monetisation, ads.
- Photogrammetry or real map tiles (Google 3D tiles): licences forbid it and they are too heavy.

## Limits
- **Originality.** Own title, logo, art direction, levels and music. We use the stacking genre, but nothing copied from
  any existing tower-stacking game (its name, art, building types and rules, music). The current title is a placeholder
  to be replaced.
- **Licences.** CC0 first. CC-BY allowed with a credits screen. OpenStreetMap data is ODbL: attribution required.
  Every external file is listed in `CREDITS.md` with source URL and licence.
- **Runs in a browser** on a mid laptop at 60 fps on High and on a phone on Low. Quality presets stay.
- **Deterministic physics stays** (same input, same result).
- Static site; decide whether the one-file build survives (see open questions).

## Scenarios
1. Start the game -> 3D menu with a slow fly-over of level 1 -> pick level on a map -> intro card with the city name.
2. Level 1 (small city, calm weather): reach the target height -> the level is scored with 1-3 stars -> level 2 unlocks.
3. Level 5 (megacity, storms): the camera rises past a real skyline; lights and bloom at night; music grows with height.
4. Phone, Low quality: the same levels with fewer props, no AO, lower shadow resolution, still smooth.

## Ideas to grill (not decided)
- **Five cities**, from small to megacity, each with a signature skyline and weather. Candidates: a European old town,
  a European business district, New York, Tokyo, Dubai or Shanghai. Or the home city of the university as level 1.
- **Level goal**: target floors, target residents, time limit, or a mix. Stars for perfects and no lost lives.
- **Building types per level**: residential, office, hotel, glass skyscraper, hospital, landmark tower. Gameplay
  differences (mass, width, slipperiness, bonus) vs. only looks.
- **City mode**: keep, merge into levels (each level = a district to fill), or drop.
- **Assets**: GLB models loaded at runtime vs. procedural; texture atlas; one-file build vs. a folder with assets.
- **Taller blocks**: how the perfect window, sway and camera change.

## Technical notes
- Three.js r160 addons needed (not in `vendor/` yet): `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `GTAOPass` or
  `SSAOPass`, `OutputPass`, `GLTFLoader`, `RGBELoader` / `EXRLoader`, `KTX2Loader` for compressed textures.
- Floor flicker: merge ground layers into one mesh with one baked texture (or decals with real height gaps), raise
  camera `near`, or try `logarithmicDepthBuffer`.
- Asset size budget per level (to be agreed), lazy loading per level, loading screen.

## References (free, checked licences)

### 3D models
| What | Source | Licence |
|------|--------|---------|
| City Kit Commercial / Suburban / Roads / Industrial (Kenney) | https://kenney.nl/assets/city-kit-commercial | CC0 |
| Retro Urban Kit (Kenney, has GLB) | https://opengameart.org/content/retro-urban-kit | CC0 |
| Downtown City MegaKit, NYC/Boston style, 300+ modular pieces (Quaternius) | https://quaternius.com/packs/downtowncitymegakit.html | CC0 (free part, ~60-70 %) |
| LowPoly Buildings Pack (Quaternius) | https://opengameart.org/content/lowpoly-buildings-pack | CC0 |
| LowPoly Modular Street Pack: streets, cars, traffic (Quaternius) | https://quaternius.itch.io/lowpoly-modular-street | CC0 |
| City Builder Bits: buildings, roads, lights, cars, parks, glTF (KayKit) | https://kaylousberg.itch.io/city-builder-bits | CC0 |

### Textures and lighting
| What | Source | Licence |
|------|--------|---------|
| PBR textures: concrete, asphalt, brick, facades, metal, glass | https://ambientcg.com | CC0 |
| PBR textures and HDRIs | https://polyhaven.com (FAQ: all assets CC0) | CC0 |
| HDRI: Shanghai Bund (night skyline) | https://polyhaven.com/a/shanghai_bund | CC0 |
| HDRI: Schadowplatz (day city street) | https://polyhaven.com/a/schadowplatz | CC0 |
| HDRI: Rooftop Day, Crosswalk | https://polyhaven.com/a/rooftop_day, https://polyhaven.com/a/crosswalk | CC0 |

### Real city layouts
| What | Source | Licence |
|------|--------|---------|
| OpenStreetMap: building footprints and heights for real districts | https://www.openstreetmap.org | ODbL (attribution) |
| OSM2World: converts OSM to glTF, usable in Three.js | https://www.osm2world.org | tool LGPL-3.0, data ODbL |

Realistic use: take a district's street grid and footprints from OSM as the layout, but render it with the low-poly kits
above, so the levels feel like the real city without heavy geometry.

### Music and sound
| What | Source | Licence |
|------|--------|---------|
| CC0 Retro Music collection | https://opengameart.org/content/cc0-retro-music | CC0 (check each track) |
| Chiptune Adventures / 400 loops (Juhani Junkala, SubspaceAudio) | https://opengameart.org/content/the-arplands (and author page) | CC0 |
| Interface Sounds, 100 files (Kenney) | https://kenney.nl/assets/interface-sounds | CC0 |
| UI Audio, 50 files (Kenney) | https://www.kenney.nl/assets/ui-audio | CC0 |
| Impact Sounds (Kenney) | https://kenney.nl/assets (verify page) | CC0 |
| Freesound: thunder, rain, wind, city ambience | https://freesound.org (filter CC0) | CC0 / CC-BY per file |

### Look and feel (inspiration only, nothing copied)
- Three.js examples: `webgl_postprocessing_unreal_bloom`, `webgl_postprocessing_gtao`, `webgl_shaders_sky`,
  `webgl_loader_gltf` (https://threejs.org/examples/).
- Stylised low-poly cities with warm light, fog depth and lit windows at night.

## Done when
- No floor flicker at any camera angle in all quality presets.
- 5 playable levels with their own city, skyline, music and goal; progress and stars saved.
- At least 6 building types.
- New menu with level select and transitions.
- `CREDITS.md` lists every external asset; licences allow the use.
- 60 fps on High on a mid laptop, playable on a phone on Low.

## Open questions
1. Which five cities, in which order?
2. Level goal and star rules.
3. Keep, merge or drop City mode?
4. One-file build or a folder with assets (size budget)?
5. Exact block proportions.
6. Art style: stylised low-poly (fits the CC0 kits) or semi-realistic PBR (heavier)?
7. New game title.

Playtest of Kosice, 2026-11-22:
- **Art direction refined:** "rich stylised" - stay stylised, but add real depth (cornices, window frames, recesses),
  relief maps on surfaces, fuller vegetation, volumetric clouds, warmer contrasted light. Not semi-realistic PBR.
- **People:** more detailed figures, dressed for each city and culture, respectful and everyday.
