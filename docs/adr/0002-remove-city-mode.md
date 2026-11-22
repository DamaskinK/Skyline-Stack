# 0002: Remove City mode, progression comes from six city levels

**Status:** accepted, 2026-11-22

## Context
City mode (fill a 3x3 block with four building types that need certain neighbours) closely follows the rules of an
existing commercial game. The project must be original, and the main mode had no progression.

## Decision
Remove City mode. Progression is six levels, one tower per real city, each with its own building type. Endless stays.

## Consequences
- `plots`, `BUILDINGS`, the city picker screen and the city high-score tab go.
- Saved City scores in localStorage are ignored.
- A district-building idea may come back later, but only as a new, original mechanic.
