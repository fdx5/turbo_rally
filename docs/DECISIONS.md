# Decisions

- **Road sightline curtains and expedition soundtrack (2026-10-22):** elevated branch
  skirts previously extended down to terrain, making giant shoulder-coloured walls
  across lower roads (reproduced at the forest start). All deck skirts now stop within
  1.6 m of the road; pieces intersecting another route's vehicle envelope are omitted.
  `tools/qa/road-visibility-review.mjs` checks all 16 start cameras and 48,696 lane/lens
  rays across main roads and branches: no blocking skirts.
  All sixteen landscapes now have individually written two-bar musical hooks, AABA
  development, biome-specific instruments and stereo room/delay mixes. The previous
  soundtrack had no t9–t16 entries, and t4/t5 still used retired biome music.
  New flute, harp, kalimba, steelpan and oud voices complement the existing instruments;
  the last-lap tempo lift remains. Leaving a race cancels delayed result music.
  `tools/qa/music-review.mjs` renders the actual sequencer through its loop seam and
  writes stereo WAV auditions plus clipping/silence checks; `/dev/audio-review.html`
  exposes every theme for audition. Validation: `npm run check` (122 tests),
  `npm run check:secrets`, sixteen live audio-bus checks, and both browser QA scripts.

- **Sixteen expeditions and stunt clarification (2026-10-22):** keep the original eight
  identities and add forest, desert oasis, Antarctic base, coral sea bridges, clockwork
  factory, red canyon, abyssal tunnels and moonlit bamboo. All 16 courses have sharp
  bends, steep grades and marked road-gap jumps; 33 optional branches remain selectable.
  Magnetic loop roads and the literal 180-degree hairpin presentation were removed
  following clarification. The 360-degree feature is now an airborne, player-triggered
  spin (Space / drift), completed before ordinary wheel contact resumes.
  Kart contact separates lanes without transferring momentum, refreshing squash, or
  repeating collision sound. Swept road-triangle checks block underside penetration.
  Shared branch mouths stay coplanar until the roads separate; tunnel apertures and
  bridge supports preserve vehicle clearance on the other routes.
  Pads grant 1 second; sugar boosts grant 2 seconds per charge, three charges accumulate
  6 seconds, and item time pauses while movement is disabled. Replay v3 records full
  orientation, road coordinates, contact state and actual timestamps; grounded playback
  samples the road. Ghosts from retired layouts are hidden without deleting records.
  Validation: `npm run check`, `npm run check:secrets`, 16-course browser driving and
  `tools/qa/adventure-features.mjs` scenery / air-spin / booster audio checks.

- **Adventure course rebuild (2026-10-22):** all eight layouts now use rounded 3D routes,
  60–110 m elevation ranges, 17 optional branches, suspension bridges, marked gaps and
  exploration caverns. Cavern/volcano themes and glacier/ruins scenery have separate materials.
  Three circuits originally contained inverted magnetic loops (retired as noted above). Loop progress used physical arc length;
  the vehicle, chase camera and mirror use the same full road frame. Normal hills maintain
  contact; explicit ramp lips, gaps and player hops launch the kart.
  Boost pads use a subdivided road-conforming mesh and static high-contrast chevrons,
  avoiding bank clipping and a scrolling border. Turbo audio combines ignition, pentatonic
  ascent and filtered wind, with a separate quiet wind bed while boost remains active.
  `tools/qa/adventure-features.mjs` captures feature views and renders three booster WAVs
  with peak/RMS checks; driving regression covers every fork and all 20 vehicles on t8.

- **Track contact / readability (2026-10-22):** interpolate bank and width for contact queries,
  fit vehicle pitch/roll to the road plane, update wheel-instance ancestors before drawing,
  and reject contact through road undersides. Terrain triangles are capped below banked
  shoulders; tapered verges and sampled terrain heights keep the road and props grounded.
  Longer shortcut overlaps remove folded edges, and rainbow launch ramps now meet the gaps.
  Darker theme asphalt and separate edge ribbons improve route contrast and clean up joins.
  Validation: `npm run check`; `node tools/qa/serve.mjs` then
  `node tools/qa/track-review.mjs http://127.0.0.1:5193 test-results/track-review/final t1,t2,t3,t4,t5,t6,t7,t8 --drive`.

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
