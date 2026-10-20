/**
 * Game economy rules — single source of truth shared by the client (guest mode) and the
 * serverless API (members). Pure functions only: no DOM, no DB.
 */
import { TRACK_BY_ID, TRACKS } from '../src/data/tracks';
import { VEHICLES, VEHICLE_BY_ID } from '../src/data/vehicles';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type Mode = 'race' | 'timeattack' | 'practice';

export const PLACE_GOLD = [1500, 1100, 850, 650, 500, 400, 300, 200];
export const DIFF_MUL: Record<Difficulty, number> = { easy: 1.0, normal: 1.25, hard: 1.5 };
export const TA_MEDAL_GOLD = { gold: 800, silver: 500, bronze: 300 } as const;

export interface RewardLine {
  key: string;
  label: string;
  gold: number;
}
export interface RaceRewardInput {
  mode: Mode;
  trackId: string;
  difficulty: Difficulty;
  position: number;
  totalMs: number;
  coins: number;
  firstPodiumOnTrack: boolean; // never placed top-3 on this track before
  personalBest: boolean;
  winStreak: number; // consecutive wins including this one
  firstRaceToday: boolean;
  taFirstToday?: boolean; // first time-attack reward on this track today
}

export function medalFor(trackId: string, ms: number): 'gold' | 'silver' | 'bronze' | null {
  const t = TRACK_BY_ID[trackId];
  if (!t) return null;
  if (ms <= t.medals.gold) return 'gold';
  if (ms <= t.medals.silver) return 'silver';
  if (ms <= t.medals.bronze) return 'bronze';
  return null;
}

/** §15.1 gold formula. Returns each line so the result screen can count them up one by one. */
export function computeReward(i: RaceRewardInput): { lines: RewardLine[]; total: number } {
  const lines: RewardLine[] = [];
  const track = TRACK_BY_ID[i.trackId];
  if (i.mode === 'practice') return { lines: [{ key: 'practice', label: '연습 주행 (보상 없음)', gold: 0 }], total: 0 };
  if (i.mode === 'timeattack') {
    const medal = medalFor(i.trackId, i.totalMs);
    if (medal) {
      const g = Math.round(TA_MEDAL_GOLD[medal] * (i.taFirstToday ? 1 : 0.2));
      lines.push({ key: 'medal', label: `${medal === 'gold' ? '🥇 금' : medal === 'silver' ? '🥈 은' : '🥉 동'}메달${i.taFirstToday ? '' : ' (오늘 재도전 20%)'}`, gold: g });
    }
    if (i.personalBest) lines.push({ key: 'pb', label: '개인 최고기록 갱신!', gold: 500 });
    return { lines, total: lines.reduce((a, b) => a + b.gold, 0) };
  }
  const base = PLACE_GOLD[Math.max(1, Math.min(8, i.position)) - 1];
  lines.push({ key: 'place', label: `${i.position}위 보상`, gold: base });
  const mul = DIFF_MUL[i.difficulty];
  if (mul !== 1) lines.push({ key: 'diff', label: `난이도 보너스 ×${mul}`, gold: Math.round(base * (mul - 1)) });
  if (track && i.totalMs < track.par) {
    const tb = Math.min(1000, Math.floor(((track.par - i.totalMs) / track.par) * 4000));
    if (tb > 0) lines.push({ key: 'time', label: '기준 시간 돌파 보너스', gold: tb });
  }
  if (i.firstPodiumOnTrack && i.position <= 3) lines.push({ key: 'firstPodium', label: '트랙 첫 입상!', gold: 3000 });
  if (i.personalBest) lines.push({ key: 'pb', label: '개인 최고기록 갱신', gold: 500 });
  if (i.winStreak >= 2 && i.position === 1) lines.push({ key: 'streak', label: `🔥 ${i.winStreak}연승!`, gold: Math.min(1000, 200 * i.winStreak) });
  if (i.coins > 0) lines.push({ key: 'coins', label: `별사탕 ${i.coins}개`, gold: i.coins * 10 });
  let total = lines.reduce((a, b) => a + b.gold, 0);
  if (i.firstRaceToday) {
    lines.push({ key: 'daily', label: '오늘의 첫 판 ×2', gold: total });
    total *= 2;
  }
  return { lines, total };
}

// ------------------------------------------------------------------ XP & levels
export const xpForRace = (mode: Mode, position: number) => (mode === 'practice' ? 20 : mode === 'timeattack' ? 80 : 100 + (9 - position) * 15);
export const xpToNext = (level: number) => 300 + level * 150;
export function addXp(level: number, xp: number, gain: number) {
  let l = level;
  let x = xp + gain;
  const ups: number[] = [];
  while (x >= xpToNext(l)) {
    x -= xpToNext(l);
    l++;
    ups.push(l);
  }
  return { level: l, xp: x, ups };
}
export const levelUpGold = (level: number) => 500 + level * 250;

// ------------------------------------------------------------------ unlocks
/** Track N+1 unlocks when you finish top-3 on track N (track 2 is open from the start). §10.2 */
export function trackUnlockedBy(trackId: string): string | null {
  const t = TRACK_BY_ID[trackId];
  if (!t || t.no >= TRACKS.length) return null;
  return TRACKS[t.no].id;
}
export const START_TRACKS = ['t1', 't2'];
export const START_VEHICLES = VEHICLES.filter((v) => v.unlock.kind === 'start').map((v) => v.id);
export function vehiclesForLevel(level: number): string[] {
  return VEHICLES.filter((v) => v.unlock.kind === 'level' && v.unlock.level <= level).map((v) => v.id);
}
export function vehiclesForStars(stars: number): string[] {
  return VEHICLES.filter((v) => v.unlock.kind === 'stars' && v.unlock.stars <= stars).map((v) => v.id);
}
export function vehiclePrice(id: string): number | null {
  const v = VEHICLE_BY_ID[id];
  return v && v.unlock.kind === 'gold' ? v.unlock.price : null;
}
/** stars bitmask: 1 = top3, 2 = 1st, 4 = 1st on hard (§10.2) */
export function starBits(position: number, difficulty: Difficulty): number {
  let b = 0;
  if (position <= 3) b |= 1;
  if (position === 1) b |= 2;
  if (position === 1 && difficulty === 'hard') b |= 4;
  return b;
}
export const countStars = (bits: number) => (bits & 1 ? 1 : 0) + (bits & 2 ? 1 : 0) + (bits & 4 ? 1 : 0);

// ------------------------------------------------------------------ anti-cheat (server validation)
/** Minimum plausible lap time (ms) — faster than this is rejected (§12.2). */
export function minLapMs(trackId: string): number {
  const t = TRACK_BY_ID[trackId];
  return t ? Math.round(t.medals.gold / 3 / 1.8) : 15000;
}
export function validateRace(r: { trackId: string; mode: Mode; position: number; totalMs: number; lapTimes: number[]; coins: number; laps: number }, elapsedMs: number): string | null {
  if (!TRACK_BY_ID[r.trackId]) return 'unknown track';
  if (r.position < 1 || r.position > (r.mode === 'race' ? 8 : 1)) return 'bad position';
  if (r.coins < 0 || r.coins > 12) return 'bad coins';
  const minLap = minLapMs(r.trackId);
  if (r.totalMs < minLap * r.laps) return 'impossible time';
  if (r.lapTimes.some((l) => l < minLap)) return 'impossible lap';
  // wall-clock since race/start must cover the race time (+3 s intro/countdown slack)
  if (elapsedMs + 2000 < r.totalMs) return 'clock mismatch';
  return null;
}
