# Skyline Stack

A tower-stacking game in Three.js with an arcade look. Drop swinging floors from a crane and build the tallest tower you can, while wind, weather and sway physics make each floor harder than the last.

## Run it

The game loads its models, textures and sounds per level, so it needs a web server (`file://` will not work).
Node.js 18+:

```bash
npm install
npm run serve       # development, from the source: http://localhost:8000
npm test            # typecheck (tsc) + simulation core tests (Vitest)
npm run build       # static site in dist/ (bundled code, page, styles, assets)
npm run preview     # serve dist/ at http://localhost:8001
```

`dist/` can be put on any static host (for example GitHub Pages).
`node scripts/vendor-addons.mjs <three@0.160.0 package>` refreshes the Three.js addons in `vendor/addons/`.

## Controls

| Key | Action |
| --- | --- |
| Space / click / tap | Drop the block |
| Shift (hold) | Slow-mo. Drains while held and refills by itself |
| A | Anchor: freezes the tower sway for 3 s |
| C | Camera: front, side, top |
| P / Esc | Pause |
| M | Mute |

Menus work with the mouse or with ↑ ↓ Enter Esc.

## Modes and difficulty

- **Endless:** one tower, as high as possible. Weather changes every 15 floors: Clear → Rain → Snow → Storm → Fog, then the cycle repeats and gets stronger.
- **City:** fill a 3×3 block. Residential goes anywhere; Commercial, Office and Luxury need certain neighbours. Score is the number of residents.

| | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Lives | 5 | 3 | 3 |
| Crane swing | slower, narrower | standard | faster, wider |
| Wind | ×0.6 | ×1 | ×1.35 |
| Perfect window | 12 % of a block | 8 % | 6 % |
| Score | ×0.75 | ×1 | ×1.6 |

## How the physics works

Everything is deterministic: the same drops in the same conditions always give the same result.

- **Crane:** a pendulum whose swing grows wider and faster with height. From floor 15 it also swings in depth.
- **Landing:** Perfect (centred), Good, Risky. More than half a block off and the floor slips off and costs a life. A Perfect snaps the floor to the centre and calms the sway.
- **Stability:** for every floor, the combined centre of mass of everything above it must stay over that floor. If it stays past the edge for 0.3 s, that part of the tower falls. The stability bar shows the worst floor, and that floor blinks red.
- **Sway:** the tower is a damped spring. Wind pushes it, off-centre landings kick it, and a crooked tower is softer and leans further.
- **Weather:** wet and icy roofs make the block slide in the direction it was moving. Storms add lightning strikes that shove the tower, and an earthquake hits every 40 floors.
- **Extras:** heavy, light and bouncy blocks; a golden block after 5 perfects in a row; one anchor at the start and one more every 25 floors.

## Project layout

```
index.html          page markup: HUD and menu screens
css/style.css       UI styling (Unbounded and Figtree fonts, arcade colours)
js/main.js          entry point, frame loop, camera
js/config.js        all balance numbers, difficulty presets, weather phases
js/physics.js       wind, crane swing, tower sway, stability rule
js/game.js          rules: spawning, scoring, lives, Endless and City modes
js/world.js         renderer, moving sky, city, traffic, clouds, birds, plane
js/entities.js      floor blocks, lobby, roof, crane
js/fx.js            particles, rain, snow, lightning, people with umbrellas
js/textures.js      procedural canvas textures (facades, shops, billboards)
js/audio.js         synthesised sound effects and chiptune music
js/ui.js            menus, settings, high scores, HUD
js/strings.js       every UI text in one place
js/settings.js      settings and progress in localStorage (keys skyline_*; old tb3d_* keys are copied once)
vendor/three.module.js   Three.js r160
build.mjs           bundles everything into dist/
```

Balance changes go in `js/config.js`. For example, `CFG.collapseEndsGame = true` makes a collapse in Endless end the game immediately.
