# 37: Rich stylised look for Kosice

**What to build:** Kosice stops looking flat and primitive while staying stylised (developer's choice at the ticket 17
playtest, 2026-11-22: "rich stylised", not semi-realistic PBR). It becomes the art bar for the other cities.

**Blocked by:** 34, 35

**Type:** improve
**Status:** claimed
**Now:** smooth single-colour walls, windows only painted in a texture, single-colour ground, simple trees, flat light.

- [ ] Facades with real depth on the near-ring houses and the panel-block floors: cornices, window frames/sills and
      recesses as geometry (instanced or merged), plinths, roof eaves; pastel plaster colours with slight variation.
- [ ] Surfaces with relief: CC0 normal/roughness maps (ambientCG or Poly Haven) for cobblestone paving, asphalt,
      plaster, roof tiles, stone of the cathedral; tiled at a stylised scale, colours kept from the palette.
- [ ] Richer vegetation: fuller trees (several canopy lumps, colour variation, slight wind sway), hedges, flower beds.
- [ ] Sky and light: soft stylised clouds with volume (sprites or low-poly puffs lit by the sun), warmer and more
      contrasted sunlight with coloured shadows, stronger contact shadows on High.
- [ ] Budget kept: ticket 35's High target at 2560x1440 DPR 2, Low phone-friendly; all new assets in CREDITS.md.
- [ ] Before/after screenshots from the default camera at the start and at floor 8; developer approves (ready-for-human).
