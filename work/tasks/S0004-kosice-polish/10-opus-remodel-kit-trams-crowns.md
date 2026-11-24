# 10: Opus remodel pass: house kit, trams, tower floors and crowns

**What to build:** the Blender kit and other models re-made by Opus: old-town and estate house modules (S0004 02/07,
re-bake the far facades), the Kosice tram (today box geometry, S0004 03) as a Blender model of the DPMK Vario LF2+,
the panel-block tower floor and its crown and lobby (S0001 39).

**Blocked by:** 09

**Type:** improve
**Status:** ready-for-agent
**Model:** opus (skyline-modeler)

- [ ] Modules, tram, floor, crown and lobby compared with real photos; clearly richer and more accurate than before.
- [ ] Far facades re-baked from the new modules; no jump at the near/far switch.
- [ ] Perf, audit, flicker pass; before/after screenshots from the game camera on every plot.

## Notes from the main session (verification screenshots of S0004 08, /private/tmp/claude-501/verify08/)
- Tram: the overhead wire renders as broken dashes from the side (1 px lines alias) - draw it as thin geometry with a
  minimum screen width; the pantograph is two long diagonal rods to a T head far above the roof - model a real
  single-arm pantograph seated on the roof, its head touching the wire; windows are flat dark - show the interior
  (seats, handrails, lit at night).
- Old-town kit: small white speckle patches on the plaster next to pilasters (house-near-40m.png, green house) - find
  and remove the stray geometry or texture noise.
- The far-facade check pose was blocked by a tree: verify the near/far switch from a clear viewpoint.
