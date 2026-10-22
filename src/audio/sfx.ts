import { filter, mtof, noiseSrc, osc, playDrum, playNote, type Ctx } from './synth';

/**
 * Toy-like synthesized SFX (§9.3). Rendered once into AudioBuffers (OfflineAudioContext),
 * then played with ±5 % pitch variation. No realistic gunshots/explosions/sirens (§9.1-1).
 */
export interface Recipe {
  len: number;
  vol?: number;
  gain?: number;
  label: string;
  context: string;
  build: (c: Ctx, out: AudioNode) => void;
}
const sweep = (c: Ctx, type: OscillatorType, f0: number, f1: number, t0: number, dur: number, peak: number, out: AudioNode, curve: 'exp' | 'lin' = 'exp') => {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.01, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(out);
  const o = osc(c, type, f0, t0, t0 + dur + 0.02, g);
  if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  else o.frequency.linearRampToValueAtTime(f1, t0 + dur);
  return o;
};
const bell = (c: Ctx, midi: number, t: number, v = 1, out: AudioNode, inst: 'bell' | 'glock' | 'musicbox' = 'glock') => playNote(c, inst, midi, t, 0.4, v, out);
const nburst = (c: Ctx, t: number, dur: number, f: number, q: number, peak: number, out: AudioNode, type: BiquadFilterType = 'bandpass') => {
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  noiseSrc(c, t, t + dur + 0.02, filter(c, type, f, q, g));
  return g;
};
const sparkle = (c: Ctx, t: number, n: number, out: AudioNode, base = 88) => {
  for (let i = 0; i < n; i++) bell(c, base + ((i * 5) % 12) + (i % 2) * 7, t + i * 0.045, 0.45, out, 'musicbox');
};

/** Tight ignition, major-pentatonic sparkle and a rising turbine, with room for the engine. */
const turboLaunch = (c: Ctx, out: AudioNode, power = 1) => {
  sweep(c, 'sine', 155, 62, 0, 0.12, 0.42 * power, out);
  nburst(c, 0, 0.045, 3400, 0.6, 0.16, out, 'highpass');
  const bus = filter(c, 'lowpass', 5200, 0.55, out);
  sweep(c, 'triangle', 180, 1280, 0.015, 0.46, 0.32 * power, bus);
  sweep(c, 'sawtooth', 183, 1296, 0.02, 0.4, 0.065 * power, bus);
  [74, 81, 86, 93].forEach((m, i) => playNote(c, 'marimba', m, 0.035 + i * 0.048, 0.1, 0.85 * power, out));
  bell(c, 88, 0.21, 0.38 * power, out);
  const wind = c.createBiquadFilter();
  wind.type = 'bandpass'; wind.Q.value = 0.65;
  wind.frequency.setValueAtTime(850, 0);
  wind.frequency.exponentialRampToValueAtTime(5700, 0.34);
  wind.frequency.exponentialRampToValueAtTime(2400, 0.8);
  const envelope = c.createGain();
  envelope.gain.setValueAtTime(0.0001, 0);
  envelope.gain.linearRampToValueAtTime(0.28 * power, 0.055);
  envelope.gain.exponentialRampToValueAtTime(0.0001, 0.88);
  wind.connect(envelope).connect(out);
  noiseSrc(c, 0, 0.9, wind);
};

