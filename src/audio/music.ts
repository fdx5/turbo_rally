import { Rng } from '../core/rng';
import { audio } from './engine';
import { playDrum, playNote, type Drum, type Inst } from './synth';

/**
 * Procedural BGM (§9.2 fallback generator, used for every scene so nothing ships silent).
 * Each song = key + scale + chord progressions + instrument preset; the melody is composed
 * deterministically from a seed with motif repetition (AABA) so it is catchy, not random noise.
 */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const PENTA = [0, 2, 4, 7, 9];

type DrumStyle = 'pop' | 'chip' | 'four' | 'bossa' | 'lofi' | 'gugak' | 'funk' | 'orch' | 'none' | 'march';
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
}

export const SONGS: Record<string, SongDef> = {
  menu: { id: 'menu', name: '터보 랠리 메인 테마', mood: '경쾌한 팝 · 박수 · 글로켄슈필', bpm: 120, root: 60, scale: MAJOR, progA: [1, 5, 6, 4], progB: [4, 5, 3, 6, 2, 5, 1, 1], lead: 'glock', lead2: 'triangle', chords: 'epiano', comp: 'offbeat', bass: 'bass', drums: 'pop', extra: ['clap'], seed: 11, density: 0.55, leadOct: 1 },
  shop: { id: 'shop', name: '쇼핑은 즐거워', mood: '보사노바 라운지', bpm: 100, root: 65, scale: MAJOR, progA: [2, 5, 1, 6], progB: [4, 3, 2, 5], lead: 'marimba', chords: 'epiano', comp: 'block', bass: 'subbass', drums: 'bossa', swing: 0.12, seed: 21, density: 0.45, leadOct: 0 },
  dashboard: { id: 'dashboard', name: '기록의 방', mood: '차분한 로파이 팝', bpm: 90, root: 63, scale: MAJOR, progA: [4, 3, 2, 1], progB: [6, 4, 5, 1], lead: 'musicbox', chords: 'epiano', comp: 'block', bass: 'subbass', drums: 'lofi', swing: 0.18, seed: 31, density: 0.35, leadOct: 1 },
  t1: { id: 't1', name: '버블검 쿠키 팝', mood: '통통 튀는 버블검 팝', bpm: 140, root: 62, scale: MAJOR, progA: [1, 6, 4, 5], progB: [4, 5, 6, 1, 4, 5, 1, 1], lead: 'square', lead2: 'glock', chords: 'pluck', comp: 'arp', bass: 'bass', drums: 'pop', extra: ['clap'], seed: 101, density: 0.7, leadOct: 1 },
  t2: { id: 't2', name: '한강 피크닉 휘파람', mood: '산뜻한 어쿠스틱 팝 + 휘파람', bpm: 138, root: 67, scale: MAJOR, progA: [1, 5, 4, 1], progB: [6, 4, 1, 5], lead: 'whistle', lead2: 'glock', chords: 'uke', comp: 'strum', bass: 'bass', drums: 'pop', extra: ['shaker'], seed: 202, density: 0.55, leadOct: 0 },
  t3: { id: 't3', name: '네온 시티 드라이브', mood: '신스팝 / 퓨처베이스', bpm: 150, root: 57, scale: MAJOR, progA: [6, 4, 1, 5], progB: [4, 5, 3, 6], lead: 'saw', lead2: 'bell', chords: 'pad', comp: 'offbeat', bass: 'subbass', drums: 'four', seed: 303, density: 0.65, leadOct: 1, pad: 'pad' },
  t4: { id: 't4', name: '장터 가야금 레이스', mood: '국악 퓨전 팝 (가야금 + 신스)', bpm: 145, root: 62, scale: PENTA, progA: [1, 4, 5, 1], progB: [4, 1, 5, 5], lead: 'gayageum', lead2: 'square', chords: 'pad', comp: 'pad', bass: 'bass', drums: 'gugak', seed: 404, density: 0.6, leadOct: 1 },
  t5: { id: 't5', name: '뚝딱 펑키 브라스', mood: '펑키 브라스', bpm: 148, root: 58, scale: MIXO, progA: [1, 4, 1, 5], progB: [4, 4, 1, 1, 5, 4, 1, 5], lead: 'brass', chords: 'epiano', comp: 'offbeat', bass: 'bass', drums: 'funk', extra: ['cowbell'], seed: 505, density: 0.6, leadOct: 0 },
  t6: { id: 't6', name: '아이스크림 썰매방울', mood: '징글벨풍 칩튠 + 썰매방울', bpm: 152, root: 65, scale: MAJOR, progA: [1, 4, 5, 1], progB: [4, 1, 2, 5], lead: 'square', lead2: 'glock', chords: 'triangle', comp: 'arp', bass: 'bass', drums: 'chip', extra: ['sleigh'], seed: 606, density: 0.65, leadOct: 1 },
  t7: { id: 't7', name: '제주 우쿨렐레 웨이브', mood: '트로피컬 하우스 / 우쿨렐레', bpm: 155, root: 64, scale: MAJOR, progA: [1, 5, 6, 4], progB: [4, 5, 1, 6], lead: 'marimba', lead2: 'whistle', chords: 'uke', comp: 'strum', bass: 'subbass', drums: 'four', extra: ['shaker'], seed: 707, density: 0.6, leadOct: 1 },
  t8: { id: 't8', name: '무지개 성 피날레', mood: '웅장한 오케스트라 팝 피날레', bpm: 165, root: 62, scale: MAJOR, progA: [1, 5, 6, 4], progB: [4, 5, 3, 6, 2, 5, 1, 1], lead: 'brass', lead2: 'glock', chords: 'strings', comp: 'block', bass: 'bass', drums: 'orch', seed: 808, density: 0.6, leadOct: 0, pad: 'strings' },
  win: { id: 'win', name: '축하 루프', mood: '팡파레 + 축하 루프', bpm: 128, root: 60, scale: MAJOR, progA: [1, 4, 5, 1], progB: [6, 4, 5, 1], lead: 'glock', lead2: 'square', chords: 'epiano', comp: 'offbeat', bass: 'bass', drums: 'pop', extra: ['clap', 'tamb'], seed: 901, density: 0.6, leadOct: 1 },
  lose: { id: 'lose', name: '괜찮아 다음 판!', mood: '귀엽게 아쉬운 (슬프지 않게)', bpm: 96, root: 65, scale: MAJOR, progA: [4, 1, 2, 5], progB: [6, 4, 5, 1], lead: 'musicbox', chords: 'epiano', comp: 'block', bass: 'subbass', drums: 'lofi', swing: 0.15, seed: 902, density: 0.4, leadOct: 1 },
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
    const map: Record<number, number[]> = { 1: [0, 4, 7], 4: [5, 9, 12], 5: [7, 11, 14], 2: [2, 5, 9], 6: [9, 12, 16] };
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

function compose(song: SongDef): Bar[] {
  const r = new Rng(song.seed);
  const bars: Bar[] = [];
  const scaleNotes: number[] = [];
  for (let o = -1; o <= 2; o++) for (const iv of song.scale) scaleNotes.push(song.root + iv + 12 * o);
  const leadBase = 12 * song.leadOct;
  const nearestScale = (m: number) => scaleNotes.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
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
          cur = strong ? nearestScale(ch.map((x) => x + 12 + leadBase).reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a))) : stepScale(cur, r.pick([-2, -1, -1, 1, 1, 2, 3]));
        }
        out.push([st, cur, Math.max(1, next - st - (r.chance(0.3) ? 1 : 0))]);
      });
      if (bi === 1 && r.chance(0.5)) out[out.length - 1][2] = 16 - out[out.length - 1][0];
      return out;
    });
  };
  const transpose = (mot: [number, number, number][], ch: number[]) =>
    mot.map(([s, m, l]) => [s, nearestScale(m + (ch[0] - song.root > 6 ? -1 : 1) * 2), l] as [number, number, number]);
  const sec = (prog: number[], name: 'A' | 'B') => {
    const chords = prog.map((d) => chordOf(song, d));
    const len = chords.length === 4 ? 8 : chords.length;
    const full = Array.from({ length: len }, (_, i) => chords[i % chords.length]);
    const m1 = makeMotif([full[0], full[1]], song.density);
    const m2 = makeMotif([full[4 % len], full[5 % len]], song.density);
    const mel: [number, number, number][][] = [m1[0], m1[1], transpose(m1[0], full[2]), transpose(m1[1], full[3]), m2[0], m2[1], makeMotif([full[6 % len]], song.density * 0.8)[0], [[0, nearestScale(full[7 % len][0] + 12 + leadBase), 12]]];
    full.forEach((ch, i) => {
      const counter: [number, number, number][] = [];
      if (song.lead2 && i % 2 === 1) {
        // answering phrase in the gaps (call & response)
        [8, 10, 12, 14].forEach((st, k) => counter.push([st, nearestScale(ch[k % 3] + 24 + leadBase), 2]));
      }
      bars.push({ chord: ch, root: ch[0], section: name, melody: mel[i % mel.length], counter, fill: i === len - 1 });
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
  bossa: { kick: [0, 6, 8, 14], tom: [3, 10], shaker: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  lofi: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  gugak: { kick: [0, 8], janggu: [0, 3, 6, 10, 12, 14], hat: [2, 6, 10, 14] },
  funk: { kick: [0, 3, 8, 11], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  orch: { kick: [0, 8], tom: [0, 6, 8], snare: [4, 12], ohat: [12] },
  march: { kick: [0, 8], snare: [4, 12, 14] },
  none: {},
};
const EXTRA_PAT: Partial<Record<Drum, number[]>> = {
  clap: [4, 12],
  shaker: [0, 2, 4, 6, 8, 10, 12, 14],
  sleigh: [0, 2, 4, 6, 8, 10, 12, 14],
  tamb: [4, 12],
  cowbell: [0, 6, 10],
};

/** Lookahead step sequencer (25 ms tick, 150 ms horizon). */
class MusicPlayer {
  song: SongDef | null = null;
  private bars: Bar[] = [];
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private bus: GainNode | null = null;
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
      setTimeout(() => b.disconnect(), fade * 1000 + 300);
    }
    this.bus = null;
    this.current = '';
  }
  /** +8 % on the final lap (§9.2) */
  setTempo(mul: number) {
    this.targetTempo = mul;
  }
  private tick() {
    const ctx = audio.ctx;
    if (!ctx || !this.song || !this.bus) return;
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
    const s = this.song!;
    const out = this.bus!;
    const ctx = audio.ctx!;
    const bar = this.bars[Math.floor(step / 16)];
    const st = step % 16;
    const spb = 60 / (s.bpm * this.tempoMul) / 4;
    // drums
    const pat = DRUMS[s.drums];
    for (const d of Object.keys(pat) as Drum[]) {
      if (pat[d]!.includes(st)) {
        const v = d === 'hat' ? (st % 4 === 0 ? 0.7 : 0.45) : d === 'kick' ? 1 : 0.8;
        playDrum(ctx, d, t, v, out);
      }
    }
    if (bar.section !== 'I' || st >= 8) for (const d of s.extra ?? []) if (EXTRA_PAT[d]?.includes(st)) playDrum(ctx, d, t, 0.7, out);
    if (bar.fill && st >= 12) playDrum(ctx, st % 2 ? 'snare' : 'tom', t, 0.6, out);
    // bass
    const broot = bar.root - 24;
    if (s.drums === 'four' || s.drums === 'chip') {
      if (st % 2 === 0) playNote(ctx, s.bass, st % 4 === 2 ? broot + 12 : broot, t, spb * 1.6, 0.8, out);
    } else if (s.drums === 'bossa') {
      if ([0, 6, 8, 14].includes(st)) playNote(ctx, s.bass, st === 6 || st === 14 ? broot + 7 : broot, t, spb * 3, 0.8, out);
    } else if (s.drums === 'funk') {
      if ([0, 3, 6, 8, 10, 11, 14].includes(st)) playNote(ctx, s.bass, [6, 14].includes(st) ? broot + 12 : st === 11 ? broot + 10 : broot, t, spb * 1.2, 0.85, out);
    } else if ([0, 6, 8, 12].includes(st)) playNote(ctx, s.bass, st === 12 ? broot + 7 : broot, t, spb * (st === 0 ? 5 : 3), 0.8, out);
    // chords / comping
    const ch = bar.chord;
    switch (s.comp) {
      case 'block':
        if (st === 0 || st === 8) ch.forEach((m) => playNote(ctx, s.chords, m, t, spb * 7, 0.45, out));
        break;
      case 'offbeat':
        if (st % 4 === 2) ch.forEach((m) => playNote(ctx, s.chords, m, t, spb * 1.5, 0.4, out));
        break;
      case 'arp': {
        const seq = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1]];
        if (st % 2 === 0) playNote(ctx, s.chords, seq[(st / 2) % seq.length] + 12, t, spb * 1.6, 0.4, out);
        break;
      }
      case 'strum':
        if ([0, 3, 6, 8, 10, 12, 14].includes(st)) ch.forEach((m, i) => playNote(ctx, s.chords, m + 12, t + i * 0.012, spb * 2, st % 4 === 0 ? 0.55 : 0.35, out));
        break;
      case 'pad':
        if (st === 0) ch.forEach((m) => playNote(ctx, s.chords, m, t, spb * 15.5, 0.6, out));
        break;
    }
    if (s.pad && st === 0) ch.forEach((m) => playNote(ctx, s.pad!, m + 12, t, spb * 15.5, 0.45, out));
    // melody
    for (const [ms, m, l] of bar.melody) if (ms === st) playNote(ctx, s.lead, m, t, spb * l, 0.85, out);
    if (s.lead2) for (const [ms, m, l] of bar.counter) if (ms === st) playNote(ctx, s.lead2, m, t, spb * l, 0.5, out);
    // double the lead an octave up with glock on the B section for sparkle
    if (bar.section === 'B' && s.lead2) for (const [ms, m, l] of bar.melody) if (ms === st) playNote(ctx, s.lead2, m + 12, t, spb * l, 0.3, out);
  }
  /** One-shot jingles (finish fanfare, cute "aww"). */
  jingle(kind: 'fanfare' | 'aww' | 'start') {
    const ctx = audio.ensure();
    const t0 = ctx.currentTime + 0.05;
    const out = audio.music;
    if (kind === 'fanfare') {
      const seq: [number, number, number][] = [[72, 0, 0.12], [72, 0.14, 0.12], [72, 0.28, 0.12], [76, 0.42, 0.3], [79, 0.78, 0.12], [77, 0.92, 0.12], [79, 1.06, 0.12], [84, 1.2, 0.9]];
      for (const [m, t, l] of seq) {
        playNote(ctx, 'brass', m, t0 + t, l, 1, out);
        playNote(ctx, 'glock', m + 12, t0 + t, l, 0.6, out);
      }
      [60, 64, 67, 72].forEach((m) => playNote(ctx, 'strings', m, t0 + 1.2, 1.2, 0.9, out));
      playDrum(ctx, 'kick', t0 + 1.2, 1, out);
      playDrum(ctx, 'ohat', t0 + 1.2, 1, out);
      for (let i = 0; i < 6; i++) playDrum(ctx, 'snare', t0 + 0.9 + i * 0.05, 0.4 + i * 0.1, out);
    } else if (kind === 'aww') {
      const seq: [number, number, number][] = [[79, 0, 0.2], [77, 0.22, 0.2], [76, 0.44, 0.2], [74, 0.66, 0.35], [76, 1.05, 0.6]];
      for (const [m, t, l] of seq) playNote(ctx, 'musicbox', m, t0 + t, l, 1, out);
      [65, 69, 72].forEach((m) => playNote(ctx, 'epiano', m, t0 + 1.05, 0.8, 0.7, out));
    }
  }
}
export const music = new MusicPlayer();
