# 04: Play a plot end to end; finished towers stay in the city

**What to build:** starting a plot runs a tower with the plot's type, target, requirement, wind and weather; the result
counts or not, stars and residents (with bonuses) are saved; finished towers stand at their plot positions in later
runs (real model in the loaded rings, simple instanced tower further away) and the result screen shows the district
progress and whether the next city opened.

**Blocked by:** 01, 02, 03

**Type:** feature
**Status:** ready-for-agent
**Read:** plan Solution, user stories 9-18.

- [ ] Requirement shown during the run (HUD) and on the result screen (counted / not counted and why).
- [ ] Finished towers visible from other plots; crowns from S0001 ticket 39.
- [ ] Next city opens at the goal; replays keep the best.
- [ ] Core and browser checks pass.
