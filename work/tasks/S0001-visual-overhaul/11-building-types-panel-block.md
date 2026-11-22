# 11: Building types and the Kosice panel block

**What to build:** building types are data: facade style, floor mesh variant and one trait as multipliers the core
understands (perfect window, mass, roof friction, wind, night visibility). Kosice builds a panel block (plain, tutorial).
Special blocks still stack on top. The HUD and how-to-play explain the current type's trait.

**Blocked by:** 07, 08

**Type:** feature
**Status:** done
**Read:** plan "Building types"; `GLOSSARY.md` Building type, Special block.

- [x] Core tests: each multiplier changes the outcome it should, the plain type changes nothing
- [x] Panel block facade on tall floors
- [x] All six types defined as data (traits), only the panel block with its final facade

## Comments
- `js/building-types.js`: six types as data (panel, hotel, office, glass, deco, neon), each with facade, variant, hint and a trait of multipliers perfect / mass / slide / wind (+ `nightVisibility` render hint). `Run` folds the trait into the difficulty (`applyTrait`); `Run` takes `buildingType` (overrides the level's, for Endless in ticket 20).
- Numbers (first guess, tune later): hotel perfect x0.65, office mass x1.5, glass slide x1.6, deco wind x1.5, neon nightVisibility 0.25 (not used by the core yet; Tokyo rendering reads it).
- Panel facade in `js/textures.js` (`panelFacade`): concrete panels, joints, windows, coloured loggia band. Used for normal blocks only; special blocks keep their coloured default facade.
- HUD: type label under NEXT, hint shown in the first 6 drops; help screen has a BUILDING TYPES list. Tests: 44 pass (10 new). Check: PASS, screenshot kosice-high-mid.png shows the panel floors.
