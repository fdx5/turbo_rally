import { z } from 'zod';
import { HttpError } from './http';

export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, '입력값이 올바르지 않아요');
  return r.data;
}
const BANNED = ['바보', '멍청', '시발', 'fuck', 'shit', '병신', '개새'];
export const Signup = z.object({
  username: z.string().regex(/^[a-z0-9_]{4,16}$/),
  password: z.string().min(8).max(72).regex(/[a-zA-Z]/).regex(/[0-9]/),
  nickname: z.string().min(2).max(10).refine((s) => !BANNED.some((b) => s.toLowerCase().includes(b))),
  guestId: z.string().max(80).optional(),
});
export const Login = z.object({ username: z.string().max(16), password: z.string().max(72), remember: z.boolean().optional() });
export const Ids = z.string().max(40);
export const Mode = z.enum(['race', 'timeattack', 'practice']);
export const Diff = z.enum(['easy', 'normal', 'hard']);
export const RaceStart = z.object({ trackId: Ids, mode: Mode, difficulty: Diff });
const ItemStat = z.object({ used: z.number().int().min(0).max(200), hits: z.number().int().min(0).max(200), gotHit: z.number().int().min(0).max(200) });
export const RaceFinish = z.object({
  raceId: Ids.or(z.string().uuid()),
  token: z.string().max(2000),
  mode: Mode,
  trackId: Ids,
  difficulty: Diff,
  charId: Ids,
  vehicleId: Ids,
  position: z.number().int().min(1).max(8),
  totalMs: z.number().int().min(1).max(3_600_000),
  bestLapMs: z.number().int().min(0).max(3_600_000),
  lapTimes: z.array(z.number().int().min(0).max(3_600_000)).max(5),
  coins: z.number().int().min(0).max(12),
  mt3: z.number().int().min(0).max(500),
  hitsDealt: z.number().int().min(0).max(300),
  entrants: z.array(z.object({ charId: Ids, vehicleId: Ids, name: z.string().max(20), isPlayer: z.boolean(), position: z.number().int(), totalMs: z.number() })).max(8),
  items: z.record(z.string().max(40), ItemStat),
});
