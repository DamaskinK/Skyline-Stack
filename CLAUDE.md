# CLAUDE.md - Skyline Stack

Browser tower-stacking game in Three.js (r160, strict TypeScript, esbuild). University project, not for sale.
The game is called **Skyline Stack** (renamed in S0001 18; old `tb3d_*` storage keys are copied once to `skyline_*`).
One developer. Talk to them in the language they write in (Russian); everything written to the repo is in English.

Read first: `docs/BRIEF.md` (goals and every decision so far), then the plan in `work/plans/` and the open tasks.
Use the words of `GLOSSARY.md`. Hard decisions live in `docs/adr/`.

## Commands
```bash
npm install
npm run serve        # http://localhost:8000, no-cache dev server
npm run preview      # serve the built dist/ at http://localhost:8001
npm run build        # bundle into dist/
npm run typecheck   # tsc --noEmit (strict, no JavaScript under js/)
npm test             # typecheck + Vitest (simulation core, tests/core)
```

## Layout
`index.html` markup, `css/` styles, `js/` game code, all TypeScript (`config.ts` holds all balance numbers; imports keep the `.js` ending, the dev server and esbuild resolve it to `.ts`), `vendor/` Three.js,
`docs/` brief and ADRs, `scripts/*.mjs` and `tests/browser/*.mjs` (Node tooling, plain ESM on purpose, not typechecked), `work/plans/` specs, `work/tasks/<ID>-<topic>/NN-*.md` tickets.

## Work flow (copied from the Alium repo)
- Large or unclear work: brief or instruction -> grilling (terms to `GLOSSARY.md`, hard decisions to `docs/adr/`)
  -> `/to-spec` (plan in `work/plans/<ID>-<topic>.md`) -> `/to-tickets` (`work/tasks/<ID>-<topic>/NN-*.md`)
  -> build one ticket at a time.
- Task IDs: `S0001`, `S0002`, ... One task = one branch `s/<ID>-<topic>` = one pull request into `main`.
- Every plan and ticket has `**Type:**` and `**Status:**` lines. Ticket status: `ready-for-agent` -> `claimed` -> `done`.
  Acceptance criteria are checkboxes.
- Commit message: `<ID> <NN>: summary`.

## Rules
- Physics stays deterministic: same input, same result.
- Every external asset (model, texture, HDRI, music, sound, font) goes into `CREDITS.md` with URL and licence.
  CC0 first; CC-BY only with credit; OpenStreetMap data is ODbL (attribution).
- Original work only: no name, art, music, levels or rules copied from existing tower-stacking games.
- Quality presets (Low / Medium / High) stay; Low must run on a phone.
- UI text in English, kept in one place for later translation: `js/strings.ts` (static page texts use `data-t` keys in `index.html`).

## Agents and models
The main session (Opus) talks to the developer, grills, plans, reviews and picks what is next; it does not build.
Each ticket is built by a fresh `skyline-builder` (Sonnet); 3D models in Blender by `skyline-modeler` (Opus), because model quality matters most; milestone reviews by `skyline-reviewer` (Opus); checks and
recipes by `skyline-runner` (Haiku); repo searches by `skyline-scout` (Haiku). Details: `docs/agents/model-routing.md`.

## Blender (models)
Blender 5.3 at `/Applications/Blender.app`. Models are built headless from Python scripts in `scripts/blender/`
(reproducible, no GUI, no MCP): `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script.py> -- <out>`.
Export GLB with Draco compression (Three.js needs `DRACOLoader` + the decoder in `vendor/`), render a PNG preview with
EEVEE in the same script and look at it. Use Blender for landmarks, tower crowns/lobbies and floor modules; keep the
OpenStreetMap city procedural. Verified 2026-11-23: bevel, Draco GLB export and EEVEE render work headless.
