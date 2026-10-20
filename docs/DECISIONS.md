# Decisions

- **Procedural modelling at runtime** (§6.2 option 2) instead of Blender GLBs: parametric outfit fitting
  needs runtime geometry anyway, zero download size, and iteration is verified with `/dev/turntable.html` screenshots.
- **React 19 / Three r186 / Vite 8** — latest stable at build time (spec said React 18; no API differences used).
- **Voices**: browser speechSynthesis + babble sounded unnatural, so lines are pre-rendered with MeloTTS-KR (MIT)
  and verified by Whisper (CER). Onomatopoeia the TTS mumbled ("삐약", "깨갱", "꺄앗") were rewritten into
  naturally pronounceable lines. Pitch shifts kept within ±4.5 semitones to avoid slurring.
- **Audio format**: OGG Vorbis + MP3 (no ffmpeg for AAC/m4a on the build machine; MP3 covers Safari).
- **UI style**: sticker style (ink outline, hard offset shadow, flat fills, SVG icon set) instead of glossy
  gradients / glassmorphism / emoji, per user feedback ("AI처럼 보이지 않게").
- **Guest soft-gate** (5 races) only applies when the API server is reachable, so offline play is never blocked.
