# 03: Folder build, asset loader and loading screen

**What to build:** `npm run build` produces a static `dist/` folder with code and asset folders. Each level has an asset
manifest; a loader fetches it with progress shown on a loading screen. The Three.js r160 addons the plan needs (GLTF
loader, RGBE/EXR loader, post-processing passes) are vendored. ADR 0001.

**Blocked by:** None (can start immediately).

**Type:** feature
**Status:** done
**Read:** plan "Assets and build"; `docs/adr/0001-folder-build-with-per-level-assets.md`.

- [x] Single-file outputs removed; `dist/` runs with `npm run serve` style static hosting
- [x] A manifest for a test level with one CC0 HDRI and one CC0 GLB loads with a visible progress bar
- [x] A failed asset shows a readable error and the game falls back where a fallback exists
- [x] README run instructions updated; CREDITS has the test assets
