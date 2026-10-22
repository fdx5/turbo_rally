/**
 * Small synth toolkit shared by realtime music and offline SFX rendering.
 * Everything is built from Web Audio primitives: no external samples, CC0-clean by construction.
 */
export type Ctx = BaseAudioContext;

let noiseBuf: AudioBuffer | null = null;
/** AudioBuffers are context-independent, so one shared white-noise buffer serves every context. */
export function noise(ctx: Ctx): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  noiseBuf = b;
  return b;
}
export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface Env {
  a: number;
  d: number;
  s: number;
  r: number;
  peak?: number;
}
export function envGain(ctx: Ctx, t: number, dur: number, e: Env, out: AudioNode): GainNode {
  const g = ctx.createGain();
  const p = e.peak ?? 1;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(p, t + e.a);
  g.gain.setTargetAtTime(p * e.s, t + e.a, Math.max(0.005, e.d / 3));
  const rel = t + Math.max(dur, e.a + 0.005);
  g.gain.setValueAtTime(p * e.s, rel);
  g.gain.setTargetAtTime(0.0001, rel, Math.max(0.005, e.r / 4));
  g.connect(out);
  return g;
}

export function osc(ctx: Ctx, type: OscillatorType, f: number, t: number, stop: number, out: AudioNode, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  o.connect(out);
  o.start(t);
  o.stop(stop);
  return o;
}
export function noiseSrc(ctx: Ctx, t: number, stop: number, out: AudioNode, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  s.playbackRate.value = rate;
  s.loop = true;
  s.connect(out);
  s.start(t, Math.random());
  s.stop(stop);
  return s;
}
export function filter(ctx: Ctx, type: BiquadFilterType, f: number, q: number, out: AudioNode) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.connect(out);
  return b;
}

// ---------------------------------------------------------------------------------------------
// Instruments (note-level). All return nothing; they schedule into `out`.
export type Inst =
  | 'square'
  | 'pulse'
  | 'triangle'
  | 'bell'
  | 'glock'
  | 'pluck'
  | 'uke'
  | 'gayageum'
  | 'brass'
  | 'whistle'
  | 'pad'
  | 'epiano'
  | 'bass'
  | 'subbass'
  | 'saw'
  | 'musicbox'
  | 'strings'
  | 'flute'
  | 'harp'
  | 'kalimba'
  | 'steelpan'
  | 'oud'
  | 'marimba';

