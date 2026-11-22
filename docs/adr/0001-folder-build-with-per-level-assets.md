# 0001: Folder build with per-level assets instead of one HTML file

**Status:** accepted, 2026-11-22

## Context
The game used to ship as one self-contained HTML file (`dist/tower-bloxx-3d.html`) with every texture drawn in code.
The visual overhaul adds GLB models, PBR textures, HDRIs and music tracks: tens of megabytes across six levels.

## Decision
Ship a static folder (`dist/`) with an asset folder per level, loaded on demand behind a loading screen. The one-file
build and `dist/artifact.html` are dropped.

## Consequences
- The game needs a web server (local `npm run serve` or static hosting such as GitHub Pages); double-click no longer works.
- Budget: about 15 MB per level.
- Procedural textures can stay where they look good enough, to save size.
