import type { Vec3T } from '../tracks/path';

export type ThemeId = 'candy' | 'hangang' | 'neon' | 'hanok' | 'construction' | 'icecream' | 'jeju' | 'rainbow';
export type SurfaceName = 'dirt' | 'ice' | 'water' | 'choco' | 'sand';

export type HazardDef =
  | { type: 'roller'; model: 'donut' | 'snowball' | 'tangerine' | 'gourd'; u: number; period: number; radius: number }
  | { type: 'crosser'; model: 'duckboat' | 'bus'; u: number; period: number; radius: number }
  | { type: 'swinger'; model: 'crane'; u: number; period: number; len: number }
  | { type: 'dropper'; model: 'crate'; u0: number; u1: number; interval: number }
  | { type: 'spinner'; model: 'stars'; u: number; period: number; len: number }
  | { type: 'wave'; u0: number; u1: number; period: number }
  | { type: 'kite'; u: number; period: number }
  | { type: 'downhill'; model: 'gourd' | 'snowball' | 'tangerine'; u0: number; u1: number; interval: number; radius: number };

export interface ShortcutDef {
  fromU: number;
  toU: number;
  via: Vec3T[];
  width: number;
  surface: SurfaceName | 'road';
  boostPad?: boolean;
}

export interface TrackDef {
  id: string;
  no: number;
  name: string;
  theme: ThemeId;
  bpm: number;
  desc: string;
  points: Vec3T[];
  width: number | number[];
  shoulder?: number;
  boostPads: { u: number; t: number }[];
  ramps: { u: number; len: number; h: number; t0?: number; t1?: number }[];
  itemRows: number[];
  coins: { u: number; t: number; n: number }[];
  zones: { u0: number; u1: number; t0: number; t1: number; surface: SurfaceName }[];
  noWall?: { u0: number; u1: number; side: 'L' | 'R' | 'both' }[];
  gaps?: { u0: number; u1: number }[];
  shortcuts: ShortcutDef[];
  hazards: HazardDef[];
  lowGravity?: { u0: number; u1: number }[];
  tunnel?: { u0: number; u1: number }[];
  bridge?: { u0: number; u1: number }[];
  voidWorld?: boolean;
  water?: { y: number; color: string; area?: 'all' | 'side' };
  medals: { gold: number; silver: number; bronze: number };
  par: number;
}

/** Points are written as [x, y, z]; helper flips designer-friendly (x, z, y). */
const SC = 1.35;
const P = (x: number, z: number, y = 0): Vec3T => [x * SC, y, z * SC];

