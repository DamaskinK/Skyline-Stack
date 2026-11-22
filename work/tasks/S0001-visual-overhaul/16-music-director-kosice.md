# 16: Music director, Kosice track and recorded sounds

**What to build:** music follows the screen: calm (quieter, gentle low-pass), perfect streak (full), danger (tension
layer, louder, when stability is under 30 %), drop-out on collapse or lost life, win sting at the target; crossfade
between tracks; menu track. Recorded CC0 sound effects replace the synth ones; the synth stays as a fallback.

**Blocked by:** 03, 08, 15

**Type:** feature
**Status:** ready-for-agent
**Read:** plan "Audio"; user stories 57-67.

- [ ] Kosice track and menu track play from files loaded with the level
- [ ] Each state audible in a scripted run; volume sliders and mute still work
- [ ] A missing file falls back to synth without silence
- [ ] Safari plays the files (fallback format if needed)
