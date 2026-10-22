import { Rng } from '../core/rng';
import { audio } from './engine';
import { TRACK_SONGS } from './trackSongs';
import { createMusicMix, type MusicMix } from './musicMix';
import { playDrum, playNote, type Ctx, type Drum, type Inst } from './synth';

/**
 * Sample-free adaptive soundtrack: sixteen written expedition themes, plus menu music.
 * Two-bar hooks develop across an AABA arrangement; shared scheduling keeps offline
 * auditions identical to gameplay, including the continuous loop and final-lap tempo lift.
 */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

type DrumStyle =
  | 'pop'
  | 'chip'
  | 'four'
  | 'bossa'
  | 'lofi'
  | 'gugak'
  | 'funk'
  | 'orch'
  | 'none'
  | 'march'
  | 'tribal'
  | 'deep';
type Comp = 'block' | 'arp' | 'offbeat' | 'strum' | 'none' | 'pad';
export interface SongDef {
  id: string;
  name: string;
  mood: string;
  bpm: number;
  root: number;
  scale: number[];
  progA: number[];
  progB: number[];
  lead: Inst;
  lead2?: Inst;
  chords: Inst;
  comp: Comp;
  bass: Inst;
  drums: DrumStyle;
  extra?: Drum[];
  swing?: number;
  seed: number;
  density: number;
  leadOct: number;
  pad?: Inst;
  /** Written two-bar theme, in scale degrees; absent for incidental menu music. */
  hook?: [number, number, number][];
  space?: number;
}

export const SONGS: Record<string, SongDef> = {
  menu: {
    id: 'menu',
    name: '터보 랠리 메인 테마',
    mood: '경쾌한 팝 · 박수 · 글로켄슈필',
    bpm: 120,
    root: 60,
    scale: MAJOR,
    progA: [1, 5, 6, 4],
    progB: [4, 5, 3, 6, 2, 5, 1, 1],
    lead: 'glock',
    lead2: 'triangle',
    chords: 'epiano',
    comp: 'offbeat',
    bass: 'bass',
    drums: 'pop',
    extra: ['clap'],
    seed: 11,
    density: 0.55,
    leadOct: 1,
  },
  shop: {
    id: 'shop',
    name: '쇼핑은 즐거워',
    mood: '보사노바 라운지',
    bpm: 100,
    root: 65,
    scale: MAJOR,
    progA: [2, 5, 1, 6],
    progB: [4, 3, 2, 5],
    lead: 'marimba',
    chords: 'epiano',
    comp: 'block',
    bass: 'subbass',
    drums: 'bossa',
    swing: 0.12,
    seed: 21,
    density: 0.45,
    leadOct: 0,
  },
  dashboard: {
    id: 'dashboard',
    name: '기록의 방',
    mood: '차분한 로파이 팝',
    bpm: 90,
    root: 63,
    scale: MAJOR,
    progA: [4, 3, 2, 1],
    progB: [6, 4, 5, 1],
    lead: 'musicbox',
    chords: 'epiano',
    comp: 'block',
    bass: 'subbass',
    drums: 'lofi',
    swing: 0.18,
    seed: 31,
    density: 0.35,
    leadOct: 1,
  },
  ...TRACK_SONGS,
  win: {
    id: 'win',
    name: '축하 루프',
    mood: '팡파레 + 축하 루프',
    bpm: 128,
    root: 60,
    scale: MAJOR,
    progA: [1, 4, 5, 1],
    progB: [6, 4, 5, 1],
    lead: 'glock',
    lead2: 'square',
    chords: 'epiano',
    comp: 'offbeat',
    bass: 'bass',
    drums: 'pop',
    extra: ['clap', 'tamb'],
    seed: 901,
    density: 0.6,
    leadOct: 1,
  },
  lose: {
    id: 'lose',
    name: '괜찮아 다음 판!',
    mood: '귀엽게 아쉬운 (슬프지 않게)',
    bpm: 96,
    root: 65,
    scale: MAJOR,
    progA: [4, 1, 2, 5],
    progB: [6, 4, 5, 1],
    lead: 'musicbox',
    chords: 'epiano',
    comp: 'block',
    bass: 'subbass',
    drums: 'lofi',
    swing: 0.15,
    seed: 902,
    density: 0.4,
    leadOct: 1,
  },
};

