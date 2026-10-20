import { audio } from './engine';
import { noise, playNote } from './synth';
import type { ThemeDef } from '../tracks/themes';

/** Per-theme environment bed + sparse events (birds, city, market, waves, chimes...). */
export class Ambience {
  private nodes: AudioNode[] = [];
  private srcs: AudioScheduledSourceNode[] = [];
  private timer: number | null = null;
  start(kind: ThemeDef['ambience']) {
    this.stop();
    const ctx = audio.ensure();
    const bed = ctx.createGain();
    bed.gain.value = 0;
    bed.gain.setTargetAtTime(1, ctx.currentTime, 1);
    bed.connect(audio.amb);
    this.nodes.push(bed);
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    n.loop = true;
    const f = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    const ng = ctx.createGain();
    switch (kind) {
      case 'waves':
        f.type = 'lowpass';
        f.frequency.value = 700;
        lfo.frequency.value = 0.12;
        lg.gain.value = 0.18;
        ng.gain.value = 0.22;
        break;
      case 'wind':
        f.type = 'bandpass';
        f.frequency.value = 500;
        f.Q.value = 0.8;
        lfo.frequency.value = 0.08;
        lg.gain.value = 0.12;
        ng.gain.value = 0.16;
        break;
      case 'city':
      case 'machines':
        f.type = 'lowpass';
        f.frequency.value = 260;
        lfo.frequency.value = 0.2;
        lg.gain.value = 0.05;
        ng.gain.value = 0.12;
        break;
      case 'market':
        f.type = 'bandpass';
        f.frequency.value = 900;
        f.Q.value = 0.6;
        lfo.frequency.value = 0.3;
        lg.gain.value = 0.04;
        ng.gain.value = 0.06;
        break;
      default:
        f.type = 'lowpass';
        f.frequency.value = 400;
        lfo.frequency.value = 0.1;
        lg.gain.value = 0.02;
        ng.gain.value = 0.04;
    }
    lfo.connect(lg).connect(ng.gain);
    n.connect(f).connect(ng).connect(bed);
    n.start();
    lfo.start();
    this.srcs.push(n, lfo);
    const event = () => {
      const c = audio.ctx;
      if (!c) return;
      const t = c.currentTime + 0.05;
      const pan = c.createStereoPanner();
      pan.pan.value = Math.random() * 1.6 - 0.8;
      const g = c.createGain();
      g.gain.value = 0.5;
      g.connect(pan).connect(bed);
      switch (kind) {
        case 'birds':
        case 'waves': {
          // chirp / gull
          for (let i = 0; i < (kind === 'birds' ? 3 : 2); i++) {
            const o = c.createOscillator();
            const eg = c.createGain();
            const st = t + i * 0.12;
            o.frequency.setValueAtTime(kind === 'birds' ? 3200 : 1400, st);
            o.frequency.exponentialRampToValueAtTime(kind === 'birds' ? 4600 : 900, st + 0.08);
            eg.gain.setValueAtTime(0.0001, st);
            eg.gain.linearRampToValueAtTime(0.05, st + 0.01);
            eg.gain.exponentialRampToValueAtTime(0.0001, st + 0.1);
            o.connect(eg).connect(g);
            o.start(st);
            o.stop(st + 0.12);
          }
          break;
        }
        case 'chimes':
        case 'sweet':
          for (let i = 0; i < 3; i++) playNote(c, 'musicbox', [84, 88, 91, 95, 96, 100][Math.floor(Math.random() * 6)] + 12, t + i * 0.15, 0.3, 0.25, g);
          break;
        case 'city':
          playNote(c, 'square', 76, t, 0.08, 0.12, g);
          playNote(c, 'square', 76, t + 0.14, 0.08, 0.12, g);
          break;
        case 'machines':
          for (let i = 0; i < 2; i++) playNote(c, 'marimba', 48 + i * 7, t + i * 0.2, 0.1, 0.4, g);
          break;
        case 'market':
          for (let i = 0; i < 4; i++) playNote(c, 'triangle', 60 + Math.floor(Math.random() * 12), t + i * 0.09, 0.07, 0.08, g);
          break;
        case 'wind':
          for (let i = 0; i < 2; i++) playNote(c, 'bell', 96 + i * 5, t + i * 0.3, 0.3, 0.15, g);
          break;
      }
      setTimeout(() => pan.disconnect(), 3000);
    };
    this.timer = window.setInterval(() => {
      if (Math.random() < 0.45) event();
    }, 1600);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const ctx = audio.ctx;
    for (const s of this.srcs) {
      try {
        s.stop((ctx?.currentTime ?? 0) + 0.6);
      } catch {
        /* ignore */
      }
    }
    for (const n of this.nodes) {
      if (ctx && n instanceof GainNode) n.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => n.disconnect(), 800);
    }
    this.srcs = [];
    this.nodes = [];
  }
}
