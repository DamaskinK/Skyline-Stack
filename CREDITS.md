# Credits

Every external file used by the game, with its source and licence. Add a row when an asset is added.

| Asset | Author | Source | Licence | Used for |
|-------|--------|--------|---------|----------|
| Three.js r160 and addons (loaders, post-processing) | three.js authors | https://threejs.org | MIT | rendering |
| HDRI "Kloofendal 48d Partly Cloudy (Pure Sky)", 1k | Greg Zaal, Jarod Guest (Poly Haven) | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 | Kosice sky light (`assets/levels/kosice/sky_1k.hdr`) |
| KayKit City Builder Bits 1.0: bench | Kay Lousberg | https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0 | CC0 | street props (`assets/kits/kaykit-city/`) |
| Unbounded (display font) | The Unbounded Project Authors | https://fonts.google.com/specimen/Unbounded | OFL 1.1 | UI headings, numbers, logo (loaded from Google Fonts) |
| Figtree (text font) | The Figtree Project Authors | https://fonts.google.com/specimen/Figtree | OFL 1.1 | UI text (loaded from Google Fonts) |
| Map data of central Kosice and of the five district plots (`assets/levels/kosice/plots/`): streets, building footprints, parks, water, tram lines and stops, car parks (c) OpenStreetMap contributors | OpenStreetMap contributors | https://www.openstreetmap.org/copyright, fetched with `scripts/build-osm-level.mjs` | ODbL 1.0 (attribution) | Kosice near ring (`assets/levels/kosice/osm.json`, generated) |
| KayKit City Builder Bits 1.0: streetlight, bush, car_sedan, car_hatchback | Kay Lousberg | https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0 | CC0 | Kosice near ring props (`assets/kits/kaykit-city/`) |
| Music "Calm Ambient 1 (Synthwave 4k)" | cynicmusic | https://opengameart.org/node/97098 | CC0 (author asks for credit, not required: "The Cynic Project / cynicmusic.com / pixelsphere.org") | menu track (`assets/audio/music/menu.mp3`) |
| Music "Folk Round" | Kevin MacLeod | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100357 | CC-BY 4.0 | Kosice track (`assets/audio/music/kosice.mp3`) |
| Music "Dvorak Polka" | Kevin MacLeod | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100249 | CC-BY 4.0 | Prague track (`prague.mp3`, not wired yet) |
| Music "Empacotatron" | Fupi | https://opengameart.org/node/180427 | CC0 | Newtown track (`assets/audio/music/newtown.mp3`, the OGG original mixed down to MP3 for Safari) |
| Music "Neon Laser Horizon" | Kevin MacLeod | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN2000023 | CC-BY 4.0 | Tokyo track (`tokyo.mp3`, not wired yet) |
| Sound "Little Whoosh 2" | ch_ase | https://freesound.org/people/ch_ase/sounds/423799/ | CC0 | block drop (`assets/audio/sfx/drop.mp3`) |
| Sound "Low Thud" | Qvantor | https://freesound.org/people/Qvantor/sounds/879272/ | CC0 | landing and the collapse layers (`land.mp3`) |
| Sound "peal of thunder - distant" | bastipictures | https://freesound.org/people/bastipictures/sounds/243782/ | CC0 | thunder (`thunder.mp3`) |
| Sound "Wind through trees (loop)" | NomadApe | https://freesound.org/people/NomadApe/sounds/444921/ | CC0 | wind loop (`wind-loop.mp3`) |
| Sound "Rain Loop 2" | richwise | https://freesound.org/people/richwise/sounds/584944/ | CC0 | rain loop (`rain-loop.mp3`) |
| Sound "City Ambiance (New York)" | knufds | https://freesound.org/people/knufds/sounds/345948/ | CC-BY 4.0 | city ambience in clear weather (`city-loop.mp3`) |
| Texture "Asphalt 02" (normal and roughness maps, 1k resized to 512) | Poly Haven authors | https://polyhaven.com/a/asphalt_02 | CC0 | Kosice roads (`assets/textures/`) |
| Texture "Cobblestone Floor 02" (normal and roughness maps, 1k resized to 512) | Poly Haven authors | https://polyhaven.com/a/cobblestone_floor_02 | CC0 | Kosice paving and plaza (`assets/textures/`) |
| Texture "White Plaster Rough 01" (normal and roughness maps, 1k resized to 512) | Poly Haven authors | https://polyhaven.com/a/white_plaster_rough_01 | CC0 | Kosice house walls (`assets/textures/`) |
| Texture "Roof Tiles 14" (normal and roughness maps, 1k resized to 512) | Poly Haven authors | https://polyhaven.com/a/roof_tiles_14 | CC0 | Kosice pitched roofs (`assets/textures/`) |
| Texture "Sandstone Blocks 08" (normal and roughness maps, 1k resized to 512) | Poly Haven authors | https://polyhaven.com/a/sandstone_blocks_08 | CC0 | St Elisabeth cathedral stone (`assets/textures/`) |
| Draco decoder (`draco_decoder.wasm/.js`, wrapper) and `DRACOLoader`, from three@0.160.0 `examples/jsm` | Google, three.js authors | https://github.com/google/draco, vendored by `scripts/vendor-addons.mjs` | Apache-2.0 (decoder), MIT (loader) | decoding Draco-compressed GLB models (`vendor/draco/`) |
| St. Elisabeth Cathedral model (own work, built by `scripts/blender/cathedral.py`) | project | n/a | project | `assets/levels/kosice/cathedral.glb` |
| State Theatre, St. Urban's tower, St. Michael's chapel, Immaculata column and Singing Fountain models (own work, built by `scripts/blender/{theatre,urban,chapel,monuments}.py`; shapes modelled after photos on Wikimedia Commons that are not part of the repo, cited in the S0004 01 ticket) | project | n/a | project | `assets/levels/kosice/{theatre,urban,chapel,immaculata,fountain}.glb` |
| Kosice house kit: old-town, panel-block and in-between modules (own work, built by `scripts/blender/housekit.py`; shapes modelled after Wikimedia Commons photos that are not part of the repo, cited in the S0004 02 ticket) | project | n/a | project | `assets/levels/kosice/housekit.glb` |
| Cathedral stone, roof-tile and chapel/tower tile textures (procedural, written by `scripts/blender/pipeline.py`, baked into the GLBs) | project | n/a | project | inside `assets/levels/kosice/*.glb` |

## Credit lines to show on the credits screen (CC-BY 4.0)

Exact text required by the authors. Show all of them in the game's credits screen.

```
"Folk Round" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/

"Dvorak Polka" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/

"Neon Laser Horizon" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/

"City Ambiance (New York)" by knufds, https://freesound.org/s/345948, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
```

The menu track asks for an optional credit: The Cynic Project / cynicmusic.com / pixelsphere.org (CC0, not required).
UI clicks stay synthesised in code (no Kenney files were downloaded). The collapse sound is built in code from Low Thud plus synthesis.
