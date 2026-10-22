import { Rng } from '../core/rng';
import type { SongDef } from './music';
import type { Ctx } from './synth';

export interface MusicMix {
  drums: GainNode;
  bass: GainNode;
  chords: GainNode;
  lead: GainNode;
  answer: GainNode;
  pad: GainNode;
  dispose(): void;
}

/** The same stereo mix is used by the game and offline auditions. No looping sources. */
export function createMusicMix(ctx: Ctx, song: SongDef, out: AudioNode): MusicMix {
  const nodes: AudioNode[] = [];
  const keep = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  const sum = keep(ctx.createGain());
  sum.gain.value = 0.8;
  const glue = keep(ctx.createDynamicsCompressor());
  glue.threshold.value = -12;
  glue.knee.value = 12;
  glue.ratio.value = 2.5;
  glue.attack.value = 0.015;
  glue.release.value = 0.18;
  sum.connect(glue).connect(out);

  const space = song.space ?? 0.2;
  const reverb = keep(ctx.createConvolver());
  const seconds = 0.65 + space * 1.7;
  const impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const rng = new Rng(song.seed + ':room');
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < data.length; i++) {
      smooth = smooth * 0.55 + rng.range(-1, 1) * 0.45;
      data[i] = smooth * Math.exp((-7 * i) / data.length);
    }
  }
  reverb.buffer = impulse;
  const wet = keep(ctx.createGain());
  wet.gain.value = 0.16 + space * 0.4;
  reverb.connect(wet).connect(sum);
  const echoInput = keep(ctx.createBiquadFilter());
  echoInput.type = 'lowpass';
  echoInput.frequency.value = 2800;
  for (const [beats, pan, level] of [
    [0.75, 0.5, 0.08],
    [1.5, -0.5, 0.035],
  ]) {
    const delay = keep(ctx.createDelay(2));
    delay.delayTime.value = (beats * 60) / song.bpm;
    const gain = keep(ctx.createGain());
    gain.gain.value = level * (1 + space);
    const panner = keep(ctx.createStereoPanner());
    panner.pan.value = pan;
    echoInput.connect(delay).connect(gain).connect(panner).connect(sum);
  }
  const channel = (gain: number, pan: number, send = false) => {
    const input = keep(ctx.createGain());
    input.gain.value = gain;
    const stereo = keep(ctx.createStereoPanner());
    stereo.pan.value = pan;
    input.connect(stereo).connect(sum);
    if (send) {
      stereo.connect(reverb);
      stereo.connect(echoInput);
    }
    return input;
  };
  return {
    drums: channel(0.68, 0),
    bass: channel(0.56, 0),
    chords: channel(0.48, -0.28, true),
    lead: channel(0.85, -0.06, true),
    answer: channel(0.48, 0.34, true),
    pad: channel(0.4, 0.16, true),
    dispose: () => nodes.forEach((node) => node.disconnect()),
  };
}
