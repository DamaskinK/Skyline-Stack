# 04: Browser check harness (Playwright)

**What to build:** scripts that open the running game, start a run through `window.__game`, and report: screenshots at
fixed moments, frame-time p50/p90 over a sample, console errors, and a ground flicker check (two frames from a slowly
moving camera differ only where things move). First used on the current game to get a baseline.

**Blocked by:** None (can start immediately).

**Type:** feature
**Status:** ready-for-agent
**Read:** plan "Testing Decisions: Seam 2".

- [ ] One command per check (shots, perf, flicker), with quality preset and level as options
- [ ] Output to a git-ignored folder; a short text report (pass/fail, numbers)
- [ ] Baseline run on the current game recorded in the ticket under Comments (flicker expected to fail)