interface Bar {
  chord: number[]; // midi notes
  root: number;
  section: 'I' | 'A' | 'B';
  melody: [number, number, number][]; // step, midi, len(steps)
  counter: [number, number, number][];
  fill: boolean;
}

function degToMidi(song: SongDef, deg: number, oct = 0) {
  const sc = song.scale;
  const n = sc.length;
  const i = deg - 1;
  const o = Math.floor(i / n);
  return song.root + sc[((i % n) + n) % n] + 12 * (o + oct);
}
function chordOf(song: SongDef, deg: number): number[] {
  if (song.scale.length === 5) {
    // pentatonic: use major-ish triads built on the parent major scale
    const map: Record<number, number[]> = {
      1: [0, 4, 7],
      4: [5, 9, 12],
      5: [7, 11, 14],
      2: [2, 5, 9],
      6: [9, 12, 16],
    };
    return (map[deg] ?? [0, 4, 7]).map((x) => song.root + x);
  }
  return [deg, deg + 2, deg + 4].map((d) => degToMidi(song, d));
}

const RHYTHMS = [
  [0, 4, 6, 8, 12],
  [0, 2, 4, 8, 10, 12],
  [0, 3, 6, 8, 12, 14],
  [0, 4, 8, 10, 12, 14],
  [0, 2, 4, 6, 8, 12],
  [0, 6, 8, 12],
  [0, 4, 8, 12],
  [2, 4, 6, 8, 12, 14],
];

export function compose(song: SongDef): Bar[] {
  const r = new Rng(song.seed);
  const bars: Bar[] = [];
  const scaleNotes: number[] = [];
  for (let o = -1; o <= 2; o++) for (const iv of song.scale) scaleNotes.push(song.root + iv + 12 * o);
  const leadBase = 12 * song.leadOct;
  const nearestScale = (m: number) =>
    scaleNotes.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
  const stepScale = (m: number, k: number) => {
    const i = scaleNotes.indexOf(nearestScale(m));
    return scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, i + k))];
  };
  const makeMotif = (chords: number[][], dens: number): [number, number, number][][] => {
    // two bars
    return chords.map((ch, bi) => {
      const rhythm = r.pick(RHYTHMS).filter((_, i) => i === 0 || r.chance(0.55 + dens * 0.45));
      let cur = nearestScale(r.pick(ch) + 12 + leadBase);
      const out: [number, number, number][] = [];
      rhythm.forEach((st, i) => {
        const next = rhythm[i + 1] ?? 16;
        if (i > 0) {
          const strong = st % 8 === 0;
          cur = strong
            ? nearestScale(
                ch
                  .map((x) => x + 12 + leadBase)
                  .reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a)),
              )
            : stepScale(cur, r.pick([-2, -1, -1, 1, 1, 2, 3]));
        }
        out.push([st, cur, Math.max(1, next - st - (r.chance(0.3) ? 1 : 0))]);
      });
      if (bi === 1 && r.chance(0.5)) out[out.length - 1][2] = 16 - out[out.length - 1][0];
      return out;
    });
  };
  const transpose = (mot: [number, number, number][], ch: number[]) =>
    mot.map(
      ([s, m, l]) =>
        [s, nearestScale(m + (ch[0] - song.root > 6 ? -1 : 1) * 2), l] as [number, number, number],
    );
  const sec = (prog: number[], name: 'A' | 'B') => {
    const chords = prog.map((d) => chordOf(song, d));
    const len = chords.length === 4 ? 8 : chords.length;
    const full = Array.from({ length: len }, (_, i) => chords[i % chords.length]);
    const m1 = makeMotif([full[0], full[1]], song.density);
    const m2 = makeMotif([full[4 % len], full[5 % len]], song.density);
    const mel: [number, number, number][][] = [
      m1[0],
      m1[1],
      transpose(m1[0], full[2]),
      transpose(m1[1], full[3]),
      m2[0],
      m2[1],
      makeMotif([full[6 % len]], song.density * 0.8)[0],
      [[0, nearestScale(full[7 % len][0] + 12 + leadBase), 12]],
    ];
    full.forEach((ch, i) => {
      const counter: [number, number, number][] = [];
      if (song.lead2 && i % 2 === 1) {
        // answering phrase in the gaps (call & response)
        [8, 10, 12, 14].forEach((st, k) => counter.push([st, nearestScale(ch[k % 3] + 12 + leadBase), 2]));
      }
      let melody = mel[i % mel.length];
      if (song.hook) {
        // Keep the recognizable hook, answer it, then open it up in the bridge.
        const half = (i % 2) * 16;
        const shift = name === 'B' ? 2 : i >= 4 ? 1 : 0;
        melody = song.hook
          .filter(([step]) => step >= half && step < half + 16)
          .map(([step, degree, length]) => [
            step - half,
            degToMidi(song, degree + shift, 1 + song.leadOct),
            length,
          ]);
        if (i === len - 1) melody = [[0, nearestScale(ch[0] + 12 + leadBase), 12]];
      }
      bars.push({ chord: ch, root: ch[0], section: name, melody, counter, fill: i === len - 1 });
    });
  };
  // intro (2 bars, no melody)
  const c1 = chordOf(song, song.progA[0]);
  const c2 = chordOf(song, song.progA[song.progA.length - 1]);
  bars.push({ chord: c1, root: c1[0], section: 'I', melody: [], counter: [], fill: false });
  bars.push({ chord: c2, root: c2[0], section: 'I', melody: [], counter: [], fill: true });
  sec(song.progA, 'A');
  sec(song.progA, 'A');
  sec(song.progB, 'B');
  sec(song.progA, 'A');
  return bars;
}

