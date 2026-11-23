# 05: Kosice district balance

**What to build:** the difficulty climbs smoothly from Terasa to the cathedral, and the residents goal feels fair.

**Blocked by:** None (can start immediately).

**Type:** improve
**Status:** done

- [x] A bot of three skill levels (sloppy, average, good) plays every plot many times in the core (deterministic,
      seeded timing jitter); table of completion rate, stars and residents per plot and skill in Comments.
- [x] Tune targets, requirements, windScale, weather and residents goal so an average player finishes plots 1-3 and
      reaches the goal around plot 4; good players get 3 stars on the outskirts.
- [x] Core tests lock the tuned curve.

## Comments
- `js/core/bot.ts`: balance bot, public input only (drop timing). Per block it draws a seeded aim error and reaction jitter (sloppy 0.13 W / 0.09 s, average 0.09 / 0.06, good 0.04 / 0.03), drops when the hook crosses the aim point (lead 0.175 s, calibrated), `playPlot` and `playDistrict` (up to 4 tries per plot). Deterministic (mulberry32).
- Tuned Kosice (`js/levels.ts`): targets 12/14/16/20/22 (was 12/15/18/22/26), windScale 0.6/0.7/0.9/0.95/1.0 (was 0.8/0.9/1.0/1.1/1.25), Hlavna weather now clear then rain at 12, cathedral rain at 12 only, cathedral requirement 30 % perfect (was 40 %), goal 720 (was 800). Residents rates unchanged.
- Table, first attempt, 40 seeds, completion / avg stars (Terasa, Juzna, Kulturpark, Hlavna, Cathedral):
  - before: sloppy 57/40/13/0/0 %; average 93/90/68/13/3 % (goal 11/30 campaigns); good 100/100/75/68/0 % stars 3.0/2.9/1.7/1.9/0.
  - after: sloppy 57/38/23/3/3 % (goal 5/30); average 93/88/70/63/13 %, stars 2.4/2.3/1.5/1.4/0.2 (goal at plot 4 in 26/30, 1028 residents at the end); good 100/100/98/95/35 %, stars 3.0/3.0/2.5/2.8/0.8 (goal 30/30).
- `tests/core/balance.test.ts` locks the curve; `district.test.ts` and `district-progress.test.ts` updated for the new numbers. `npm test`: all pass except `intro-path.test.ts` (S0004 04, not mine).
