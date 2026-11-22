# 07: Tall floors (H 2.8) and retune

**What to build:** a floor is `W 4 x H 2.8 x D 4` and reads as a real storey (windows, slab line). Drop gap, rope length,
crane, camera offsets, sway mode shape and collapse thresholds are retuned so the game feels as fair as before.

**Blocked by:** 02

**Type:** improve
**Status:** done
**Read:** plan "Floor size"; `GLOSSARY.md` Floor.

- [x] Core tests updated for the new height and green
- [x] The block in hand, the target roof and the wind arrow are all visible from every camera mode
- [ ] Ten floors in a row are reachable on Normal without unfair collapses (developer plays and agrees)
- [x] Final numbers recorded in the plan under "Changes after build"

## Comments
- Built: H 2.8, ropeLen 17, dropGap kept at 3.5 (balance identical to before: a bot probe gives the same floors and collapses on Easy/Normal/Hard as at H 1.6), camera offsets and target raised, facade canvas given the floor's aspect, menu demo tower cut to 10 floors. Numbers are in the plan under "Changes after build".
- Checked: `npm test` 11 green (two new: floor height, Normal bot reaches 10 floors); `check.mjs all --quality high` and `shots --quality low` pass; screenshots of all three camera modes show the block in hand, the target roof and the wind arrow.
- Open: the box "Ten floors in a row are reachable on Normal without unfair collapses" stays unticked. A crude bot reaches 10+ floors on Normal (best 13-20) but still loses floors to collapses after risky drops, exactly as before the change. The developer has to play it.