export const TRACKS: TrackDef[] = [
  {
    id: 't1', no: 1, name: '캔디 쿠키 타운', theme: 'candy', bpm: 140,
    desc: '쿠키 집과 막대사탕 가로수 사이를 달려요. 굴러다니는 대형 도넛 조심!',
    points: [
      P(0, 0), P(90, 0), P(160, -12, 1), P(208, -62, 3), P(214, -128, 4), P(176, -178, 3), P(112, -190, 2),
      P(66, -160, 6), P(24, -138, 10), P(-26, -160, 8), P(-84, -184, 4), P(-142, -158, 2), P(-168, -96),
      P(-140, -36), P(-78, -4),
    ],
    width: 19,
    boostPads: [{ u: 0.18, t: -3 }, { u: 0.55, t: 3 }, { u: 0.84, t: 0 }],
    ramps: [{ u: 0.47, len: 9, h: 2.2, t0: -6, t1: 6 }],
    itemRows: [0.1, 0.36, 0.62, 0.88],
    coins: [{ u: 0.05, t: 4, n: 5 }, { u: 0.28, t: -5, n: 5 }, { u: 0.7, t: 0, n: 6 }, { u: 0.93, t: -4, n: 4 }],
    zones: [{ u0: 0.6, u1: 0.66, t0: 4, t1: 30, surface: 'choco' }, { u0: 0.22, u1: 0.27, t0: -30, t1: -5, surface: 'choco' }],
    shortcuts: [{ fromU: 0.255, toU: 0.335, via: [P(196, -150, 3.5)], width: 9, surface: 'choco', boostPad: false }],
    hazards: [
      { type: 'roller', model: 'donut', u: 0.42, period: 4.2, radius: 2.4 },
      { type: 'roller', model: 'donut', u: 0.76, period: 5.0, radius: 2.4 },
    ],
    medals: { gold: 133000, silver: 145000, bronze: 160000 }, par: 149000,
  },
  {
    id: 't2', no: 2, name: '한강 벚꽃 피크닉 파크', theme: 'hangang', bpm: 138,
    desc: '벚꽃 비가 내리는 한강 공원! 오리배 가족과 강변 점프를 즐겨요.',
    points: [
      P(0, 0), P(110, 0), P(190, 10), P(240, 50), P(250, 110), P(210, 150, 2), P(140, 158, 6), P(70, 150, 8),
      P(0, 156, 6), P(-70, 150, 2), P(-130, 120), P(-150, 60), P(-110, 14), P(-50, 0),
    ],
    width: 19,
    boostPads: [{ u: 0.08, t: 0 }, { u: 0.66, t: -3 }],
    ramps: [{ u: 0.34, len: 10, h: 2.6, t0: -7, t1: 7 }, { u: 0.8, len: 8, h: 1.8, t0: -9, t1: -1 }],
    itemRows: [0.14, 0.4, 0.6, 0.9],
    coins: [{ u: 0.03, t: 0, n: 6 }, { u: 0.25, t: 5, n: 5 }, { u: 0.5, t: -4, n: 5 }, { u: 0.72, t: 4, n: 5 }],
    zones: [],
    noWall: [{ u0: 0.45, u1: 0.6, side: 'L' }],
    bridge: [{ u0: 0.44, u1: 0.62 }],
    shortcuts: [{ fromU: 0.83, toU: 0.95, via: [P(-128, 40), P(-90, 4)], width: 8, surface: 'dirt', boostPad: true }],
    hazards: [
      { type: 'crosser', model: 'duckboat', u: 0.2, period: 6, radius: 2.6 },
      { type: 'crosser', model: 'duckboat', u: 0.72, period: 7, radius: 2.6 },
    ],
    water: { y: -3, color: '#8FD3F4', area: 'side' },
    medals: { gold: 134000, silver: 146000, bronze: 161000 }, par: 150000,
  },
  {
    id: 't3', no: 3, name: '서울 네온 시티', theme: 'neon', bpm: 150,
    desc: '파스텔 네온이 반짝이는 서울의 밤! 교차로 버스와 터널 부스트.',
    points: [
      P(0, 0), P(120, 0), P(150, -20), P(152, -90), P(130, -118), P(60, -120), P(36, -140), P(34, -200),
      P(10, -226), P(-70, -228), P(-100, -200, 4), P(-104, -130, 8), P(-130, -100, 8), P(-170, -86, 4),
      P(-180, -40), P(-150, -6), P(-80, 0),
    ],
    width: 18,
    boostPads: [{ u: 0.29, t: 0 }, { u: 0.62, t: -3 }, { u: 0.64, t: 3 }, { u: 0.93, t: 0 }],
    ramps: [{ u: 0.75, len: 9, h: 2.2, t0: -6, t1: 6 }],
    itemRows: [0.12, 0.38, 0.56, 0.84],
    coins: [{ u: 0.06, t: -4, n: 5 }, { u: 0.22, t: 3, n: 5 }, { u: 0.48, t: 0, n: 6 }, { u: 0.9, t: 3, n: 4 }],
    zones: [],
    tunnel: [{ u0: 0.58, u1: 0.68 }],
    shortcuts: [{ fromU: 0.36, toU: 0.5, via: [P(56, -168), P(-8, -192)], width: 8, surface: 'road', boostPad: true }],
    hazards: [
      { type: 'crosser', model: 'bus', u: 0.2, period: 7, radius: 3.4 },
      { type: 'crosser', model: 'bus', u: 0.47, period: 8, radius: 3.4 },
    ],
    medals: { gold: 140000, silver: 152000, bronze: 168000 }, par: 156000,
  },
  {
    id: 't4', no: 4, name: '한옥마을 전통시장', theme: 'hanok', bpm: 145,
    desc: '기와지붕과 초롱 사이 골목길! 날아다니는 연과 굴러오는 박을 피해요.',
    points: [
      P(0, 0), P(80, 0), P(130, 20), P(150, 70), P(120, 110), P(70, 100), P(40, 130), P(50, 180),
      P(10, 220, 3), P(-60, 220, 6), P(-110, 180, 6), P(-100, 120, 3), P(-140, 80), P(-130, 30), P(-70, 0),
    ],
    width: [17, 17, 16, 15, 14, 14, 15, 16, 17, 17, 16, 15, 16, 17, 17],
    boostPads: [{ u: 0.06, t: 0 }, { u: 0.55, t: 0 }],
    ramps: [{ u: 0.62, len: 8, h: 2.0, t0: -6, t1: 6 }],
    itemRows: [0.13, 0.33, 0.58, 0.82],
    coins: [{ u: 0.02, t: -3, n: 5 }, { u: 0.27, t: 0, n: 5 }, { u: 0.45, t: 3, n: 5 }, { u: 0.75, t: -3, n: 5 }],
    zones: [],
    shortcuts: [{ fromU: 0.19, toU: 0.4, via: [P(118, 88), P(84, 124), P(60, 150)], width: 7, surface: 'road', boostPad: true }],
    hazards: [
      { type: 'kite', u: 0.3, period: 3.6 },
      { type: 'kite', u: 0.9, period: 4.4 },
      { type: 'downhill', model: 'gourd', u0: 0.66, u1: 0.74, interval: 2.8, radius: 1.6 },
    ],
    medals: { gold: 130000, silver: 141000, bronze: 156000 }, par: 145000,
  },
  {
    id: 't5', no: 5, name: '뚝딱뚝딱 공사장', theme: 'construction', bpm: 148,
    desc: '크레인 빔이 휙휙! 모래 언덕을 넘고 덤프 낙하물을 피해요.',
    points: [
      P(0, 0), P(100, 0, 2), P(160, -30, 6), P(180, -90, 10), P(150, -140, 10), P(90, -150, 6), P(50, -120, 2),
      P(0, -130), P(-40, -170, 4), P(-100, -175, 8), P(-150, -130, 6), P(-150, -60, 2), P(-100, -20), P(-50, -4),
    ],
    width: 19,
    boostPads: [{ u: 0.15, t: 0 }, { u: 0.5, t: 3 }, { u: 0.86, t: -2 }],
    ramps: [{ u: 0.24, len: 9, h: 2.4, t0: -7, t1: 7 }, { u: 0.68, len: 10, h: 2.8, t0: -6, t1: 6 }],
    itemRows: [0.08, 0.32, 0.56, 0.78],
    coins: [{ u: 0.04, t: 0, n: 6 }, { u: 0.42, t: -4, n: 5 }, { u: 0.62, t: 4, n: 5 }, { u: 0.92, t: 0, n: 5 }],
    zones: [{ u0: 0.38, u1: 0.46, t0: -30, t1: -2, surface: 'sand' }, { u0: 0.88, u1: 0.95, t0: 3, t1: 30, surface: 'sand' }],
    shortcuts: [{ fromU: 0.44, toU: 0.55, via: [P(10, -150, 1)], width: 9, surface: 'sand', boostPad: false }],
    hazards: [
      { type: 'swinger', model: 'crane', u: 0.12, period: 5.5, len: 16 },
      { type: 'swinger', model: 'crane', u: 0.6, period: 6.5, len: 16 },
      { type: 'dropper', model: 'crate', u0: 0.3, u1: 0.36, interval: 1.6 },
    ],
    medals: { gold: 138000, silver: 150000, bronze: 166000 }, par: 154000,
  },
  {
    id: 't6', no: 6, name: '아이스크림 설원', theme: 'icecream', bpm: 152,
    desc: '아이스크림 산과 오로라! 빙판에서 미끄러지고 눈덩이가 굴러와요.',
    points: [
      P(0, 0), P(100, 0), P(170, 20, 2), P(210, 80, 6), P(190, 150, 8), P(120, 170, 6), P(60, 140, 3),
      P(20, 170, 3), P(-40, 200, 6), P(-110, 180, 8), P(-150, 120, 4), P(-130, 60), P(-70, 10),
    ],
    width: 20,
    boostPads: [{ u: 0.1, t: 0 }, { u: 0.45, t: -3 }, { u: 0.9, t: 2 }],
    ramps: [{ u: 0.55, len: 9, h: 2.4, t0: -7, t1: 7 }],
    itemRows: [0.15, 0.38, 0.62, 0.84],
    coins: [{ u: 0.05, t: 3, n: 5 }, { u: 0.3, t: 0, n: 6 }, { u: 0.7, t: -3, n: 5 }, { u: 0.96, t: 0, n: 4 }],
    zones: [{ u0: 0.27, u1: 0.36, t0: -11, t1: 11, surface: 'ice' }, { u0: 0.74, u1: 0.8, t0: -11, t1: 11, surface: 'ice' }],
    bridge: [{ u0: 0.6, u1: 0.68 }],
    noWall: [{ u0: 0.61, u1: 0.67, side: 'both' }],
    shortcuts: [{ fromU: 0.47, toU: 0.56, via: [P(80, 160, 4)], width: 8, surface: 'dirt', boostPad: true }],
    hazards: [
      { type: 'downhill', model: 'snowball', u0: 0.18, u1: 0.26, interval: 3, radius: 2.0 },
      { type: 'roller', model: 'snowball', u: 0.86, period: 4.6, radius: 2.0 },
    ],
    water: { y: -6, color: '#B9E6FF', area: 'side' },
    medals: { gold: 144000, silver: 156000, bronze: 173000 }, par: 160000,
  },
  {
    id: 't7', no: 7, name: '제주 트로피컬 비치', theme: 'jeju', bpm: 155,
    desc: '돌하르방과 귤밭, 파도가 밀려오는 해변! 해안 점프로 날아올라요.',
    points: [
      P(0, 0), P(100, 0), P(180, 10), P(230, 60), P(240, 130, 2), P(200, 180, 4), P(130, 190, 6), P(80, 160, 2),
      P(30, 175), P(-40, 200), P(-110, 175), P(-140, 110, 2), P(-120, 50), P(-60, 6),
    ],
    width: 19,
    boostPads: [{ u: 0.06, t: 0 }, { u: 0.4, t: 3 }, { u: 0.72, t: -3 }],
    ramps: [{ u: 0.44, len: 10, h: 3.0, t0: -7, t1: 7 }],
    itemRows: [0.12, 0.34, 0.58, 0.82],
    coins: [{ u: 0.03, t: -3, n: 5 }, { u: 0.22, t: 3, n: 5 }, { u: 0.52, t: 0, n: 6 }, { u: 0.9, t: 0, n: 5 }],
    zones: [{ u0: 0.6, u1: 0.72, t0: 6, t1: 30, surface: 'sand' }],
    noWall: [{ u0: 0.46, u1: 0.52, side: 'R' }],
    shortcuts: [{ fromU: 0.86, toU: 0.98, via: [P(-118, 70), P(-80, 20)], width: 8, surface: 'sand', boostPad: true }],
    hazards: [
      { type: 'wave', u0: 0.14, u1: 0.24, period: 6 },
      { type: 'downhill', model: 'tangerine', u0: 0.62, u1: 0.7, interval: 2.2, radius: 1.3 },
    ],
    water: { y: -2.5, color: '#7FDBEA', area: 'all' },
    medals: { gold: 136000, silver: 148000, bronze: 164000 }, par: 152000,
  },
  {
    id: 't8', no: 8, name: '구름 위 무지개 성', theme: 'rainbow', bpm: 165,
    desc: '하늘 섬 위 무지개 다리! 끊어진 다리를 점프하고 반중력 구간을 날아요.',
    points: [
      P(0, 0, 20), P(110, 0, 20), P(190, -20, 24), P(240, -80, 30), P(230, -150, 36), P(170, -190, 40),
      P(90, -180, 40), P(40, -140, 34), P(-20, -150, 30), P(-90, -190, 32), P(-160, -160, 28), P(-180, -90, 24),
      P(-140, -30, 21), P(-70, -2, 20),
    ],
    width: 18,
    boostPads: [{ u: 0.12, t: 0 }, { u: 0.33, t: 0 }, { u: 0.58, t: 0 }, { u: 0.88, t: 0 }],
    ramps: [{ u: 0.36, len: 10, h: 2.6, t0: -8, t1: 8 }, { u: 0.62, len: 10, h: 2.6, t0: -8, t1: 8 }],
    itemRows: [0.08, 0.27, 0.5, 0.76],
    coins: [{ u: 0.04, t: 0, n: 6 }, { u: 0.2, t: -3, n: 5 }, { u: 0.46, t: 3, n: 5 }, { u: 0.82, t: 0, n: 6 }],
    zones: [],
    gaps: [{ u0: 0.37, u1: 0.385 }, { u0: 0.625, u1: 0.64 }],
    noWall: [{ u0: 0.3, u1: 0.42, side: 'both' }, { u0: 0.58, u1: 0.68, side: 'both' }],
    lowGravity: [{ u0: 0.44, u1: 0.54 }],
    shortcuts: [],
    hazards: [
      { type: 'spinner', model: 'stars', u: 0.22, period: 4, len: 9 },
      { type: 'spinner', model: 'stars', u: 0.72, period: 3.4, len: 9 },
    ],
    voidWorld: true,
    medals: { gold: 147000, silver: 160000, bronze: 177000 }, par: 164000,
  },
];
export const TRACK_BY_ID: Record<string, TrackDef> = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
