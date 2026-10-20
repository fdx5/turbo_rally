import { audio } from './engine';
import { useSettings } from '../core/settings';
import type { CharId, VoiceLine } from '../data/characters';

/**
 * Character voices (§9.4). Lines are pre-rendered offline with a Korean neural TTS
 * (tools/audio/voicegen.py: MeloTTS-KR → per-character pitch/formant profile → Whisper-verified),
 * shipped as /audio/voice/{char}/{line}.mp3|ogg and played through the voice bus with BGM ducking.
 */
const cache = new Map<string, Promise<AudioBuffer | null>>();
const ext = (() => {
  const a = document.createElement('audio');
  return a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
})();

function load(charId: CharId, line: VoiceLine): Promise<AudioBuffer | null> {
  const key = `${charId}/${line}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      try {
        const ctx = audio.ensure();
        const res = await fetch(`/audio/voice/${key}.${ext}`);
        if (!res.ok) return null;
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        return null;
      }
    })();
    cache.set(key, p);
  }
  return p;
}
/** Warm the clips a race will need so the first "아야!" isn't late. */
export function preloadVoices(chars: CharId[], lines: VoiceLine[] = ['start', 'boost', 'hitOther', 'ouch', 'overtake', 'overtaken', 'win', 'lose', 'skill']) {
  for (const c of chars) for (const l of lines) load(c, l);
}

let current: { src: AudioBufferSourceNode; char: CharId } | null = null;
export function say(charId: CharId, line: VoiceLine, opts: { vol?: number; pan?: number; tts?: boolean } = {}) {
  const ctx = audio.ctx;
  if (!ctx || useSettings.getState().voice < 0.01) return;
  load(charId, line).then((buf) => {
    if (!buf || !audio.ctx) return;
    // one voice at a time per character; a new line from the player cuts the previous one
    if (current && current.char === charId) {
      try {
        current.src.stop();
      } catch {
        /* already done */
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = opts.vol ?? 1;
    let node: AudioNode = g;
    if (opts.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = opts.pan;
      g.connect(p);
      node = p;
    }
    src.connect(g);
    node.connect(audio.voice);
    src.start();
    current = { src, char: charId };
    audio.duck(buf.duration + 0.15);
  });
}
