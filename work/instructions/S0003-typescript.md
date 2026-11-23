# S0003: Move the code base to TypeScript

**Type:** improve
**Status:** planned

## Task
Developer, 2026-11-23: use TypeScript instead of plain JavaScript.

## Decisions (main session)
- Gradual, expand-contract: first the tooling accepts .ts next to .js (esbuild bundles both; `tsc --noEmit` with
  `allowJs` and `checkJs` off for .js), then modules move in batches from the bottom of the dependency graph up, each
  batch green on its own; finally `allowJs` off and strict on everywhere.
- Strict mode for every converted file. Three.js types from `@types/three` matching r160.
- The dev server serves TypeScript through esbuild (watch + serve) instead of plain ES modules from disk; the import
  map goes away. `npm run serve` stays the one command.
- `npm test` runs typecheck + Vitest.

## Limits
- No behaviour changes; simulation stays deterministic; all browser checks stay green after each batch.
- Not in parallel with other builders (touches every file).
