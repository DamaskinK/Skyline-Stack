# 32: Fix the black box next to the tower and the cathedral framing

**What to build:** two visual faults found in the screenshots of tickets 06-14 are gone.
1. A black, opaque rectangle (about one floor in size) appears next to the middle floors of the tower on High
   (e.g. right of floors 4-6 in `tests/browser/out/kosice-high-mid.png`). Builders saw it before and after ticket 07.
2. St. Elisabeth Cathedral stands about 21 m from the build site and fills the right half of the default game view;
   its spire is cut off while the tower is low. The developer wants the cathedral visible and recognisable next to the
   tower, not covering the view.

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** done
**Read:** ticket 14 and 06 `## Comments`; `docs/agents/model-routing.md`.

- [x] Cause of the black box found and named in Comments (reproduced first: which object, which pass, which preset)
- [x] The black box no longer appears on High, Medium or Low (screenshots at several floors)
- [ ] Default camera shows the tower, the block in hand, the roof, the wind arrow and the whole cathedral with its spire
      at the start of a run (move the build site a little within the old-town plaza if needed, keep the theatre in view
      from some camera mode)
- [x] `npm test` and `node tests/browser/check.mjs all` (High and Low) pass

## Comments
- Cause: not a post pass and not a debris/marker object. It was the tall west window of the cathedral (`glass` landmark material, 0x2d4458, 3 x 9 m, kosice.js), unlit by day so it rendered near-black next to floors 4-6. Reproduced on High (hiding that material removed the box). Fix: lighter glass colour 0x6f93b3 in js/landmarks/style.js. Checked High and Low screenshots at floors 0, 4-8.
- Framing: build site moved to 48.72100, 21.25755 (about 18 m west, 45 m north, on the plaza; levels.js and build-osm-level.mjs) and osm.json regenerated; landmark offsets in kosice.js AT shifted by the same amount. Cathedral now ~90 m away (was 21 m), right of the tower; theatre 83 m north.
- Open: at the very start (floor 0) the camera looks low, so the north spire is still cut by the top of the screen; from about floor 6-8 nearly the whole cathedral is in frame. Showing the spire at floor 0 would need a camera change (pitch/FOV), left to the developer. Theatre view from a camera mode not checked.
- `npm test` 48 pass; `check.mjs all` High and Low PASS.
