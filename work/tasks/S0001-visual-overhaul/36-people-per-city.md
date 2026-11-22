# 36: More detailed people, dressed for each city

**What to build:** the pedestrians, the crowd on the square and the residents flying into floors are more detailed
low-poly figures whose clothes fit the city and its culture.

**Blocked by:** None (can start immediately).

**Type:** change
**Status:** claimed
**Now:** people are simple capsules with a head and an umbrella (js/fx.js People), the same in every city.

- [ ] A shared figure: head with hair, torso, arms and legs that swing when walking, simple hands and shoes; 150-400
      triangles; instanced or merged so 30-80 people cost few draw calls.
- [ ] Clothing styles as data per city (colours, garments, accessories), respectful and everyday, mostly modern:
      Kosice and Prague: central-European everyday wear, some coats and scarves, a few people in folk-costume details
      on the square (embroidered vest, scarf); Berlin: urban casual and business; Dubai: mix of modern wear and
      traditional dress (kandura with ghutra, abaya); New York: business, street wear; Tokyo: business suits, school
      uniforms, street fashion. Only Kosice must be finished now; others as data.
- [ ] Weather props stay (umbrellas in rain, warmer clothes in snow).
- [ ] Screenshots close to the square on High; draw calls not higher than before.
