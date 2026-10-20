# TURBO RALLY — Asset Credits & Licenses

## 3D models / textures
All vehicles, characters, cosmetics, props, tracks and textures are generated procedurally in code
(`src/art`, `src/vehicles`, `src/characters`, `src/tracks`). No third-party model or texture files.
Brand marks are vector re-drawings in `src/vehicles/decals.ts`; switch `VITE_BRAND_MODE=parody` to use parody marks.

## Fonts (Google Fonts, SIL Open Font License 1.1)
- Black Han Sans — Zess Type
- Jua — Woowahan Brothers
- Do Hyeon — Woowahan Brothers
- Fredoka — Milena Brandão

## Music & SFX
All BGM (13 songs, `src/audio/music.ts`) and sound effects (`src/audio/sfx.ts`) are synthesized at
runtime with the Web Audio API from original code. No samples → no third-party license.

## Character voices (`public/audio/voice/**`)
- Generated with **MeloTTS (Korean model)** by MyShell.ai — MIT License
  (https://github.com/myshell-ai/MeloTTS, model `myshell-ai/MeloTTS-Korean`, BERT `kykim/bert-kor-base`).
- Per-character pitch/formant shaping with **Praat** via `praat-parselmouth` (GPL-3.0 tool; output audio is not a derivative licensed work).
- Pronunciation QA with **faster-whisper / Whisper large-v3** (MIT) — every clip is transcribed back and must match the script.
- Script & profiles: `tools/audio/voicegen.py`, verification log: `public/audio/voice/manifest.json`.
