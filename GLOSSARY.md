# Glossary

The project's own words. Use them as defined here in code, docs, plans and tickets. Vocabulary only.

**Floor**: one block the crane drops and the player stacks. Size `W x H x D`. _Avoid_: storey, piece.

**Tower**: the stack of floors the player builds in one run, on a **foundation** (lobby).

**Level**: one city with one tower to build to a **target height**, its own scene, weather, time-of-day arc, building
type and track. There are six, ordered by city size. _Avoid_: stage, map.

**Target height**: the number of floors that completes a level.

**Star**: a level rating. 1 = target reached, 2 = at most one life lost, 3 = at least 50 % perfect landings.

**Landing**: how a floor lands: **perfect**, **good**, **risky**, or it **slips** off (a life is lost).

**Building type**: the kind of tower a level builds (panel block, hotel, office, glass skyscraper, art deco, neon tower):
a facade plus one gameplay trait. _Avoid_: building class.

**Special block**: a floor with its own physics (heavy, light, bouncy, golden), independent of the building type.

**Ring**: one depth band of a level's scene. **Near ring**: the real street grid around the build site from
OpenStreetMap. **Middle ring**: the city's typical buildings. **Far ring**: horizon relief and landmarks.

**Landmark**: a real, recognisable structure of the city, drawn in the far ring at its real bearing.

**Weather**: the sky and air conditions of a part of a level (clear, rain, snow, fog, storm, heat haze, sandstorm,
typhoon). It changes friction, wind and visibility.

**Event**: a timed hit on the tower: lightning, earthquake, sandstorm gust. Each city has only its real ones.

**Time-of-day arc**: how the light of a level moves from start to target height (for example noon to sunset).

**Tension layer**: the extra music layer that fades in when the tower is close to falling.

**Endless**: the mode without a target height, on any opened city.
