# 01: Remove City mode

**What to build:** the game has only Endless. The City option, the plot picker, the building neighbour rules and the City
high-score tab are gone; Endless plays exactly as before. Prefactor that makes the core extraction (02) smaller. ADR 0002.

**Blocked by:** None (can start immediately).

**Type:** improve
**Status:** claimed
**Read:** plan sections "Solution", "Interface"; `docs/adr/0002-remove-city-mode.md`.

- [ ] New Game screen has no mode choice for City; Start goes to Endless
- [ ] Plot state, building types with neighbour rules and the city picker screen are removed from code and markup
- [ ] High scores show Endless only; saved City scores in storage do not break loading
- [ ] Endless run, game over, save score and play again still work (checked in the browser, no console errors)
