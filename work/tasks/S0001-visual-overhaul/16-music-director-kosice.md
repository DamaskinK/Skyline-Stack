# 16: Music director, Kosice track and recorded sounds

**What to build:** music follows the screen: calm (quieter, gentle low-pass), perfect streak (full), danger (tension
layer, louder, when stability is under 30 %), drop-out on collapse or lost life, win sting at the target; crossfade
between tracks; menu track. Recorded CC0 sound effects replace the synth ones; the synth stays as a fallback.

**Blocked by:** 03, 08, 15

**Type:** feature
**Status:** done
**Read:** plan "Audio"; user stories 57-67.

- [x] Kosice track and menu track play from files loaded with the level
- [x] Each state audible in a scripted run; volume sliders and mute still work
- [x] A missing file falls back to synth without silence
- [ ] Safari plays the files (fallback format if needed)

## Comments
- Built `js/music.js` (director: menu, calm, streak, danger, dropout, win; gap-free looping by overlapping equal-power passes; menu <-> level crossfade;
  synthesised tension layer at the track's bpm and key; old chiptune kept as fallback), recorded SFX in `js/audio.js` with synth fallback, shared
  `assets/audio/manifest.json`, `music` entry in the Kosice manifest, `loadManifest` in `js/assets.js`. State and levels exposed as `window.__music` / `window.__sfx`.
- Collapse sound is built in code (Low Thud pitched down x2, sub-boom, noise with a falling filter, metal/glass pings). Developer must listen and approve it.
- `node tests/browser/audio-check.mjs` logged: menu > calm > streak > calm > danger > dropout > calm > streak > danger > win; music rms calm 0.011, streak 0.060,
  danger 0.059 (plus tension layer), dropout 0.007, win 0.045; mute gives output rms 0; blocked kosice.mp3 falls back to synth (rms 0.047).
  The check widens the Perfect window and adds lives in the page (the simple bot cannot hit 8 %); the director code is untouched by that.
- Open: Safari not tried (no Safari here). Kosice and menu are mp3. `berlin.ogg` stays ogg (no ffmpeg); convert before the Berlin level. Tempo/key of tracks are estimated by analysis, not by ear.