export function playNote(ctx: Ctx, inst: Inst, midi: number, t: number, dur: number, vel: number, out: AudioNode) {
  const f = mtof(midi);
  const end = t + dur;
  switch (inst) {
    case 'flute': {
      const g = envGain(ctx, t, dur, { a: .035, d: .16, s: .72, r: .13, peak: vel * .23 }, out);
      const o = osc(ctx, 'sine', f, t, end + .45, g);
      const harmonic = envGain(ctx, t, dur, { a: .05, d: .1, s: .5, r: .12, peak: vel * .035 }, out);
      osc(ctx, 'sine', f * 2, t, end + .45, harmonic);
      const vibrato = ctx.createOscillator(), depth = ctx.createGain();
      vibrato.frequency.value = 4.8;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(f * .004, t + .25);
      vibrato.connect(depth).connect(o.frequency);
      vibrato.start(t); vibrato.stop(end + .45);
      const breath = envGain(ctx, t, dur, { a: .03, d: .1, s: .4, r: .1, peak: vel * .012 }, out);
      noiseSrc(ctx, t, end + .35, filter(ctx, 'bandpass', f * 2, 1.5, breath));
      break;
    }
    case 'harp':
    case 'kalimba':
    case 'steelpan': {
      const partials = inst === 'harp' ? [1, 2, 3, 4] : inst === 'kalimba' ? [1, 2.76, 5.4] : [1, 2, 2.98, 4.02];
      const decay = inst === 'harp' ? 1.7 : inst === 'kalimba' ? 1.1 : .85;
      partials.forEach((ratio, i) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(.0001, t);
        g.gain.linearRampToValueAtTime(vel * (i === 0 ? .3 : .065 / i), t + .004);
        g.gain.exponentialRampToValueAtTime(.0001, t + decay / (1 + i * .8));
        g.connect(out);
        osc(ctx, 'sine', f * ratio, t, t + decay + .05, g);
      });
      break;
    }
    case 'square':
    case 'pulse': {
      const g = envGain(ctx, t, dur * 0.9, { a: 0.005, d: 0.08, s: 0.55, r: 0.06, peak: vel * 0.16 }, out);
      const lp = filter(ctx, 'lowpass', 3800, 0.4, g);
      const o = osc(ctx, inst === 'pulse' ? 'sawtooth' : 'square', f, t, end + 0.2, lp);
      // gentle delayed vibrato
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.25, dur));
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(end + 0.2);
      break;
    }
    case 'triangle': {
      const g = envGain(ctx, t, dur * 0.9, { a: 0.006, d: 0.1, s: 0.6, r: 0.08, peak: vel * 0.32 }, out);
      osc(ctx, 'triangle', f, t, end + 0.2, g);
      break;
    }
    case 'bell':
    case 'glock':
    case 'musicbox': {
      // 2-op FM bell
      const ratio = inst === 'glock' ? 3.5 : inst === 'musicbox' ? 4.0 : 2.0;
      const decay = inst === 'glock' ? 0.9 : inst === 'musicbox' ? 1.4 : 1.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * (inst === 'musicbox' ? 0.2 : 0.22), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      g.connect(out);
      const car = osc(ctx, 'sine', f * (inst === 'glock' ? 2 : 1), t, t + decay + 0.05, g);
      const mod = ctx.createOscillator();
      mod.frequency.value = f * ratio * (inst === 'glock' ? 2 : 1);
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(f * 2.2, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.05, t + decay * 0.6);
      mod.connect(mg).connect(car.frequency);
      mod.start(t);
      mod.stop(t + decay + 0.05);
      break;
    }
    case 'marimba': {
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      g.connect(out);
      osc(ctx, 'sine', f, t, t + 0.55, g);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(vel * 0.08, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      g2.connect(out);
      osc(ctx, 'sine', f * 4, t, t + 0.1, g2);
      break;
    }
    case 'pluck':
    case 'uke':
    case 'oud':
    case 'gayageum': {
      const g = ctx.createGain();
      const dec = inst === 'gayageum' ? 1.4 : inst === 'oud' ? .8 : inst === 'uke' ? 0.55 : 0.4;
      g.gain.setValueAtTime(vel * 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      g.connect(out);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = inst === 'oud' ? .7 : 2;
      lp.frequency.setValueAtTime(f * (inst === 'oud' ? 4 : 8), t);
      lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dec * 0.6);
      lp.connect(g);
      const o = osc(ctx, inst === 'uke' ? 'triangle' : 'sawtooth', f, t, t + dec + 0.05, lp);
      if (inst === 'oud') {
        o.frequency.setValueAtTime(f * 1.012, t);
        o.frequency.exponentialRampToValueAtTime(f, t + .045);
      }
      if (inst === 'gayageum') {
        // characteristic pitch bend-in and late vibrato (nonghyeon)
        o.frequency.setValueAtTime(f * 0.97, t);
        o.frequency.linearRampToValueAtTime(f, t + 0.06);
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 6;
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(f * 0.02, t + 0.5);
        lfo.connect(lg).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + dec);
      }
      break;
    }
    case 'brass': {
      const g = envGain(ctx, t, dur, { a: 0.04, d: 0.15, s: 0.7, r: 0.1, peak: vel * 0.2 }, out);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(f * 1.2, t);
      lp.frequency.linearRampToValueAtTime(f * 5, t + 0.06);
      lp.frequency.linearRampToValueAtTime(f * 3, t + dur);
      lp.connect(g);
      osc(ctx, 'sawtooth', f, t, end + 0.2, lp, -6);
      osc(ctx, 'sawtooth', f, t, end + 0.2, lp, 6);
      break;
    }
    case 'whistle': {
      const g = envGain(ctx, t, dur, { a: 0.03, d: 0.1, s: 0.8, r: 0.08, peak: vel * 0.22 }, out);
      const o = osc(ctx, 'sine', f * 2, t, end + 0.2, g);
      o.frequency.setValueAtTime(f * 2 * 0.985, t);
      o.frequency.linearRampToValueAtTime(f * 2, t + 0.05);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6.2;
      lg.gain.value = f * 0.025;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(end + 0.2);
      const ng = envGain(ctx, t, dur, { a: 0.02, d: 0.1, s: 0.5, r: 0.05, peak: vel * 0.02 }, out);
      noiseSrc(ctx, t, end + 0.2, filter(ctx, 'bandpass', f * 2, 8, ng));
      break;
    }
    case 'pad':
    case 'strings': {
      const g = envGain(ctx, t, dur, { a: inst === 'pad' ? 0.25 : 0.12, d: 0.3, s: 0.8, r: 0.35, peak: vel * (inst === 'pad' ? 0.06 : 0.08) }, out);
      const lp = filter(ctx, 'lowpass', inst === 'pad' ? 1800 : 2600, 0.3, g);
      for (const dt of [-9, 0, 9]) osc(ctx, 'sawtooth', f, t, end + 0.6, lp, dt);
      break;
    }
    case 'epiano': {
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.22, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.06, t + 0.5);
      g.gain.setTargetAtTime(0.0001, end, 0.08);
      g.connect(out);
      osc(ctx, 'sine', f, t, end + 0.4, g);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(vel * 0.06, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      g2.connect(out);
      osc(ctx, 'sine', f * 2.01, t, t + 0.35, g2);
      break;
    }
    case 'bass': {
      const g = envGain(ctx, t, dur * 0.85, { a: 0.005, d: 0.12, s: 0.6, r: 0.05, peak: vel * 0.34 }, out);
      const lp = filter(ctx, 'lowpass', 900, 1.2, g);
      osc(ctx, 'sawtooth', f, t, end + 0.15, lp);
      osc(ctx, 'sine', f, t, end + 0.15, g);
      break;
    }
    case 'subbass': {
      const g = envGain(ctx, t, dur * 0.9, { a: 0.008, d: 0.1, s: 0.8, r: 0.06, peak: vel * 0.42 }, out);
      osc(ctx, 'sine', f, t, end + 0.15, g);
      osc(ctx, 'triangle', f * 2, t, end + 0.15, envGain(ctx, t, dur * 0.5, { a: 0.005, d: 0.05, s: 0.3, r: 0.05, peak: vel * 0.08 }, out));
      break;
    }
    case 'saw': {
      const g = envGain(ctx, t, dur * 0.9, { a: 0.005, d: 0.1, s: 0.5, r: 0.06, peak: vel * 0.1 }, out);
      const lp = filter(ctx, 'lowpass', 3200, 0.8, g);
      osc(ctx, 'sawtooth', f, t, end + 0.2, lp, -7);
      osc(ctx, 'sawtooth', f, t, end + 0.2, lp, 7);
      break;
    }
  }
}

