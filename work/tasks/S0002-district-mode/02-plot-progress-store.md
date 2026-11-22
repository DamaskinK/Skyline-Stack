# 02: Plot progress and migration from S0001

**What to build:** progress per plot (best stars, best height, residents, counted) and per city (opened, goal reached)
in a new versioned key; S0001 Kosice level progress carried over.

**Blocked by:** 01

**Type:** feature
**Status:** ready-for-agent
**Read:** plan "Progress store"; S0001 ticket 08 Comments (current store).

- [ ] Read/write helpers with tests; bad or old data never breaks loading.
- [ ] S0001 Kosice stars and best height map onto one Kosice plot (choose the simplest mapping, note it in Comments).
- [ ] Endless high scores per city unchanged.