const DRUMS: Record<DrumStyle, Partial<Record<Drum, number[]>>> = {
  pop: { kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  chip: { kick: [0, 6, 8], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  four: { kick: [0, 4, 8, 12], clap: [4, 12], ohat: [2, 6, 10, 14], hat: [1, 3, 5, 7, 9, 11, 13, 15] },
  bossa: {
    kick: [0, 6, 8, 14],
    tom: [3, 10],
    shaker: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  },
  lofi: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  gugak: { kick: [0, 8], janggu: [0, 3, 6, 10, 12, 14], hat: [2, 6, 10, 14] },
  funk: { kick: [0, 3, 8, 11], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  orch: { kick: [0, 8], tom: [0, 6, 8], snare: [4, 12], ohat: [12] },
  march: { kick: [0, 8], snare: [4, 12, 14] },
  tribal: { kick: [0, 8], tom: [0, 3, 6, 10, 14], janggu: [4, 12], shaker: [0, 2, 4, 6, 8, 10, 12, 14] },
  deep: { kick: [0, 8, 11], clap: [4, 12], hat: [2, 6, 10, 14], tom: [7, 15] },
  none: {},
};
const EXTRA_PAT: Partial<Record<Drum, number[]>> = {
  clap: [4, 12],
  shaker: [0, 2, 4, 6, 8, 10, 12, 14],
  sleigh: [0, 2, 4, 6, 8, 10, 12, 14],
  tamb: [4, 12],
  cowbell: [0, 6, 10],
};

export function scheduleSongStep(
  ctx: Ctx,
  s: SongDef,
  bars: Bar[],
  mix: MusicMix,
  step: number,
  t: number,
  tempo = 1,
) {
  const bar = bars[Math.floor(step / 16)];
  const st = step % 16;
  const spb = 60 / (s.bpm * tempo) / 4;
  // drums
  const pat = DRUMS[s.drums];
  for (const d of Object.keys(pat) as Drum[]) {
    if (pat[d]!.includes(st)) {
      const v = d === 'hat' ? (st % 4 === 0 ? 0.7 : 0.45) : d === 'kick' ? 1 : 0.8;
      if (bar.section !== 'I' || d === 'hat' || (step >= 16 && st % 8 === 0))
        playDrum(ctx, d, t, v * 0.65, mix.drums);
    }
  }
  if (bar.section !== 'I' || st >= 8)
    for (const d of s.extra ?? []) if (EXTRA_PAT[d]?.includes(st)) playDrum(ctx, d, t, 0.4, mix.drums);
  if (bar.fill && st >= 12) playDrum(ctx, st % 2 ? 'snare' : 'tom', t, 0.4, mix.drums);
  // bass
  const broot = bar.root - 24;
  if (s.drums === 'four' || s.drums === 'chip') {
    if (st % 2 === 0) playNote(ctx, s.bass, st % 4 === 2 ? broot + 12 : broot, t, spb * 1.6, 0.8, mix.bass);
  } else if (s.drums === 'bossa') {
    if ([0, 6, 8, 14].includes(st))
      playNote(ctx, s.bass, st === 6 || st === 14 ? broot + 7 : broot, t, spb * 3, 0.8, mix.bass);
  } else if (s.drums === 'funk') {
    if ([0, 3, 6, 8, 10, 11, 14].includes(st))
      playNote(
        ctx,
        s.bass,
        [6, 14].includes(st) ? broot + 12 : st === 11 ? broot + 10 : broot,
        t,
        spb * 1.2,
        0.85,
        mix.bass,
      );
  } else if ([0, 6, 8, 12].includes(st))
    playNote(ctx, s.bass, st === 12 ? broot + 7 : broot, t, spb * (st === 0 ? 5 : 3), 0.8, mix.bass);
  // chords / comping
  const ch = bar.chord;
  switch (s.comp) {
    case 'block':
      if (st === 0 || st === 8) ch.forEach((m) => playNote(ctx, s.chords, m, t, spb * 7, 0.45, mix.chords));
      break;
    case 'offbeat':
      if (st % 4 === 2) ch.forEach((m) => playNote(ctx, s.chords, m, t, spb * 1.5, 0.4, mix.chords));
      break;
    case 'arp': {
      const seq = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1]];
      if (st % 2 === 0)
        playNote(ctx, s.chords, seq[(st / 2) % seq.length] + 12, t, spb * 1.6, 0.4, mix.chords);
      break;
    }
    case 'strum':
      if ([0, 3, 6, 8, 10, 12, 14].includes(st))
        ch.forEach((m, i) =>
          playNote(ctx, s.chords, m + 12, t + i * 0.012, spb * 2, st % 4 === 0 ? 0.55 : 0.35, mix.chords),
        );
      break;
    case 'pad':
      if (st === 0) ch.forEach((m) => playNote(ctx, s.chords, m, t, spb * 15.5, 0.6, mix.chords));
      break;
  }
  if (s.pad && st === 0) ch.forEach((m) => playNote(ctx, s.pad!, m, t, spb * 15.5, 0.35, mix.pad));
  // melody
  for (const [ms, m, l] of bar.melody) if (ms === st) playNote(ctx, s.lead, m, t, spb * l, 0.72, mix.lead);
  if (s.lead2)
    for (const [ms, m, l] of bar.counter)
      if (ms === st) playNote(ctx, s.lead2, m, t, spb * l, 0.4, mix.answer);
  // double the lead an octave up with glock on the B section for sparkle
  if (bar.section === 'B' && s.lead2)
    for (const [ms, m, l] of bar.melody)
      if (ms === st) playNote(ctx, s.lead2, Math.min(88, m + 12), t, spb * l, 0.22, mix.answer);
}

/** Lookahead step sequencer (25 ms tick, 150 ms horizon). */
class MusicPlayer {
  song: SongDef | null = null;
  private bars: Bar[] = [];
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private bus: GainNode | null = null;
  private mix: MusicMix | null = null;
  private tempoMul = 1;
  private targetTempo = 1;
  current = '';
  play(id: string, fadeIn = 0.6) {
    if (this.current === id && this.timer) return;
    const ctx = audio.ensure();
    this.stop(0.5);
    const song = SONGS[id];
    if (!song) return;
    this.song = song;
    this.current = id;
    this.bars = compose(song);
    this.step = 0;
    this.tempoMul = this.targetTempo = 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeIn);
    g.connect(audio.music);
    this.bus = g;
    this.mix = createMusicMix(ctx, song, g);
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.tick(), 25);
  }
  stop(fade = 0.4) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const ctx = audio.ctx;
    if (this.bus && ctx) {
      const b = this.bus;
      b.gain.cancelScheduledValues(ctx.currentTime);
      b.gain.setValueAtTime(b.gain.value, ctx.currentTime);
      b.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
      const mix = this.mix;
      setTimeout(
        () => {
          b.disconnect();
          mix?.dispose();
        },
        fade * 1000 + 600,
      );
    }
    this.bus = null;
    this.mix = null;
    this.song = null;
    this.current = '';
  }
  /** +8 % on the final lap (§9.2) */
  setTempo(mul: number) {
    this.targetTempo = mul;
  }
  private tick() {
    const ctx = audio.ctx;
    if (!ctx || !this.song || !this.bus) return;
    // Browser background throttling must not release a burst of stale notes on return.
    if (this.nextTime < ctx.currentTime - 0.25) this.nextTime = ctx.currentTime + 0.03;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.schedule(this.step, this.nextTime);
      if (this.step % 16 === 0) this.tempoMul += (this.targetTempo - this.tempoMul) * 0.6;
      const spb = 60 / (this.song.bpm * this.tempoMul) / 4;
      const swing = this.song.swing ?? 0;
      this.nextTime += spb * (this.step % 2 === 0 ? 1 + swing : 1 - swing);
      this.step++;
      // loop back to the first A section (skip intro)
      if (this.step >= this.bars.length * 16) this.step = 2 * 16;
    }
  }
  private schedule(step: number, t: number) {
    scheduleSongStep(audio.ctx!, this.song!, this.bars, this.mix!, step, t, this.tempoMul);
  }
  /** One-shot jingles (finish fanfare, cute "aww"). */
  jingle(kind: 'fanfare' | 'aww' | 'start') {
    const ctx = audio.ensure();
    const t0 = ctx.currentTime + 0.05;
    const out = audio.music;
    if (kind === 'fanfare') {
      const seq: [number, number, number][] = [
        [72, 0, 0.12],
        [72, 0.14, 0.12],
        [72, 0.28, 0.12],
        [76, 0.42, 0.3],
        [79, 0.78, 0.12],
        [77, 0.92, 0.12],
        [79, 1.06, 0.12],
        [84, 1.2, 0.9],
      ];
      for (const [m, t, l] of seq) {
        playNote(ctx, 'brass', m, t0 + t, l, 1, out);
        playNote(ctx, 'glock', m + 12, t0 + t, l, 0.6, out);
      }
      [60, 64, 67, 72].forEach((m) => playNote(ctx, 'strings', m, t0 + 1.2, 1.2, 0.9, out));
      playDrum(ctx, 'kick', t0 + 1.2, 1, out);
      playDrum(ctx, 'ohat', t0 + 1.2, 1, out);
      for (let i = 0; i < 6; i++) playDrum(ctx, 'snare', t0 + 0.9 + i * 0.05, 0.4 + i * 0.1, out);
    } else if (kind === 'aww') {
      const seq: [number, number, number][] = [
        [79, 0, 0.2],
        [77, 0.22, 0.2],
        [76, 0.44, 0.2],
        [74, 0.66, 0.35],
        [76, 1.05, 0.6],
      ];
      for (const [m, t, l] of seq) playNote(ctx, 'musicbox', m, t0 + t, l, 1, out);
      [65, 69, 72].forEach((m) => playNote(ctx, 'epiano', m, t0 + 1.05, 0.8, 0.7, out));
    }
  }
}
export const music = new MusicPlayer();

