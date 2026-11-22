# 35: High preset runs smoothly on the developer's screen

**What to build:** High is smooth on a large / Retina screen, not only at 1280x720.

**Blocked by:** None (can start immediately).

**Type:** bug
**Status:** claimed
**Now:** the developer reports High as "very unoptimised" on their screen (about 2000 px wide, Retina, devicePixelRatio
2). Our checks ran at 1280x720 where High holds 60 fps; at full Retina resolution GTAO, bloom and MSAA run on 4x the
pixels.

- [ ] Measure first: `tests/browser/check.mjs perf` at 2560x1440 with deviceScaleFactor 2 (add viewport/scale options to
      the script) on High, Medium and Low; record frame times and draw calls in Comments.
- [ ] High holds 60 fps (p90 <= 18 ms) at 2560x1440 DPR 2 on the developer's Mac: e.g. cap the render scale on High
      (pixel ratio 1.5 or a dynamic resolution that drops when frames are slow), run GTAO at half resolution, cheaper
      shadow settings, fewer draw calls (merge/instance the near ring and landmarks further).
- [ ] Medium and Low get faster too where it is free; Low stays phone-friendly.
- [ ] No visible quality loss at normal viewing distance (compare screenshots before/after).
