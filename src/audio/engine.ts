import { useSettings } from '../core/settings';
import { SFX_RECIPES, type Recipe, type SfxId } from './sfx';

/**
 * Mixer (§9.1-5): master compressor/limiter, music / sfx / voice / ambience buses,
 * voice ducking (-6 dB, 250 ms), 32-voice limit, ±5 % pitch variation on repeats.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  musicDuck!: GainNode;
  sfx!: GainNode;
  voice!: GainNode;
  amb!: GainNode;
  buffers = new Map<SfxId, AudioBuffer>();
  private active: { src: AudioBufferSourceNode; end: number }[] = [];
  private lastPlay = new Map<string, number>();
  ready = false;
  private renderPromise: Promise<void> | null = null;
  private duckCount = 0;

  ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    comp.connect(limiter).connect(this.master).connect(ctx.destination);
    this.music = ctx.createGain();
    this.musicDuck = ctx.createGain();
    this.music.connect(this.musicDuck).connect(comp);
    this.sfx = ctx.createGain();
    this.sfx.connect(comp);
    this.voice = ctx.createGain();
    this.voice.connect(comp);
    this.amb = ctx.createGain();
    this.amb.connect(comp);
    this.applyVolumes();
    useSettings.subscribe(() => this.applyVolumes());
    return ctx;
  }
  applyVolumes() {
    if (!this.ctx) return;
    const s = useSettings.getState();
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(s.bgm * 0.5, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfx * 0.8, t, 0.05);
    this.voice.gain.setTargetAtTime(s.voice * 1.0, t, 0.05);
    this.amb.gain.setTargetAtTime(s.sfx * 0.35, t, 0.05);
  }
  /** iOS/Chrome autoplay unlock: call from a user gesture. */
  async unlock() {
    let ctx: AudioContext;
    try {
      ctx = this.ensure();
    } catch {
      // Sound availability must never prevent opening login or entering the game.
      return;
    }
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    if (!this.renderPromise) this.renderPromise = this.renderAll().catch(() => { this.renderPromise = null; });
    return this.renderPromise;
  }
  private async renderAll() {
    const ctx = this.ensure();
    const ids = Object.keys(SFX_RECIPES) as SfxId[];
    await Promise.all(
      ids.map(async (id) => {
        const r = SFX_RECIPES[id] as Recipe;
        const sr = 44100;
        const off = new OfflineAudioContext(1, Math.ceil(sr * r.len), sr);
        const out = off.createGain();
        out.gain.value = r.gain ?? 1;
        out.connect(off.destination);
        r.build(off, out);
        try {
          const buf = await off.startRendering();
          normalizePeak(buf, 0.7);
          this.buffers.set(id, buf);
        } catch (e) {
          console.warn('sfx render failed', id, e);
        }
      }),
    );
    void ctx;
    this.ready = true;
  }
  play(id: SfxId, o: { vol?: number; rate?: number; pan?: number; vary?: boolean; when?: number; bus?: 'sfx' | 'voice' | 'amb' } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return null;
    const buf = this.buffers.get(id);
    if (!buf) return null;
    const now = this.ctx.currentTime;
    // anti-spam: same sfx within 30 ms
    const last = this.lastPlay.get(id) ?? -1;
    if (now - last < 0.03) return null;
    this.lastPlay.set(id, now);
    this.active = this.active.filter((a) => a.end > now);
    if (this.active.length >= 32) {
      const old = this.active.shift();
      try {
        old?.src.stop();
      } catch {
        /* already stopped */
      }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const vary = o.vary !== false ? 1 + (Math.random() - 0.5) * 0.1 : 1;
    src.playbackRate.value = (o.rate ?? 1) * vary;
    const g = this.ctx.createGain();
    g.gain.value = (o.vol ?? 1) * ((SFX_RECIPES[id] as { vol?: number }).vol ?? 1);
    let node: AudioNode = g;
    if (o.pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      node = p;
    }
    node.connect(o.bus === 'voice' ? this.voice : o.bus === 'amb' ? this.amb : this.sfx);
    src.connect(g);
    const when = o.when ?? now;
    src.start(when);
    this.active.push({ src, end: when + buf.duration / src.playbackRate.value });
    return src;
  }
  /** Duck BGM by 6 dB while a voice line plays. */
  duck(seconds: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duckCount++;
    this.musicDuck.gain.cancelScheduledValues(t);
    this.musicDuck.gain.setTargetAtTime(0.5, t, 0.25 / 3);
    setTimeout(() => {
      this.duckCount--;
      if (this.duckCount <= 0 && this.ctx) this.musicDuck.gain.setTargetAtTime(1, this.ctx.currentTime, 0.25 / 3);
    }, seconds * 1000);
  }
  get time() {
    return this.ctx?.currentTime ?? 0;
  }
}
function normalizePeak(buf: AudioBuffer, target: number) {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  if (peak < 1e-4) return;
  const k = target / peak;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
}
export const audio = new AudioEngine();
