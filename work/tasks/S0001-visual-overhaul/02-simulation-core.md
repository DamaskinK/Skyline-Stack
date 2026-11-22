# 02: Simulation core with Vitest

**What to build:** game rules and physics run in a core with no Three.js, DOM or audio. It takes a difficulty (and later
a level), accepts drop / anchor / slow-mo input, steps at the fixed rate and reports events (spawn, landing kind, slip,
bounce, collapse, life lost, weather change, event warning and hit, run over) plus a readable state. The current game
becomes a thin adapter: rendering, audio and UI react to events and read state. The game plays the same.

**Blocked by:** 01

**Type:** improve
**Status:** claimed
**Read:** plan "Architecture: Simulation core", "Testing Decisions".

- [ ] Vitest set up (`npm test`), runs in Node without a browser
- [ ] Test: same difficulty, seed and input times give the same event list twice
- [ ] Tests: perfect / good / risky / slip at the edges of the windows; collapse when the weight above a floor stays past its edge
- [ ] Endless in the browser looks and plays as before (manual check plus no console errors)
- [ ] `window.__game` still exposes the state for browser scripts