export type Drum = 'kick' | 'snare' | 'hat' | 'ohat' | 'clap' | 'shaker' | 'sleigh' | 'tamb' | 'janggu' | 'cowbell' | 'tom';
export function playDrum(ctx: Ctx, d: Drum, t: number, vel: number, out: AudioNode) {
  switch (d) {
    case 'kick': {
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      g.connect(out);
      const o = osc(ctx, 'sine', 140, t, t + 0.35, g);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      break;
    }
    case 'tom':
    case 'janggu': {
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      g.connect(out);
      const o = osc(ctx, 'sine', d === 'janggu' ? 260 : 180, t, t + 0.3, g);
      o.frequency.exponentialRampToValueAtTime(d === 'janggu' ? 170 : 110, t + 0.12);
      if (d === 'janggu') {
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vel * 0.25, t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        ng.connect(out);
        noiseSrc(ctx, t, t + 0.06, filter(ctx, 'highpass', 2500, 1, ng));
      }
      break;
    }
    case 'snare':
    case 'clap': {
      const g = ctx.createGain();
      g.connect(out);
      if (d === 'clap') {
        for (let i = 0; i < 3; i++) {
          g.gain.setValueAtTime(vel * 0.4, t + i * 0.012);
          g.gain.exponentialRampToValueAtTime(0.02, t + i * 0.012 + 0.01);
        }
        g.gain.setValueAtTime(vel * 0.4, t + 0.036);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        noiseSrc(ctx, t, t + 0.22, filter(ctx, 'bandpass', 1400, 1.2, g));
      } else {
        g.gain.setValueAtTime(vel * 0.42, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        noiseSrc(ctx, t, t + 0.2, filter(ctx, 'bandpass', 2600, 0.8, g));
        const tg = ctx.createGain();
        tg.gain.setValueAtTime(vel * 0.3, t);
        tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        tg.connect(out);
        const o = osc(ctx, 'triangle', 220, t, t + 0.12, tg);
        o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
      }
      break;
    }
    case 'hat':
    case 'ohat':
    case 'shaker':
    case 'tamb':
    case 'sleigh': {
      const dur = d === 'ohat' ? 0.22 : d === 'sleigh' ? 0.16 : d === 'tamb' ? 0.12 : 0.045;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * (d === 'shaker' ? 0.12 : d === 'sleigh' ? 0.16 : 0.15), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(out);
      const f = d === 'sleigh' ? filter(ctx, 'bandpass', 7200, 4, g) : filter(ctx, 'highpass', d === 'shaker' ? 6000 : 8000, 0.7, g);
      noiseSrc(ctx, t, t + dur + 0.02, f, 1.2);
      if (d === 'sleigh' || d === 'tamb') {
        for (let i = 0; i < 3; i++) {
          const bg = ctx.createGain();
          bg.gain.setValueAtTime(vel * 0.03, t + i * 0.02);
          bg.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.02 + 0.08);
          bg.connect(out);
          osc(ctx, 'sine', 4200 + i * 900, t + i * 0.02, t + i * 0.02 + 0.1, bg);
        }
      }
      break;
    }
    case 'cowbell': {
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      g.connect(out);
      const bp = filter(ctx, 'bandpass', 900, 3, g);
      osc(ctx, 'square', 560, t, t + 0.3, bp);
      osc(ctx, 'square', 845, t, t + 0.3, bp);
      break;
    }
  }
}