/** Audition the actual game arrangement, including its loop seam, without playing it aloud. */
export async function renderSong(id: string, barCount = 36, sampleRate = 24000): Promise<AudioBuffer> {
  const song = SONGS[id];
  if (!song) throw new Error(`Unknown song: ${id}`);
  const bars = compose(song);
  const duration = (barCount * 240) / song.bpm;
  const ctx = new OfflineAudioContext(2, Math.ceil((duration + 2.5) * sampleRate), sampleRate);
  const output = ctx.createGain();
  output.gain.setValueAtTime(0, 0);
  output.gain.linearRampToValueAtTime(1, 0.03);
  output.gain.setValueAtTime(1, duration);
  output.gain.linearRampToValueAtTime(0, duration + 2.3);
  output.connect(ctx.destination);
  const mix = createMusicMix(ctx, song, output);
  let step = 0,
    time = 0.04;
  for (let i = 0; i < barCount * 16; i++) {
    scheduleSongStep(ctx, song, bars, mix, step, time);
    time += (60 / song.bpm / 4) * (step % 2 === 0 ? 1 + (song.swing ?? 0) : 1 - (song.swing ?? 0));
    if (++step >= bars.length * 16) step = 32;
  }
  const buffer = await ctx.startRendering();
  mix.dispose();
  return buffer;
}
