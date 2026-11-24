# Agents and models: who does what, at what cost

Copied from the Alium repo. Spend the expensive model where judgement matters and the cheap ones everywhere else.
Agents live in `.claude/agents/`; each sets its own model.

| Work | Agent | Model | Why |
|------|-------|-------|-----|
| Find code, list callers, summarise a large file | `skyline-scout` | haiku | read-only, short answers keep big files out of the main session |
| Run tests and browser checks, download listed assets, fill data | `skyline-runner` | haiku | a recipe, no decisions |
| Build a ticket: code, tests, checks, commit | `skyline-builder` | sonnet | the bulk of the work |
| Make or improve 3D models in Blender (landmarks, house kit, trams, crowns, baked facades) | `skyline-modeler` | opus | models are what everything is built on (developer, 2026-11-24) |
| Review a milestone's commits | `skyline-reviewer` | opus | catches what the builder missed; reads only the diff |
| Talk to the developer, grilling, plan, tickets, ideas, choosing what is next | main session | opus | keeps the thread, stays thin |

Run a builder at opus only when the ticket says `**Model:** opus (reason)` or a sonnet builder stopped after two failed attempts.

## Rules that save the most
1. **The main session does not build.** It reads ticket files and short reports, not code.
2. **One ticket, one fresh builder.** The ticket must stand on its own: what to build, acceptance criteria, which plan sections to read.
3. **Sequential by default.** Parallel builders only for tickets that touch different files.
4. **Review at review points** (end of M1, M2, ...), not per ticket. Findings go to a builder as a fix.
5. **Short reports**, at most 15 lines, no code.
6. **Stop rather than guess.** A builder with an open question reports it; the main session asks the developer.
