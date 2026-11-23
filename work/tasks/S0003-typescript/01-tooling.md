# 01: TypeScript tooling

**What to build:** tsconfig (strict, allowJs), `@types/three` for r160, esbuild serve+watch dev server that bundles .ts
and .js (keeps no-cache and the same port), build and Vitest handle .ts, `npm test` = typecheck + Vitest. One trivial
module converted to prove the path. Update CLAUDE.md and README commands.

**Blocked by:** None (can start immediately).

**Type:** improve
**Status:** ready-for-agent

- [ ] `npm run serve`, `npm run build`, `npm test`, browser checks all work with mixed .ts/.js.
