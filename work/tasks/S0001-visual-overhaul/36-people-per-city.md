# 36: More detailed people, dressed for each city

**What to build:** the pedestrians, the crowd on the square and the residents flying into floors are more detailed
low-poly figures whose clothes fit the city and its culture.

**Blocked by:** None (can start immediately).

**Type:** change
**Status:** done
**Now:** people are simple capsules with a head and an umbrella (js/fx.js People), the same in every city.

- [x] A shared figure: head with hair, torso, arms and legs that swing when walking, simple hands and shoes; 150-400
      triangles; instanced or merged so 30-80 people cost few draw calls.
- [x] Clothing styles as data per city (colours, garments, accessories), respectful and everyday, mostly modern:
      Kosice and Prague: central-European everyday wear, some coats and scarves, a few people in folk-costume details
      on the square (embroidered vest, scarf); Berlin: urban casual and business; Dubai: mix of modern wear and
      traditional dress (kandura with ghutra, abaya); New York: business, street wear; Tokyo: business suits, school
      uniforms, street fashion. Only Kosice must be finished now; others as data.
- [x] Weather props stay (umbrellas in rain, warmer clothes in snow).
- [x] Screenshots close to the square on High; draw calls not higher than before.

## Comments
- New `js/people/styles.js` (clothing data per city: kosice, prague, berlin, dubai, new-york, tokyo; all six filled) and
  `js/people/figure.js` (merged vertex-coloured figure, 300-440 triangles, limb swing in the vertex shader: still one draw
  call per person, same as before; umbrella stays a hidden group unless raining or flying).
- Kosice has folk touches (embroidered vest, kerchief scarf) and a few children; Dubai kandura + ghutra, abaya + hijab.
- API kept: `People.setWalkers/arrive/update/clear/setRoutes`; added `People.setCity(id)` (called in `applyLevelAssets` in
  js/level-scene.js, one line). Walkers get new outfits on city change and when snow starts (coats, scarves, beanies).
- Checked: close-up lineups per city/weather (Kosice, Dubai, Tokyo with umbrellas), `check.mjs all` high PASS (598 draw
  calls, 60 fps), low shots PASS, npm test 48 passed. Snow re-dressing was not seen on screen (menu has no snow; run weather
  is overwritten each frame in my test); logic is a small pure function `dressForCold`.
