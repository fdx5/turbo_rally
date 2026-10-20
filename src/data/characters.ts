import type { Stats } from './vehicles';

export type CharId = 'momo' | 'mungchi' | 'piyo' | 'lulu' | 'toto' | 'piko' | 'kkang' | 'hana';
export type Expression = 'neutral' | 'happy' | 'angry' | 'surprised' | 'win' | 'lose';

export interface Body {
  headR: number;
  torsoR: number;
  torsoH: number;
  legLen: number;
  armLen: number;
}
export type VoiceLine =
  | 'select'
  | 'start'
  | 'boost'
  | 'hitOther'
  | 'ouch'
  | 'overtake'
  | 'overtaken'
  | 'win'
  | 'lose'
  | 'thanks'
  | 'skill';

export interface CharacterDef {
  id: CharId;
  name: string;
  motif: string;
  weightClass: '경량' | '중간' | '중량' | '중량급';
  mods: Partial<Stats>;
  passive: { id: string; text: string };
  personality: 'aggressive' | 'defensive' | 'balanced' | 'tricky';
  colors: { main: string; sub: string; accent: string };
  body: Body;
  voice: { base: number; ttsPitch: number; ttsRate: number; wave: OscillatorType; formant: number };
  pose: 'jump' | 'wave' | 'spin' | 'flex' | 'bow' | 'wiggle' | 'roar' | 'wink';
  lines: Record<VoiceLine, string>;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'momo', name: '모모', motif: '분홍 토끼 소녀', weightClass: '경량', mods: { accel: 1, weight: -1 },
    passive: { id: 'trickBoost', text: '점프대 트릭 부스트 +15%' }, personality: 'balanced',
    colors: { main: '#FFC8DD', sub: '#FFF6E9', accent: '#FF8FB8' },
    body: { headR: 0.62, torsoR: 0.3, torsoH: 0.34, legLen: 0.24, armLen: 0.3 },
    voice: { base: 520, ttsPitch: 1.9, ttsRate: 1.15, wave: 'triangle', formant: 2600 }, pose: 'jump',
    lines: { select: '야호~! 모모 간다!', start: '준비 완료! 출발~!', boost: '슝슝~!', hitOther: '맞았다~ 미안해!', ouch: '아야~!', overtake: '먼저 갈게~!', overtaken: '앗, 기다려~!', win: '모모가 일등이야! 야호~!', lose: '다음엔 꼭 이길 거야!', thanks: '고마워~! 예쁘다!', skill: '이거나 받아!' },
  },
  {
    id: 'mungchi', name: '뭉치', motif: '갈색 아기곰', weightClass: '중량급', mods: { weight: 2, accel: -1, handling: -1 },
    passive: { id: 'heavyBody', text: '충돌 시 밀림 -25%' }, personality: 'defensive',
    colors: { main: '#C89B7B', sub: '#F2D8C2', accent: '#8E5E43' },
    body: { headR: 0.54, torsoR: 0.52, torsoH: 0.44, legLen: 0.24, armLen: 0.3 },
    voice: { base: 150, ttsPitch: 0.55, ttsRate: 0.85, wave: 'sine', formant: 900 }, pose: 'flex',
    lines: { select: '우와~ 뭉치가 간다!', start: '천천히~ 하지만 힘차게~', boost: '힘내자~!', hitOther: '어이쿠, 미안해~', ouch: '아이고~', overtake: '실례할게~', overtaken: '어, 괜찮아~', win: '뭉치가 해냈다아~!', lose: '꿀 먹고 다시 해볼래~', thanks: '고마워~ 따뜻하다~', skill: '영차, 영차!' },
  },
  {
    id: 'piyo', name: '삐요', motif: '노랑 병아리', weightClass: '경량', mods: { handling: 1, weight: -1 },
    passive: { id: 'quickCharge', text: '미니터보 충전 10% 빠름' }, personality: 'defensive',
    colors: { main: '#FDE68A', sub: '#FFF6C9', accent: '#FFA94D' },
    body: { headR: 0.44, torsoR: 0.44, torsoH: 0.16, legLen: 0.14, armLen: 0.2 },
    voice: { base: 760, ttsPitch: 2.0, ttsRate: 1.35, wave: 'square', formant: 3200 }, pose: 'wiggle',
    lines: { select: '삐약삐약! 출발!', start: '삐약삐약, 간다!', boost: '빠르다 빨라!', hitOther: '맞췄다, 삐약삐약!', ouch: '아야야!', overtake: '삐약삐약 먼저~!', overtaken: '앗, 무서워!', win: '삐요가 일등이야!', lose: '아쉽다, 다시 할래!', thanks: '고마워, 정말 고마워!', skill: '삐약 공격!' },
  },
  {
    id: 'lulu', name: '루루', motif: '하얀 고양이', weightClass: '중간', mods: {},
    passive: { id: 'skillCharge', text: '고유기 게이지 +10% 충전' }, personality: 'aggressive',
    colors: { main: '#FFFFFF', sub: '#FFD9E8', accent: '#B9A6E8' },
    body: { headR: 0.58, torsoR: 0.27, torsoH: 0.44, legLen: 0.3, armLen: 0.32 },
    voice: { base: 430, ttsPitch: 1.5, ttsRate: 1.05, wave: 'triangle', formant: 2300 }, pose: 'wink',
    lines: { select: '후훗, 1등은 내 거다냥!', start: '각오하라냥!', boost: '달려간다냥!', hitOther: '냥냥, 명중이다냥!', ouch: '아야, 아프다냥!', overtake: '느리다냥~', overtaken: '흥, 두고 보자냥!', win: '역시 루루가 최고다냥~', lose: '오늘은 봐준 거다냥!', thanks: '흥… 고맙다냥.', skill: '고양이 펀치!' },
  },
  {
    id: 'toto', name: '토토', motif: '크림색 강아지(시바)', weightClass: '중간', mods: {},
    passive: { id: 'coinMax', text: '코인 최대 12개' }, personality: 'aggressive',
    colors: { main: '#F4D3A1', sub: '#FFF6E9', accent: '#E89B5B' },
    body: { headR: 0.53, torsoR: 0.34, torsoH: 0.4, legLen: 0.28, armLen: 0.3 },
    voice: { base: 330, ttsPitch: 1.35, ttsRate: 1.15, wave: 'sawtooth', formant: 1800 }, pose: 'wave',
    lines: { select: '멍멍! 렛츠 고!', start: '멍! 달린다!', boost: '와와와왕~!', hitOther: '멍! 맞췄다!', ouch: '아야, 아파라!', overtake: '멍멍 먼저 간다!', overtaken: '으르릉, 기다려!', win: '토토 우승이다 멍멍~!', lose: '멍… 한 판 더!', thanks: '멍멍! 최고야!', skill: '멍멍 공격!' },
  },
  {
    id: 'piko', name: '피코', motif: '하늘색 아기펭귄', weightClass: '중량', mods: { weight: 1, speed: 1, accel: -1, offroad: -1 },
    passive: { id: 'iceWalker', text: '빙판·물 구간 감속 무시' }, personality: 'tricky',
    colors: { main: '#8EC5FF', sub: '#FFFFFF', accent: '#FFB86B' },
    body: { headR: 0.4, torsoR: 0.5, torsoH: 0.44, legLen: 0.12, armLen: 0.26 },
    voice: { base: 380, ttsPitch: 1.6, ttsRate: 0.95, wave: 'triangle', formant: 2000 }, pose: 'spin',
    lines: { select: '히히~ 미끄러져 간다~!', start: '뒤뚱뒤뚱 출발~', boost: '쭉쭉 달려라!', hitOther: '히히, 맞았지?', ouch: '으악, 미끄러워!', overtake: '미끄러져 추월~', overtaken: '어라라~?', win: '피코 일등이다 히히~', lose: '히히, 재밌었다~', thanks: '히히 고마워~', skill: '얼음 땡!' },
  },
  {
    id: 'kkang', name: '크앙이', motif: '민트 아기공룡', weightClass: '중량급', mods: { weight: 2, speed: 1, handling: -2, accel: -1 },
    passive: { id: 'quickRecover', text: '피격 후 회복 시간 -20%' }, personality: 'aggressive',
    colors: { main: '#A8F0B4', sub: '#FFF6E9', accent: '#6CC57C' },
    body: { headR: 0.5, torsoR: 0.46, torsoH: 0.5, legLen: 0.24, armLen: 0.16 },
    voice: { base: 200, ttsPitch: 0.8, ttsRate: 1.0, wave: 'sawtooth', formant: 1100 }, pose: 'roar',
    lines: { select: '크앙! 다 비켜!', start: '크앙! 간다!', boost: '크앙, 크앙!', hitOther: '크앙! 맞았지!', ouch: '크앙?!', overtake: '비켜비켜~!', overtaken: '크르르… 기다려!', win: '크아앙! 내가 왕이다!', lose: '크앙… 다음엔 이긴다!', thanks: '크앙! 멋지다!', skill: '공룡 파워!' },
  },
  {
    id: 'hana', name: '하나', motif: '주황 아기여우', weightClass: '경량', mods: { drift: 1, weight: -1 },
    passive: { id: 'doubleItem', text: '아이템 룰렛 10% 확률로 2개 획득' }, personality: 'tricky',
    colors: { main: '#FFB677', sub: '#FFF6E9', accent: '#E8743B' },
    body: { headR: 0.48, torsoR: 0.26, torsoH: 0.52, legLen: 0.36, armLen: 0.34 },
    voice: { base: 470, ttsPitch: 1.65, ttsRate: 1.1, wave: 'triangle', formant: 2400 }, pose: 'bow',
    lines: { select: '에헤헤~ 따라올 수 있으면 와 봐!', start: '에헤헤, 시작해 볼까?', boost: '바람처럼 간다!', hitOther: '에헤헤, 작전 성공~', ouch: '아야, 아파!', overtake: '에헤헤 안녕~', overtaken: '어머, 제법인데?', win: '에헤헤~ 내 작전대로야!', lose: '음, 다음 작전 짜야지~', thanks: '에헤헤 고마워~', skill: '여우비~!' },
  },
];
export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<CharId, CharacterDef>;
