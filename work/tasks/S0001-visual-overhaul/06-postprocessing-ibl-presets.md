# 06: Post-processing, image-based light and quality presets

**What to build:** the scene is lit by a CC0 HDRI environment (the visible sky stays the stylised dome), with bloom,
ambient occlusion (GTAO), a colour-grading pass and the output pass. Low / Medium / High switch pixel ratio, shadow size,
AO, bloom and prop density.

**Blocked by:** 03, 04

**Type:** feature
**Status:** ready-for-agent
**Read:** plan "Rendering", "Quality presets".

- [ ] Glowing windows and lights bloom at night (Storm phase in the current game)
- [ ] AO visible where buildings meet the ground on High; off on Low
- [ ] Grading can be set per level (one default for now)
- [ ] Perf check: High at 60 fps on the developer's Mac; Low smooth at phone size
- [ ] HDRI credited
