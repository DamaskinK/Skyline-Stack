# 01: TypeScript tooling

**What to build:** tsconfig (strict, allowJs), `@types/three` for r160, esbuild serve+watch dev server that bundles .ts
and .js (keeps no-cache and the same port), build and Vitest handle .ts, `npm test` = typecheck + Vitest. One trivial
module converted to prove the path. Update CLAUDE.md and README commands.

**Blocked by:** None (can start immediately).

**Type:** improve
**Status:** done

- [x] `npm run serve`, `npm run build`, `npm test`, browser checks all work with mixed .ts/.js.

## Comments
- tsconfig.json (strict, allowJs, checkJs off, noEmit); typescript 7.0.2 and @types/three 0.160.0 (pinned). `npm test` = `tsc --noEmit` + Vitest (82 tests); `npm run typecheck` added.
- Dev server (scripts/serve.mjs, same port, no-store) compiles .ts per request with esbuild and maps a missing x.js to x.ts, so imports keep `.js` specifiers. No bundling and no watch needed. The import map is kept because the browser still loads separate modules; it can go when the dev server bundles. Open for a later ticket.
- build.mjs resolves .ts; vitest.config.mjs maps .js imports to .ts. Proof module: js/core/dayarc.ts (typed).
- Checks: `check.mjs all` high and low on :8000 and high on the built preview :8001, all PASS, no console errors.
