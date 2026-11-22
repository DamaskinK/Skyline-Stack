# 32: Fix the black box next to the tower and the cathedral framing

**What to build:** two visual faults found in the screenshots of tickets 06-14 are gone.
1. A black, opaque rectangle (about one floor in size) appears next to the middle floors of the tower on High
   (e.g. right of floors 4-6 in `tests/browser/out/kosice-high-mid.png`). Builders saw it before and after ticket 07.
2. St. Elisabeth Cathedral stands about 21 m from the build site and fills the right half of the default game view;
   its spire is cut off while the tower is low. The developer wants the cathedral visible and recognisable next to the
   tower, not covering the view.

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** claimed
**Read:** ticket 14 and 06 `## Comments`; `docs/agents/model-routing.md`.

- [ ] Cause of the black box found and named in Comments (reproduced first: which object, which pass, which preset)
- [ ] The black box no longer appears on High, Medium or Low (screenshots at several floors)
- [ ] Default camera shows the tower, the block in hand, the roof, the wind arrow and the whole cathedral with its spire
      at the start of a run (move the build site a little within the old-town plaza if needed, keep the theatre in view
      from some camera mode)
- [ ] `npm test` and `node tests/browser/check.mjs all` (High and Low) pass
