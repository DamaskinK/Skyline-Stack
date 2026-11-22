# 10: Time-of-day arc

**What to build:** the light moves with progress to the target (Endless: by floors, looping): sun direction and colour,
sky, fog, exposure, and window / street-light glow at dusk. Kosice gets its arc.

**Blocked by:** 06, 08

**Type:** feature
**Status:** done
**Read:** plan "Time-of-day arc".

- [x] Arc defined per level in data
- [x] Windows light up as dusk comes; bloom picks them up
- [x] Weather and arc combine (rain at dusk looks right)
- [x] Screenshots at start, middle, finish

## Comments
- Arc data in `js/levels.js` (`dayArc` hours + `grade` per city); pure maths in `js/core/dayarc.js` (tests in `tests/core/dayarc.test.js`). Kosice 16.5 -> 20.5 (sunset 19.5), Endless loops start -> end -> start every 60 floors.
- `js/world.js` turns the hour into sun, sky, fog, exposure and window glow; weather greys and darkens that base (rain at dusk = dark orange-grey). Sun light direction never drops below 0.24 elevation (moonlight after sunset), so the shadow frustum stays stable (flicker checks pass). `js/post.js` applies the level grade, a warm sunset tint and a mild night bloom boost. One line in `js/main.js` passes the day state to `updateWorld`.
- Seen: screenshots at hours 16.5/18.5/19.5/20.5, rain at 18 and 19.5, and a bot run at floors 2, 13, 19. Tuned bloom down after windows over-bloomed. Clouds got an emissive so dusk and rain do not make black blobs.
- Open: the other five cities' arcs and grades are first guesses (data only, not yet seen).
