# Status

| ID | Topic | Type | State |
|----|-------|------|-------|
| S0001 | Visual overhaul (now three cities: Kosice, Prague, Tokyo + Newtown, ADR 0004) | improve | Kosice built and reviewed (01-16, 32-40); 37 and 17 wait for the developer; Prague/Tokyo (21, 22, 29, 30), 18-20, 31 open |
| S0002 | District mode and Newtown | feature | built incl. review fixes (09) and playtest fixes (10); 08 developer playtest |

## Next
- Developer: play the Kosice district and Newtown (S0002 08), approve the Kosice look (S0001 37, 17) and the Blender
  cathedral (40: roof colours, stone sharpness).
- Then: S0001 18 (rename, UI system), 20 (world map), Prague and Tokyo with districts and Blender landmarks.

## Known issues
- Kosice texture count creeps slightly per plot reload (not from S0002 09).
- Newtown with all five towers: ~760 draw calls on High (target ~700).
| S0003 | Code base in TypeScript | improve | done (01-05): all of js/ is strict TypeScript |
