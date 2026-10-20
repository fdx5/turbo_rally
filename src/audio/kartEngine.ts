import { audio } from './engine';
import type { EngineClass } from '../data/vehicles';
import { noise } from './synth';

const PRESET: Record<EngineClass, { base: number; range: number; putt: number; wave: OscillatorType; cutoff: number; vol: number }> = {
  small: { base: 82, range: 150, putt: 26, wave: 'square', cutoff: 1500, vol: 0.13 }, // "부릉 뽀롱"
  medium: { base: 62, range: 120, putt: 20, wave: 'sawtooth', cutoff: 1200, vol: 0.13 },
  large: { base: 44, range: 85, putt: 14, wave: 'sawtooth', cutoff: 900, vol: 0.15 }, // "부우웅"
};

/** Speed-pitched toy engine: 2 oscillators + putt-putt tremolo + low-pass, panned (§9.3). */
export class EngineVoice {
  private o1: OscillatorNode;
  private o2: OscillatorNode;
  private trem: OscillatorNode;
  private tremG: GainNode;
  private lp: BiquadFilterNode;
  private g: GainNode;
  private pan: StereoPannerNode;
  private drift: GainNode;
  private driftSrc: AudioBufferSourceNode;
  private p: (typeof PRESET)[EngineClass];
  alive = true;
  constructor(cls: EngineClass) {
    const ctx = audio.ensure();
    this.p = PRESET[cls];
    this.g = ctx.createGain();
    this.g.gain.value = 0;
    this.pan = ctx.createStereoPanner();
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = this.p.cutoff;
    this.lp.Q.value = 2;
    const am = ctx.createGain();
    am.gain.value = 0.6;
    this.tremG = ctx.createGain();
    this.tremG.gain.value = 0.4;
    this.trem = ctx.createOscillator();
    this.trem.frequency.value = this.p.putt;
    this.trem.connect(this.tremG).connect(am.gain);
    this.o1 = ctx.createOscillator();
    this.o1.type = this.p.wave;
    this.o2 = ctx.createOscillator();
    this.o2.type = 'triangle';
    this.o1.connect(am);
    this.o2.connect(am);
    am.connect(this.lp).connect(this.g).connect(this.pan).connect(audio.sfx);
    // tyre / drift squeak bed
    this.drift = ctx.createGain();
    this.drift.gain.value = 0;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2300;
    bp.Q.value = 10;
    this.driftSrc = ctx.createBufferSource();
    this.driftSrc.buffer = noise(ctx);
    this.driftSrc.loop = true;
    this.driftSrc.connect(bp).connect(this.drift).connect(this.pan);
    const t = ctx.currentTime;
    for (const o of [this.o1, this.o2, this.trem]) o.start(t);
    this.driftSrc.start(t);
  }
  update(speed01: number, throttle: number, vol: number, pan: number, drifting: boolean, boost: boolean) {
    const ctx = audio.ctx;
    if (!ctx || !this.alive) return;
    const t = ctx.currentTime;
    const f = this.p.base + this.p.range * Math.min(1.25, speed01) + (boost ? 25 : 0);
    this.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.trem.frequency.setTargetAtTime(this.p.putt * (0.6 + speed01 * 1.2), t, 0.08);
    this.lp.frequency.setTargetAtTime(this.p.cutoff * (0.7 + throttle * 0.5 + speed01 * 0.6), t, 0.08);
    this.g.gain.setTargetAtTime(this.p.vol * vol * (0.55 + 0.45 * throttle), t, 0.06);
    this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05);
    this.drift.gain.setTargetAtTime(drifting ? 0.05 * vol : 0, t, 0.05);
  }
  dispose() {
    this.alive = false;
    const ctx = audio.ctx;
    if (!ctx) return;
    this.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => {
      for (const o of [this.o1, this.o2, this.trem]) o.stop();
      this.driftSrc.stop();
      this.pan.disconnect();
    }, 400);
  }
}
