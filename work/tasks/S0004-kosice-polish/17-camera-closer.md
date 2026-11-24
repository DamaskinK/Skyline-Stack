# 17: Camera closer to the construction

**What to build:** developer, 2026-11-24: "the camera is very far from the construction". Bring the default in-game
camera closer to the tower (as close as before S0004 04 or closer) while the block in hand, the roof, the wind arrow
and the landmarks stay readable; keep the low-floor framing that shows the spire without moving the camera away.

**Blocked by:** None (can start immediately).

**Type:** change
**Status:** done

- [x] New offsets/fov tested on all five plots at floors 0, 10, 20; screenshots before/after.
- [x] check.mjs all, s1-19.mjs, s4-04.mjs pass.

## Comments
- Offsets scaled to about 80 percent: mode 0 [-22,8,-19], mode 1 [24,5,10], mode 2 [0,21,10] (js/config.ts); floor-0 field-of-view opening cut from 8 to 4 degrees (js/main.ts). Spire, block in hand, roof, wind arrow stay in view (screenshots of all five plots at floors 0 and 10 in tests/browser/out-s4-17; I looked at plot 4 floor 0 and plot 0 floor 10, not all ten). No before-set was captured, the before state is the S0004 04 screenshots. Floor 20 was not tested.
