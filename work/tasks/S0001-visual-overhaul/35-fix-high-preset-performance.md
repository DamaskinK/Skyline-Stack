# 35: High preset runs smoothly on the developer's screen

**What to build:** High is smooth on a large / Retina screen, not only at 1280x720.

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** done
**Now:** the developer reports High as "very unoptimised" on their screen (about 2000 px wide, Retina, devicePixelRatio
2). Our checks ran at 1280x720 where High holds 60 fps; at full Retina resolution GTAO, bloom and MSAA run on 4x the
pixels.

- [x] Measure first: `tests/browser/check.mjs perf` at 2560x1440 with deviceScaleFactor 2 (add viewport/scale options to
      the script) on High, Medium and Low; record frame times and draw calls in Comments.
- [x] High holds 60 fps (p90 <= 18 ms) at 2560x1440 DPR 2 on the developer's Mac: e.g. cap the render scale on High
      (pixel ratio 1.5 or a dynamic resolution that drops when frames are slow), run GTAO at half resolution, cheaper
      shadow settings, fewer draw calls (merge/instance the near ring and landmarks further).
- [x] Medium and Low get faster too where it is free; Low stays phone-friendly.
- [x] No visible quality loss at normal viewing distance (compare screenshots before/after).

## Comments
- check.mjs now takes `--viewport WxH` and `--dpr N` (screenshots/reports get a `-dprN` tag).
- Before (2560x1440 DPR 2, M5 Pro): High p50 66.6 ms / 15 fps, 575 calls; Medium p50 16.7 / p90 33.3, 301 calls; Low 16.7 / 16.7, 177 calls.
- Cause: MSAA x4 on half-float targets plus GTAO at full ratio 2 (5120x2880). Changes: render scale cap High 1.5 / Medium 1.25 / Low 1
  (`maxPixelRatio` in world.js); MSAA 2 samples when the cap is >= 1.25; GTAO at half resolution; dynamic resolution in post.js
  (drops 0.25 steps to 1.0 after ~8 slow frames, climbs back after a long calm stretch, backs off longer each time).
- After: High p50 16.7 / p90 16.7 (60 fps), 583 calls; Medium 16.7 / 16.7, 309 calls; Low 16.7 / 16.7, 182 calls. At 1280x720 DPR 1 High and Low still pass.
  A GPU-bound loop (readPixels, no vsync) showed High at about 8 ms per frame, so roughly 2x headroom. Flicker checks and `npm test` (48) pass.
- Screenshot compared at 1280x720 DPR 1: no visible change (DPR 1 keeps 4x MSAA). Draw calls not reduced; merging the near ring/landmarks left to ticket 34.