export const SFX_RECIPES = {
  uiHover: { len: 0.12, vol: 0.35, label: '메뉴 호버', context: '메뉴', build: (c, o) => sweep(c, 'sine', 900, 1400, 0, 0.07, 0.6, o) },
  uiClick: { len: 0.2, vol: 0.6, label: '메뉴 클릭 "뽁"', context: '메뉴', build: (c, o) => { sweep(c, 'sine', 520, 1250, 0, 0.06, 0.8, o); sweep(c, 'triangle', 1250, 900, 0.05, 0.1, 0.4, o); } },
  uiBack: { len: 0.3, vol: 0.5, label: '뒤로가기', context: '메뉴', build: (c, o) => { bell(c, 79, 0, 0.6, o); bell(c, 74, 0.08, 0.6, o); } },
  uiError: { len: 0.35, vol: 0.5, label: '불가 "뿌우"', context: '메뉴', build: (c, o) => { sweep(c, 'square', 330, 260, 0, 0.14, 0.25, filter(c, 'lowpass', 1400, 0.5, o)); sweep(c, 'square', 300, 220, 0.15, 0.16, 0.25, filter(c, 'lowpass', 1400, 0.5, o)); } },
  boxPop: { len: 0.45, vol: 0.85, label: '아이템 박스 "뽁!"', context: '아이템 획득', build: (c, o) => { sweep(c, 'sine', 380, 1500, 0, 0.07, 0.9, o); nburst(c, 0, 0.06, 3000, 1, 0.5, o); sparkle(c, 0.06, 4, o, 91); } },
  roulette: { len: 1.3, vol: 0.55, label: '룰렛 "띠리리릭"', context: '아이템 획득', build: (c, o) => { for (let i = 0; i < 18; i++) { const t = i * 0.065; sweep(c, 'square', mtof(84 + ((i * 7) % 12)), mtof(84 + ((i * 7) % 12)) * 1.02, t, 0.04, 0.18, filter(c, 'lowpass', 5000, 0.5, o)); } } },
  itemGet: { len: 0.7, vol: 0.7, label: '아이템 결정 "띵!"', context: '아이템 획득', build: (c, o) => { bell(c, 88, 0, 1, o); bell(c, 95, 0.07, 0.9, o); bell(c, 100, 0.14, 0.7, o); } },
  coin: { len: 0.5, vol: 0.6, label: '별사탕 "짤랑"', context: '코인', build: (c, o) => { bell(c, 100, 0, 0.9, o); bell(c, 107, 0.06, 0.8, o); nburst(c, 0, 0.12, 9000, 2, 0.15, o); } },
  boost: { len: 1.25, vol: 0.8, label: '?? ??? ? ??? ???', context: '???', build: (c, o) => turboLaunch(c, o) },
  pad: { len: 1.15, vol: 0.72, label: '?? ?? ? ?? ??', context: '???', build: (c, o) => turboLaunch(c, o, 0.82) },
  mt1: { len: 0.4, vol: 0.55, label: '미니터보 1단 "띠링"', context: '드리프트', build: (c, o) => bell(c, 91, 0, 1, o) },
  mt2: { len: 0.5, vol: 0.6, label: '미니터보 2단 "띠리링"', context: '드리프트', build: (c, o) => { bell(c, 91, 0, 1, o); bell(c, 95, 0.07, 1, o); } },
  mt3: { len: 0.6, vol: 0.65, label: '미니터보 3단 "띠리리링"', context: '드리프트', build: (c, o) => { bell(c, 91, 0, 1, o); bell(c, 95, 0.06, 1, o); bell(c, 98, 0.12, 1, o); sparkle(c, 0.18, 3, o, 100); } },
  hop: { len: 0.25, vol: 0.45, label: '드리프트 홉 "뽀잉"', context: '드리프트', build: (c, o) => { const os = sweep(c, 'sine', 300, 300, 0, 0.18, 0.7, o); os.frequency.setValueAtTime(300, 0); os.frequency.exponentialRampToValueAtTime(700, 0.07); os.frequency.exponentialRampToValueAtTime(420, 0.18); } },
  drift: { len: 1.0, vol: 0.22, label: '드리프트 끼익(부드럽게)', context: '드리프트', build: (c, o) => { const g = c.createGain(); g.gain.value = 0.5; g.connect(o); noiseSrc(c, 0, 1.0, filter(c, 'bandpass', 2400, 9, g)); osc(c, 'sine', 2400, 0, 1.0, filter(c, 'lowpass', 3000, 1, (() => { const gg = c.createGain(); gg.gain.value = 0.05; gg.connect(o); return gg; })())); } },
  land: { len: 0.3, vol: 0.5, label: '착지 "통"', context: '주행', build: (c, o) => { sweep(c, 'sine', 160, 55, 0, 0.2, 0.9, o); nburst(c, 0, 0.05, 600, 1, 0.3, o); } },
  wall: { len: 0.35, vol: 0.7, label: '벽 충돌 "통!"', context: '주행', build: (c, o) => { sweep(c, 'triangle', 330, 180, 0, 0.16, 0.8, o); sweep(c, 'sine', 120, 60, 0, 0.18, 0.7, o); nburst(c, 0, 0.04, 1800, 1, 0.35, o); } },
  bump: { len: 0.3, vol: 0.6, label: '카트 충돌 "뽕"', context: '주행', build: (c, o) => { sweep(c, 'sine', 500, 200, 0, 0.14, 0.8, o); sweep(c, 'triangle', 700, 300, 0.01, 0.1, 0.4, o); } },
  hit: { len: 0.6, vol: 0.8, label: '피격 "뿅~"', context: '피격', build: (c, o) => { const os = sweep(c, 'square', 1000, 180, 0, 0.45, 0.35, filter(c, 'lowpass', 3000, 0.5, o)); const l = c.createOscillator(); const lg = c.createGain(); l.frequency.value = 18; lg.gain.value = 60; l.connect(lg).connect(os.frequency); l.start(0); l.stop(0.5); } },
  spin: { len: 0.9, vol: 0.55, label: '스핀 "뾰로롱"', context: '피격', build: (c, o) => { for (let i = 0; i < 6; i++) bell(c, 96 - i * 3, i * 0.09, 0.6, o, 'musicbox'); } },
  throw: { len: 0.35, vol: 0.55, label: '투척 "휙"', context: '아이템 사용', build: (c, o) => { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(600, 0); f.frequency.exponentialRampToValueAtTime(2600, 0.2); const g = c.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.linearRampToValueAtTime(0.8, 0.05); g.gain.exponentialRampToValueAtTime(0.0001, 0.3); g.connect(o); f.connect(g); noiseSrc(c, 0, 0.32, f); } },
  jelly: { len: 0.4, vol: 0.65, label: '젤리볼 발사 "뾱"', context: '아이템 사용', build: (c, o) => { sweep(c, 'sine', 200, 900, 0, 0.12, 0.9, o); sweep(c, 'sine', 900, 600, 0.12, 0.15, 0.5, o); } },
  jellyBounce: { len: 0.2, vol: 0.35, label: '젤리 튕김', context: '아이템 사용', build: (c, o) => sweep(c, 'sine', 400, 800, 0, 0.1, 0.7, o) },
  heart: { len: 0.7, vol: 0.65, label: '하트 미사일 발사', context: '아이템 사용', build: (c, o) => { [84, 88, 91, 96].forEach((m, i) => playNote(c, 'square', m, i * 0.06, 0.08, 0.8, filter(c, 'lowpass', 4000, 0.5, o))); } },
  comet: { len: 1.6, vol: 0.7, label: '별똥별 혜성 휘익~', context: '아이템 사용', build: (c, o) => { sweep(c, 'sine', 2400, 500, 0, 1.4, 0.35, o); sparkle(c, 0.1, 10, o, 96); } },
  poof: { len: 0.8, vol: 0.85, label: '팡! (부드러운 폭발)', context: '피격', build: (c, o) => { sweep(c, 'sine', 180, 45, 0, 0.45, 1, o); nburst(c, 0, 0.5, 900, 0.7, 0.7, o, 'lowpass'); sparkle(c, 0.08, 5, o, 93); } },
  shield: { len: 0.9, vol: 0.55, label: '버블 실드', context: '아이템 사용', build: (c, o) => { [79, 83, 86, 91].forEach((m) => playNote(c, 'pad', m, 0, 0.5, 1.4, o)); sweep(c, 'sine', 600, 1600, 0, 0.3, 0.3, o); } },
  shieldBreak: { len: 0.5, vol: 0.6, label: '실드 깨짐 "퐁"', context: '피격', build: (c, o) => { sweep(c, 'sine', 1200, 300, 0, 0.2, 0.7, o); nburst(c, 0, 0.15, 5000, 1, 0.3, o); } },
  star: { len: 1.0, vol: 0.5, label: '무지개 별', context: '아이템 사용', build: (c, o) => { [84, 88, 91, 96, 100, 103].forEach((m, i) => bell(c, m, i * 0.06, 0.8, o)); } },
  shrink: { len: 0.8, vol: 0.6, label: '미니미 번개 "삐융"', context: '아이템 사용', build: (c, o) => { const os = sweep(c, 'square', 1800, 200, 0, 0.6, 0.3, filter(c, 'lowpass', 2500, 0.5, o)); void os; nburst(c, 0, 0.3, 6000, 1, 0.25, o); } },
  cloud: { len: 0.6, vol: 0.55, label: '솜사탕 구름 "퐁퐁"', context: '아이템 사용', build: (c, o) => { for (let i = 0; i < 3; i++) sweep(c, 'sine', 400 + i * 120, 180, i * 0.12, 0.15, 0.6, o); } },
  plop: { len: 0.3, vol: 0.55, label: '설치 "퐁"', context: '아이템 사용', build: (c, o) => { sweep(c, 'sine', 700, 220, 0, 0.12, 0.8, o); } },
  splat: { len: 0.4, vol: 0.6, label: '밟음 "철퍽"', context: '피격', build: (c, o) => { nburst(c, 0, 0.25, 700, 0.8, 0.8, o, 'lowpass'); sweep(c, 'sine', 300, 120, 0, 0.15, 0.6, o); } },
  zap: { len: 0.5, vol: 0.5, label: 'EMP "지직"', context: '고유기', build: (c, o) => { for (let i = 0; i < 6; i++) sweep(c, 'square', 1200 + i * 200, 300, i * 0.05, 0.05, 0.25, filter(c, 'lowpass', 4000, 0.5, o)); } },
  splash: { len: 0.9, vol: 0.6, label: '물보라 "촤악"', context: '고유기/낙하', build: (c, o) => { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, 0); f.frequency.exponentialRampToValueAtTime(800, 0.7); const g = c.createGain(); g.gain.setValueAtTime(0.8, 0); g.gain.exponentialRampToValueAtTime(0.0001, 0.8); g.connect(o); f.connect(g); noiseSrc(c, 0, 0.85, f); } },
  honk: { len: 0.6, vol: 0.55, label: '경적 "빵빵"(장난감)', context: '고유기', build: (c, o) => { for (const t of [0, 0.22]) { playNote(c, 'square', 72, t, 0.14, 1, filter(c, 'lowpass', 1800, 1, o)); playNote(c, 'square', 76, t, 0.14, 0.8, filter(c, 'lowpass', 1800, 1, o)); } } },
  siren: { len: 1.2, vol: 0.4, label: '장난감 사이렌 "삐뽀"', context: '고유기', build: (c, o) => { for (let i = 0; i < 4; i++) playNote(c, 'triangle', i % 2 ? 81 : 86, i * 0.28, 0.26, 1, o); } },
  stomp: { len: 0.8, vol: 0.8, label: '점프 스톰프 "쿵"', context: '고유기', build: (c, o) => { sweep(c, 'sine', 120, 35, 0, 0.6, 1, o); playDrum(c, 'tom', 0, 1, o); nburst(c, 0, 0.4, 400, 0.6, 0.5, o, 'lowpass'); } },
  skill: { len: 0.9, vol: 0.7, label: '고유기 발동 "짜잔!"', context: '고유기', build: (c, o) => { [72, 76, 79, 84].forEach((m) => playNote(c, 'brass', m, 0, 0.35, 1, o)); [84, 88, 91].forEach((m, i) => bell(c, m + 12, 0.1 + i * 0.05, 0.7, o)); } },
  beep: { len: 0.3, vol: 0.7, label: '카운트다운 "삐"', context: '레이스 시작', build: (c, o) => playNote(c, 'square', 81, 0, 0.18, 1, filter(c, 'lowpass', 3000, 0.5, o)) },
  go: { len: 1.0, vol: 0.85, label: '출발 "빠앙!"', context: '레이스 시작', build: (c, o) => { playNote(c, 'square', 93, 0, 0.6, 1, filter(c, 'lowpass', 4000, 0.5, o)); playNote(c, 'square', 88, 0, 0.6, 0.6, filter(c, 'lowpass', 4000, 0.5, o)); sparkle(c, 0.05, 6, o, 96); } },
  lap: { len: 0.8, vol: 0.6, label: '랩 통과', context: '레이스', build: (c, o) => { [84, 88, 91, 96].forEach((m, i) => bell(c, m, i * 0.07, 0.9, o)); } },
  finalLap: { len: 1.6, vol: 0.75, label: '마지막 랩! 징글', context: '레이스', build: (c, o) => { [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.6], [84, 0.72]].forEach(([m, t]) => playNote(c, 'brass', m, t, 0.2, 1, o)); playDrum(c, 'snare', 0.36, 1, o); playDrum(c, 'kick', 0.72, 1, o); playDrum(c, 'clap', 0.72, 1, o); } },
  wrongWay: { len: 0.8, vol: 0.5, label: '역주행 경고 "삐뽀"', context: '레이스', build: (c, o) => { playNote(c, 'triangle', 88, 0, 0.16, 1, o); playNote(c, 'triangle', 83, 0.2, 0.16, 1, o); playNote(c, 'triangle', 88, 0.4, 0.16, 1, o); } },
  fairy: { len: 1.2, vol: 0.55, label: '구름 요정 뭉게', context: '낙하', build: (c, o) => { [96, 100, 103, 108, 103, 100].forEach((m, i) => bell(c, m, i * 0.08, 0.7, o, 'musicbox')); } },
  fall: { len: 0.9, vol: 0.55, label: '낙하 "히잉~"', context: '낙하', build: (c, o) => sweep(c, 'triangle', 900, 120, 0, 0.8, 0.5, o) },
  trick: { len: 0.6, vol: 0.6, label: '점프 트릭 "야호"', context: '주행', build: (c, o) => { [91, 95, 98].forEach((m, i) => bell(c, m, i * 0.05, 0.9, o)); sweep(c, 'sine', 500, 1200, 0, 0.15, 0.4, o); } },
  slip: { len: 0.4, vol: 0.4, label: '슬립스트림 "쉬익"', context: '주행', build: (c, o) => nburst(c, 0, 0.35, 4500, 0.8, 0.5, o, 'highpass') },
  buy: { len: 1.2, vol: 0.7, label: '구매 "띵동~+반짝"', context: '상점', build: (c, o) => { bell(c, 84, 0, 1, o, 'bell'); bell(c, 79, 0.28, 1, o, 'bell'); sparkle(c, 0.5, 6, o, 96); } },
  unlock: { len: 1.2, vol: 0.75, label: '해금 "짜잔!"', context: '해금', build: (c, o) => { [[67, 0], [72, 0.1]].forEach(([m, t]) => [0, 4, 7].forEach((iv) => playNote(c, 'brass', m + iv, t, t ? 0.5 : 0.08, 1, o))); playDrum(c, 'clap', 0.1, 1, o); sparkle(c, 0.2, 8, o, 96); } },
  levelUp: { len: 1.4, vol: 0.7, label: '레벨업', context: '보상', build: (c, o) => { [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => bell(c, m, i * 0.07, 0.9, o)); playNote(c, 'pad', 84, 0.5, 0.6, 1, o); } },
  goldTick: { len: 0.15, vol: 0.35, label: '골드 카운트업 "짤"', context: '결과', build: (c, o) => bell(c, 103, 0, 0.8, o, 'musicbox') },
  confetti: { len: 0.9, vol: 0.55, label: '컨페티 팡', context: '결과', build: (c, o) => { nburst(c, 0, 0.15, 2500, 0.8, 0.6, o); sparkle(c, 0.08, 10, o, 93); } },
  freeze: { len: 0.7, vol: 0.55, label: '빙결 "쨍"', context: '피격', build: (c, o) => { [100, 107, 112].forEach((m, i) => bell(c, m, i * 0.03, 0.8, o, 'glock')); nburst(c, 0, 0.3, 8000, 2, 0.3, o); } },
  sleep: { len: 1.0, vol: 0.45, label: '쿨쿨', context: '피격', build: (c, o) => { sweep(c, 'sine', 300, 200, 0, 0.45, 0.4, o); sweep(c, 'sine', 300, 200, 0.5, 0.45, 0.4, o); } },
  teleport: { len: 0.8, vol: 0.6, label: '순간이동 "슝"', context: '아이템 사용', build: (c, o) => { sweep(c, 'sine', 200, 2400, 0, 0.35, 0.5, o); sweep(c, 'sine', 2400, 300, 0.35, 0.35, 0.4, o); } },
  rocketStart: { len: 1.3, vol: 0.82, label: '?? ???', context: '??? ??', build: (c, o) => { turboLaunch(c, o, 1.15); playDrum(c, 'clap', 0.055, 0.35, o); } },
  overheat: { len: 0.8, vol: 0.6, label: '엔진 과열 "푸쉬쉬"', context: '레이스 시작', build: (c, o) => { nburst(c, 0, 0.7, 3000, 0.5, 0.6, o, 'highpass'); sweep(c, 'square', 400, 100, 0, 0.5, 0.2, filter(c, 'lowpass', 1500, 0.5, o)); } },
} satisfies Record<string, Recipe>;
export type SfxId = keyof typeof SFX_RECIPES;
