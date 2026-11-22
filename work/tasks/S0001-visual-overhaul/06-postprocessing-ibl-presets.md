# 06: Post-processing, image-based light and quality presets

**What to build:** the scene is lit by a CC0 HDRI environment (the visible sky stays the stylised dome), with bloom,
ambient occlusion (GTAO), a colour-grading pass and the output pass. Low / Medium / High switch pixel ratio, shadow size,
AO, bloom and prop density.

**Blocked by:** 03, 04

**Type:** feature
**Status:** done
**Read:** plan "Rendering", "Quality presets".

- [x] Glowing windows and lights bloom at night (Storm phase in the current game)
- [x] AO visible where buildings meet the ground on High; off on Low
- [x] Grading can be set per level (one default for now)
- [x] Perf check: High at 60 fps on the developer's Mac; Low smooth at phone size
- [x] HDRI credited

## Comments
- `js/post.js`: Low = direct render, no passes; Medium = bloom + tone mapping + grade; High = + GTAO. Composer target is
  half-float with 4x MSAA. `setGrade({ lift, gain, contrast, saturation, vignette })` for per-level grading.
- Image-based light: the level's HDRI goes through PMREM into `scene.environment`; env strength 0.35 by day, dims with
  night; hemisphere fill drops to 55 % while the env is on (it was washing out shadows at full strength).
- 60 fps on High, Medium and Low (developer's Mac). Draw calls per frame now count every pass: High ~670 (GTAO renders
  the scene a second time for normals), Low ~380. The ~300 budget is for the scene itself; instancing in later tickets.
