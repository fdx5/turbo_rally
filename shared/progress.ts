/**
 * Player progression model + pure state transitions (race results, purchases, missions,
 * achievements, attendance, lucky roulette). Used by the guest client and by the API.
 */
import { COSMETICS, COSMETIC_BY_ID, WELCOME_HAT, type CosCategory } from '../src/data/cosmetics';
import { WEAPONS, WEAPON_BY_ID } from '../src/data/items';
import { TRACKS } from '../src/data/tracks';
import { CHARACTERS, type CharId } from '../src/data/characters';
import {
  START_TRACKS,
  START_VEHICLES,
  addXp,
  computeReward,
  countStars,
  levelUpGold,
  medalFor,
  starBits,
  trackUnlockedBy,
  vehiclePrice,
  vehiclesForLevel,
  vehiclesForStars,
  xpForRace,
  type Difficulty,
  type Mode,
  type RewardLine,
} from './economy';

export interface RaceRecord {
  id: string;
  mode: Mode;
  trackId: string;
  difficulty: Difficulty;
  charId: CharId;
  vehicleId: string;
  position: number;
  totalMs: number;
  bestLapMs: number;
  lapTimes: number[];
  coins: number;
  gold: number;
  at: number;
  entrants: { charId: string; vehicleId: string; name: string; isPlayer: boolean; position: number; totalMs: number }[];
  items: Record<string, { used: number; hits: number; gotHit: number }>;
}
export interface LedgerEntry {
  t: number;
  delta: number;
  reason: string;
  ref?: string;
}
export interface MissionState {
  id: string;
  progress: number;
  claimed: boolean;
}
export interface Profile {
  v: 1;
  userId: string | null;
  username: string | null;
  nickname: string;
  guestId: string;
  gold: number;
  xp: number;
  level: number;
  goldEarned: number;
  goldSpent: number;
  selectedChar: CharId;
  selectedVehicle: string;
  unlockedTracks: string[];
  unlockedVehicles: string[];
  stars: Record<string, number>;
  podiumTracks: string[];
  bestRace: Record<string, { pos: number; ms: number; lap: number }>;
  bestTA: Record<string, { ms: number; lap: number; vehicleId: string; charId: string; at: number }>;
  inventory: string[];
  equipment: Partial<Record<CharId, Partial<Record<CosCategory, string>>>>;
  weaponLoadout: string[];
  races: RaceRecord[];
  ledger: LedgerEntry[];
  achievements: Record<string, { p: number; done?: number }>;
  daily: { date: string; missions: MissionState[]; firstRaceDone: boolean; roulette: boolean; discounts: string[]; ta: Record<string, number> };
  weekly: { week: string; missions: MissionState[] };
  attendance: { last: string; streak: number; claimedToday: boolean };
  winStreak: number;
  totalPlayMs: number;
  guestRaces: number;
  titles: string[];
  title: string;
  counters: Record<string, number>;
  recentVehicles: string[];
  createdAt: number;
}

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((+t - +y) / 86400000 + 1) / 7)}`;
}
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ missions
export interface MissionDef {
  id: string;
  text: string;
  goal: number;
  reward: number;
  counter: string; // which race counter feeds it
  track?: string;
}
export const DAILY_POOL: MissionDef[] = [
  { id: 'd_races3', text: '레이스 3판 완주하기', goal: 3, reward: 600, counter: 'races' },
  { id: 'd_mt3_10', text: '미니터보 3단 10회', goal: 10, reward: 800, counter: 'mt3' },
  { id: 'd_hits5', text: '아이템 5회 명중시키기', goal: 5, reward: 700, counter: 'hits' },
  { id: 'd_heart3', text: '하트 미사일 3회 명중', goal: 3, reward: 800, counter: 'hit:heart' },
  { id: 'd_coins30', text: '별사탕 30개 모으기', goal: 30, reward: 600, counter: 'coins' },
  { id: 'd_win1', text: '1등 한 번 하기', goal: 1, reward: 1000, counter: 'wins' },
  { id: 'd_podium3', text: '3등 이내 3번 들기', goal: 3, reward: 900, counter: 'podiums' },
  { id: 'd_ta1', text: '타임어택 1회 도전', goal: 1, reward: 500, counter: 'ta' },
  { id: 'd_t5', text: '공사장 트랙 3등 이내', goal: 1, reward: 1000, counter: 'podium:t5' },
  { id: 'd_jelly', text: '젤리볼 3회 명중', goal: 3, reward: 700, counter: 'hit:jelly' },
];
export const WEEKLY_POOL: MissionDef[] = [
  { id: 'w_races20', text: '레이스 20판 완주', goal: 20, reward: 4000, counter: 'races' },
  { id: 'w_wins5', text: '1등 5번 하기', goal: 5, reward: 5000, counter: 'wins' },
  { id: 'w_mt3_60', text: '미니터보 3단 60회', goal: 60, reward: 4000, counter: 'mt3' },
  { id: 'w_hits30', text: '아이템 30회 명중', goal: 30, reward: 4000, counter: 'hits' },
  { id: 'w_hard3', text: '어려움 난이도 3등 이내 3번', goal: 3, reward: 5000, counter: 'hardPodiums' },
  { id: 'w_tracks4', text: '서로 다른 트랙 4곳 완주', goal: 4, reward: 3000, counter: 'distinctTracks' },
];
export const MISSION_BY_ID = Object.fromEntries([...DAILY_POOL, ...WEEKLY_POOL].map((m) => [m.id, m]));
function pickMissions(pool: MissionDef[], seed: string, n = 3): MissionState[] {
  const r = seeded(seed);
  const p = [...pool];
  const out: MissionState[] = [];
  while (out.length < n && p.length) out.push({ id: p.splice(Math.floor(r() * p.length), 1)[0].id, progress: 0, claimed: false });
  return out;
}

// ------------------------------------------------------------------ achievements (50+)
export interface AchDef {
  id: string;
  name: string;
  desc: string;
  goal: number;
  counter: string;
  reward: number;
  title?: string;
}
const A = (id: string, name: string, desc: string, counter: string, goal: number, reward: number, title?: string): AchDef => ({ id, name, desc, counter, goal, reward, title });
export const ACHIEVEMENTS: AchDef[] = [
  A('a_race1', '첫 출발!', '레이스 1판 완주', 'races', 1, 300, '새내기 레이서'),
  A('a_race10', '레이스 10판', '레이스 10판 완주', 'races', 10, 800),
  A('a_race50', '레이스 50판', '레이스 50판 완주', 'races', 50, 2500, '단골 레이서'),
  A('a_race100', '레이스 100판', '레이스 100판 완주', 'races', 100, 5000),
  A('a_race300', '레이스 300판', '레이스 300판 완주', 'races', 300, 15000, '레이스 중독자'),
  A('a_win1', '첫 우승', '1등 1번', 'wins', 1, 500, '우승자'),
  A('a_win5', '우승 5회', '1등 5번', 'wins', 5, 1500),
  A('a_win25', '우승 25회', '1등 25번', 'wins', 25, 5000, '챔피언'),
  A('a_win100', '우승 100회', '1등 100번', 'wins', 100, 20000, '전설의 챔피언'),
  A('a_pod10', '시상대 단골', '3등 이내 10번', 'podiums', 10, 1500),
  A('a_pod50', '시상대 지킴이', '3등 이내 50번', 'podiums', 50, 6000),
  ...TRACKS.map((t) => A(`a_pod_${t.id}`, `${t.name} 입상`, `${t.name}에서 3등 이내`, `podium:${t.id}`, 1, 500)),
  ...TRACKS.map((t) => A(`a_star_${t.id}`, `${t.name} 별 3개`, `${t.name} 별 3개 모으기`, `stars3:${t.id}`, 1, 2000, t.no === 8 ? '무지개 성주' : undefined)),
  A('a_mt50', '드리프트 입문', '미니터보 3단 50회', 'mt3', 50, 1000),
  A('a_mt500', '드리프트 장인', '미니터보 3단 500회', 'mt3', 500, 6000, '드리프트 장인'),
  A('a_hit10', '명사수', '아이템 10회 명중', 'hits', 10, 600),
  A('a_hit100', '백발백중', '아이템 100회 명중', 'hits', 100, 3000, '스나이퍼'),
  A('a_hit500', '아이템 마스터', '아이템 500회 명중', 'hits', 500, 10000),
  A('a_coin100', '별사탕 수집가', '별사탕 100개', 'coins', 100, 800),
  A('a_coin1000', '별사탕 부자', '별사탕 1000개', 'coins', 1000, 5000, '별사탕 부자'),
  A('a_gold10k', '용돈 모으기', '누적 골드 10,000', 'goldEarned', 10000, 500),
  A('a_gold100k', '부자 레이서', '누적 골드 100,000', 'goldEarned', 100000, 3000),
  A('a_gold1m', '백만장자', '누적 골드 1,000,000', 'goldEarned', 1000000, 20000, '백만장자'),
  A('a_buy1', '첫 쇼핑', '상점에서 1개 구매', 'buys', 1, 300),
  A('a_buy10', '쇼핑왕', '상점에서 10개 구매', 'buys', 10, 1500),
  A('a_buy50', '패셔니스타', '상점에서 50개 구매', 'buys', 50, 6000, '패셔니스타'),
  A('a_rare', '반짝반짝', '레어 아이템 보유', 'own:rare', 1, 500),
  A('a_epic', '에픽 컬렉터', '에픽 아이템 보유', 'own:epic', 1, 1500),
  A('a_legend', '레전더리!', '레전더리 아이템 보유', 'own:legendary', 1, 5000),
  A('a_mythic', '신화의 주인공', '미식(신화) 아이템 보유', 'own:mythic', 1, 15000, '신화'),
  A('a_veh10', '차고 확장', '차량 10종 보유', 'vehicles', 10, 3000),
  A('a_veh20', '모든 차량!', '차량 20종 보유', 'vehicles', 20, 15000, '카 컬렉터'),
  A('a_chars8', '모두와 친구', '8명 모두로 완주', 'distinctChars', 8, 3000, '친구 부자'),
  A('a_tagold1', '금메달!', '타임어택 금메달', 'taGold', 1, 1000),
  A('a_tagold8', '타임어택 정복자', '8개 트랙 금메달', 'taGoldTracks', 8, 10000, '시간 지배자'),
  A('a_streak3', '3연승', '연속 3번 1등', 'bestStreak', 3, 2000),
  A('a_streak5', '5연승', '연속 5번 1등', 'bestStreak', 5, 5000, '무적'),
  A('a_lv5', '레벨 5', '레벨 5 달성', 'level', 5, 1000),
  A('a_lv10', '레벨 10', '레벨 10 달성', 'level', 10, 3000),
  A('a_lv20', '레벨 20', '레벨 20 달성', 'level', 20, 8000, '베테랑'),
  A('a_lv30', '레벨 30', '레벨 30 달성', 'level', 30, 15000),
  A('a_hard1', '어려움 정복', '어려움 난이도 1등', 'hardWins', 1, 2000),
  A('a_attend7', '개근상', '7일 연속 출석', 'attendStreak', 7, 3000, '개근왕'),
  A('a_skill50', '필살기 매니아', '고유기 50회 사용', 'skills', 50, 2000),
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// ------------------------------------------------------------------ attendance & roulette
export const ATTENDANCE_REWARDS = [500, 800, 1000, 1500, 2000, 3000, -1]; // -1 = rare box
export const ROULETTE = [
  { label: '300G', gold: 300, p: 0.3 },
  { label: '500G', gold: 500, p: 0.25 },
  { label: '1,000G', gold: 1000, p: 0.2 },
  { label: '2,000G', gold: 2000, p: 0.12 },
  { label: '5,000G', gold: 5000, p: 0.05 },
  { label: '커먼 아이템', item: 'common', p: 0.06 },
  { label: '레어 아이템', item: 'rare', p: 0.02 },
] as const;

export function newProfile(guestId: string, nickname = '게스트'): Profile {
  const eq: Profile['equipment'] = {};
  for (const c of CHARACTERS) eq[c.id] = {};
  return {
    v: 1,
    userId: null,
    username: null,
    nickname,
    guestId,
    gold: 3000,
    xp: 0,
    level: 1,
    goldEarned: 3000,
    goldSpent: 0,
    selectedChar: 'momo',
    selectedVehicle: 'coupang',
    unlockedTracks: [...START_TRACKS],
    unlockedVehicles: [...START_VEHICLES],
    stars: {},
    podiumTracks: [],
    bestRace: {},
    bestTA: {},
    inventory: [],
    equipment: eq,
    weaponLoadout: [],
    races: [],
    ledger: [{ t: Date.now(), delta: 3000, reason: '시작 선물' }],
    achievements: {},
    daily: { date: '', missions: [], firstRaceDone: false, roulette: false, discounts: [], ta: {} },
    weekly: { week: '', missions: [] },
    attendance: { last: '', streak: 0, claimedToday: false },
    winStreak: 0,
    totalPlayMs: 0,
    guestRaces: 0,
    titles: [],
    title: '',
    counters: {},
    recentVehicles: [],
    createdAt: Date.now(),
  };
}

/** Roll daily/weekly state forward (missions, discounts, attendance flags). */
export function refreshDaily(p: Profile, now = new Date()): boolean {
  let changed = false;
  const d = today(now);
  if (p.daily.date !== d) {
    p.daily = { date: d, missions: pickMissions(DAILY_POOL, p.guestId + d), firstRaceDone: false, roulette: false, discounts: dailyDiscounts(d), ta: {} };
    p.attendance.claimedToday = p.attendance.last === d;
    changed = true;
  }
  const w = weekKey(now);
  if (p.weekly.week !== w) {
    p.weekly = { week: w, missions: pickMissions(WEEKLY_POOL, p.guestId + w) };
    changed = true;
  }
  return changed;
}
export function dailyDiscounts(date: string): string[] {
  const r = seeded('discount' + date);
  const pool = COSMETICS.filter((c) => c.tier !== 'mythic');
  const out: string[] = [];
  while (out.length < 3) {
    const c = pool[Math.floor(r() * pool.length)].id;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}
export const DISCOUNT = 0.3;
export function priceOf(p: Profile, itemId: string): number | null {
  const c = COSMETIC_BY_ID[itemId];
  let price: number | null = null;
  if (c) price = c.price;
  else if (WEAPON_BY_ID[itemId]) price = WEAPON_BY_ID[itemId].price;
  else if (itemId.startsWith('veh:')) price = vehiclePrice(itemId.slice(4));
  if (price == null) return null;
  if (p.daily.discounts.includes(itemId)) price = Math.round(price * (1 - DISCOUNT));
  return price;
}

function bump(p: Profile, key: string, by = 1) {
  p.counters[key] = (p.counters[key] ?? 0) + by;
}
function gold(p: Profile, delta: number, reason: string, ref?: string) {
  if (!delta) return;
  p.gold += delta;
  if (delta > 0) p.goldEarned += delta;
  else p.goldSpent -= delta;
  p.ledger.unshift({ t: Date.now(), delta, reason, ref });
  if (p.ledger.length > 400) p.ledger.length = 400;
}

/** Re-evaluate achievements & missions from counters. Returns newly completed achievement ids. */
export function evaluate(p: Profile): string[] {
  const own = (tier: string) => p.inventory.filter((i) => COSMETIC_BY_ID[i]?.tier === tier).length;
  const value = (counter: string): number => {
    if (counter === 'level') return p.level;
    if (counter === 'goldEarned') return p.goldEarned;
    if (counter === 'vehicles') return p.unlockedVehicles.length;
    if (counter === 'attendStreak') return p.attendance.streak;
    if (counter.startsWith('own:')) return own(counter.slice(4));
    if (counter.startsWith('stars3:')) return countStars(p.stars[counter.slice(7)] ?? 0) >= 3 ? 1 : 0;
    if (counter === 'taGoldTracks') return Object.entries(p.bestTA).filter(([t, b]) => medalFor(t, b.ms) === 'gold').length;
    if (counter === 'distinctChars') return new Set(p.races.map((r) => r.charId)).size;
    return p.counters[counter] ?? 0;
  };
  const done: string[] = [];
  for (const a of ACHIEVEMENTS) {
    const st = (p.achievements[a.id] ??= { p: 0 });
    if (st.done) continue;
    st.p = Math.min(a.goal, value(a.counter));
    if (st.p >= a.goal) {
      st.done = Date.now();
      gold(p, a.reward, `업적: ${a.name}`, a.id);
      if (a.title) p.titles.push(a.title);
      done.push(a.id);
    }
  }
  return done;
}

export interface RaceApplyInput {
  id: string;
  mode: Mode;
  trackId: string;
  difficulty: Difficulty;
  charId: CharId;
  vehicleId: string;
  position: number;
  totalMs: number;
  bestLapMs: number;
  lapTimes: number[];
  coins: number;
  mt3: number;
  hitsDealt: number;
  entrants: RaceRecord['entrants'];
  items: RaceRecord['items'];
  skills?: number;
}
export interface RaceApplyOutput {
  reward: { lines: RewardLine[]; total: number };
  xpGain: number;
  levelUps: number[];
  newTracks: string[];
  newVehicles: string[];
  starsBefore: number;
  starsAfter: number;
  achievements: string[];
  personalBest: boolean;
  medal: string | null;
}

/** Apply a validated race to the profile (pure state transition). */
export function applyRace(p: Profile, r: RaceApplyInput): RaceApplyOutput {
  refreshDaily(p);
  const isRace = r.mode === 'race';
  const podium = isRace && r.position <= 3;
  const firstPodium = podium && !p.podiumTracks.includes(r.trackId);
  let personalBest = false;
  let medal: string | null = null;
  if (r.mode === 'timeattack') {
    const prev = p.bestTA[r.trackId];
    personalBest = !prev || r.totalMs < prev.ms;
    if (personalBest) p.bestTA[r.trackId] = { ms: r.totalMs, lap: r.bestLapMs, vehicleId: r.vehicleId, charId: r.charId, at: Date.now() };
    medal = medalFor(r.trackId, r.totalMs);
  } else if (isRace) {
    const prev = p.bestRace[r.trackId];
    personalBest = !!prev && r.totalMs < prev.ms;
    if (!prev || r.position < prev.pos || (r.position === prev.pos && r.totalMs < prev.ms))
      p.bestRace[r.trackId] = { pos: Math.min(r.position, prev?.pos ?? 9), ms: Math.min(r.totalMs, prev?.ms ?? Infinity), lap: Math.min(r.bestLapMs, prev?.lap ?? Infinity) };
  }
  if (isRace) p.winStreak = r.position === 1 ? p.winStreak + 1 : 0;
  const taKey = r.trackId;
  const taFirstToday = r.mode === 'timeattack' && !p.daily.ta[taKey];
  if (r.mode === 'timeattack') p.daily.ta[taKey] = (p.daily.ta[taKey] ?? 0) + 1;
  const reward = computeReward({
    mode: r.mode,
    trackId: r.trackId,
    difficulty: r.difficulty,
    position: r.position,
    totalMs: r.totalMs,
    coins: r.coins,
    firstPodiumOnTrack: firstPodium,
    personalBest,
    winStreak: p.winStreak,
    firstRaceToday: r.mode !== 'practice' && !p.daily.firstRaceDone,
    taFirstToday,
  });
  if (r.mode !== 'practice') p.daily.firstRaceDone = true;
  gold(p, reward.total, r.mode === 'timeattack' ? '타임어택 보상' : r.mode === 'race' ? `레이스 ${r.position}위` : '연습', r.id);
  // xp / level
  const xpGain = xpForRace(r.mode, r.position);
  const lv = addXp(p.level, p.xp, xpGain);
  p.level = lv.level;
  p.xp = lv.xp;
  for (const L of lv.ups) gold(p, levelUpGold(L), `레벨 ${L} 달성`);
  // unlocks & stars
  const newTracks: string[] = [];
  const newVehicles: string[] = [];
  const totalStars = () => Object.values(p.stars).reduce((a, b) => a + countStars(b), 0);
  const starsBefore = totalStars();
  if (isRace) {
    p.stars[r.trackId] = (p.stars[r.trackId] ?? 0) | starBits(r.position, r.difficulty);
    if (podium) {
      if (firstPodium) p.podiumTracks.push(r.trackId);
      const next = trackUnlockedBy(r.trackId);
      if (next && !p.unlockedTracks.includes(next)) {
        p.unlockedTracks.push(next);
        newTracks.push(next);
      }
    }
  }
  const starsAfter = totalStars();
  for (const v of [...vehiclesForLevel(p.level), ...vehiclesForStars(starsAfter)]) {
    if (!p.unlockedVehicles.includes(v)) {
      p.unlockedVehicles.push(v);
      newVehicles.push(v);
    }
  }
  // counters
  if (r.mode !== 'practice') {
    bump(p, 'races');
    if (isRace && r.position === 1) bump(p, 'wins');
    if (podium) bump(p, 'podiums');
    if (podium) bump(p, `podium:${r.trackId}`);
    if (isRace && r.position === 1 && r.difficulty === 'hard') bump(p, 'hardWins');
    if (podium && r.difficulty === 'hard') bump(p, 'hardPodiums');
    if (r.mode === 'timeattack') bump(p, 'ta');
    if (medal === 'gold') bump(p, 'taGold');
  }
  bump(p, 'mt3', r.mt3);
  bump(p, 'hits', r.hitsDealt);
  bump(p, 'coins', r.coins);
  bump(p, 'skills', r.skills ?? 0);
  for (const [id, s] of Object.entries(r.items)) if (s.hits) bump(p, `hit:${id}`, s.hits);
  p.counters.bestStreak = Math.max(p.counters.bestStreak ?? 0, p.winStreak);
  // missions (daily + weekly)
  const distinctToday = new Set(p.races.filter((x) => x.at > Date.now() - 7 * 864e5).map((x) => x.trackId).concat(r.trackId)).size;
  const missionDelta = (counter: string): number => {
    if (counter === 'races') return r.mode !== 'practice' ? 1 : 0;
    if (counter === 'wins') return isRace && r.position === 1 ? 1 : 0;
    if (counter === 'podiums') return podium ? 1 : 0;
    if (counter === 'hardPodiums') return podium && r.difficulty === 'hard' ? 1 : 0;
    if (counter === 'mt3') return r.mt3;
    if (counter === 'hits') return r.hitsDealt;
    if (counter === 'coins') return r.coins;
    if (counter === 'ta') return r.mode === 'timeattack' ? 1 : 0;
    if (counter.startsWith('hit:')) return r.items[counter.slice(4)]?.hits ?? 0;
    if (counter.startsWith('podium:')) return podium && r.trackId === counter.slice(7) ? 1 : 0;
    return 0;
  };
  for (const m of [...p.daily.missions, ...p.weekly.missions]) {
    const def = MISSION_BY_ID[m.id];
    if (!def || m.claimed) continue;
    if (def.counter === 'distinctTracks') m.progress = Math.min(def.goal, distinctToday);
    else m.progress = Math.min(def.goal, m.progress + missionDelta(def.counter));
  }
  // history
  p.races.unshift({
    id: r.id,
    mode: r.mode,
    trackId: r.trackId,
    difficulty: r.difficulty,
    charId: r.charId,
    vehicleId: r.vehicleId,
    position: r.position,
    totalMs: r.totalMs,
    bestLapMs: r.bestLapMs,
    lapTimes: r.lapTimes,
    coins: r.coins,
    gold: reward.total,
    at: Date.now(),
    entrants: r.entrants,
    items: r.items,
  });
  if (p.races.length > 500) p.races.length = 500;
  p.recentVehicles = [...r.entrants.map((e) => e.vehicleId), ...p.recentVehicles].slice(0, 40);
  p.totalPlayMs += r.totalMs;
  if (!p.userId) p.guestRaces++;
  const achievements = evaluate(p);
  return { reward, xpGain, levelUps: lv.ups, newTracks, newVehicles, starsBefore, starsAfter, achievements, personalBest, medal };
}

export function buy(p: Profile, itemId: string): string | null {
  refreshDaily(p);
  const price = priceOf(p, itemId);
  if (price == null) return '알 수 없는 상품이에요';
  if (itemId.startsWith('veh:')) {
    const vid = itemId.slice(4);
    if (p.unlockedVehicles.includes(vid)) return '이미 보유 중이에요';
    if (p.gold < price) return '골드가 부족해요';
    gold(p, -price, `차량 구매`, vid);
    p.unlockedVehicles.push(vid);
  } else {
    if (p.inventory.includes(itemId)) return '이미 보유 중이에요';
    if (p.gold < price) return '골드가 부족해요';
    gold(p, -price, `구매: ${COSMETIC_BY_ID[itemId]?.name ?? WEAPON_BY_ID[itemId]?.name}`, itemId);
    p.inventory.push(itemId);
  }
  bump(p, 'buys');
  evaluate(p);
  return null;
}
export function equip(p: Profile, charId: CharId, itemId: string | null, cat: CosCategory): string | null {
  if (itemId && !p.inventory.includes(itemId)) return '보유하지 않은 아이템이에요';
  const e = (p.equipment[charId] ??= {});
  if (itemId) e[cat] = itemId;
  else delete e[cat];
  return null;
}
export function setLoadout(p: Profile, ids: string[]): string | null {
  const clean = ids.filter((i) => WEAPON_BY_ID[i] && p.inventory.includes(i)).slice(0, 3);
  p.weaponLoadout = [...new Set(clean)];
  return null;
}
export function claimMission(p: Profile, id: string): string | null {
  const m = [...p.daily.missions, ...p.weekly.missions].find((x) => x.id === id);
  const def = MISSION_BY_ID[id];
  if (!m || !def) return '미션을 찾을 수 없어요';
  if (m.claimed) return '이미 받았어요';
  if (m.progress < def.goal) return '아직 완료하지 않았어요';
  m.claimed = true;
  gold(p, def.reward, `미션: ${def.text}`, id);
  evaluate(p);
  return null;
}
export function claimAttendance(p: Profile, now = new Date()): { day: number; gold: number; item?: string } | string {
  refreshDaily(p, now);
  const d = today(now);
  if (p.attendance.last === d) return '오늘은 이미 출석했어요';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const cont = p.attendance.last === today(y);
  p.attendance.streak = cont ? p.attendance.streak + 1 : 1;
  p.attendance.last = d;
  p.attendance.claimedToday = true;
  const day = ((p.attendance.streak - 1) % 7) + 1;
  const reward = ATTENDANCE_REWARDS[day - 1];
  if (reward === -1) {
    const pool = COSMETICS.filter((c) => c.tier === 'rare' && !p.inventory.includes(c.id));
    const it = pool[Math.floor(Math.random() * pool.length)];
    if (it) {
      p.inventory.push(it.id);
      evaluate(p);
      return { day, gold: 0, item: it.id };
    }
    gold(p, 5000, '출석 7일차');
    return { day, gold: 5000 };
  }
  gold(p, reward, `출석 ${day}일차`);
  evaluate(p);
  return { day, gold: reward };
}
export function spinRoulette(p: Profile, rnd = Math.random()): { index: number; gold: number; item?: string } | string {
  refreshDaily(p);
  if (p.daily.roulette) return '오늘은 이미 돌렸어요';
  p.daily.roulette = true;
  let acc = 0;
  let idx = ROULETTE.length - 1;
  for (let i = 0; i < ROULETTE.length; i++) {
    acc += ROULETTE[i].p;
    if (rnd < acc) {
      idx = i;
      break;
    }
  }
  const seg = ROULETTE[idx];
  if ('gold' in seg) {
    gold(p, seg.gold, '럭키 룰렛');
    return { index: idx, gold: seg.gold };
  }
  const pool = COSMETICS.filter((c) => c.tier === seg.item && !p.inventory.includes(c.id));
  const it = pool[Math.floor(Math.random() * pool.length)];
  if (!it) {
    gold(p, 1000, '럭키 룰렛');
    return { index: idx, gold: 1000 };
  }
  p.inventory.push(it.id);
  evaluate(p);
  return { index: idx, gold: 0, item: it.id };
}
/** Sign-up welcome gift (§11.2) */
export function welcomeGift(p: Profile) {
  if (!p.inventory.includes(WELCOME_HAT.id)) p.inventory.push(WELCOME_HAT.id);
  gold(p, 5000, '회원가입 보너스');
}
/** Guest → member migration caps (§11.2): gold ≤ 20,000 */
export function migrateGuest(guest: Profile, member: Profile) {
  member.gold += Math.min(20000, guest.gold);
  for (const k of ['unlockedTracks', 'unlockedVehicles', 'inventory'] as const) member[k] = [...new Set([...member[k], ...guest[k].filter((x) => k !== 'unlockedTracks' || ['t1', 't2', 't3'].includes(x) || member.unlockedTracks.includes(x))])];
  member.stars = { ...guest.stars, ...member.stars };
  member.bestTA = { ...guest.bestTA, ...member.bestTA };
  member.bestRace = { ...guest.bestRace, ...member.bestRace };
  member.races = [...guest.races, ...member.races].sort((a, b) => b.at - a.at).slice(0, 500);
  member.podiumTracks = [...new Set([...member.podiumTracks, ...guest.podiumTracks])];
  member.counters = { ...guest.counters, ...member.counters };
}
export const ALL_WEAPON_IDS = WEAPONS.map((w) => w.id);
