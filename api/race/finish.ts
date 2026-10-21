import { route, HttpError } from '../_lib/http';
import { ready, batch } from '../_lib/db';
import { currentUser, verifyToken } from '../_lib/auth';
import { parse, RaceFinish } from '../_lib/validate';
import { mutateProfile } from '../_lib/repo';
import { applyRace } from '../../shared/progress';
import { validateRace } from '../../shared/economy';
import { VEHICLE_BY_ID } from '../../src/data/vehicles';
import { CHAR_BY_ID, type CharId } from '../../src/data/characters';
import type { InStatement } from '@libsql/client';

const RACE_INSERT = 'INSERT INTO races (id, user_id, guest_id, mode, track_id, difficulty, character_id, vehicle_id, position, total_ms, best_lap_ms, coins, gold_earned, started_at, finished_at, valid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

/**
 * Server-side gold calculation & anti-cheat validation (§12.2). Guests (no session) only get their
 * race recorded for the public records — their progress and gold stay local.
 */
export default route(['POST'], async (req) => {
  const uid = await currentUser(req);
  const b = parse(RaceFinish, req.body);
  const guestId = uid ? null : (b.guestId ?? null);
  const sub = uid ?? (guestId ? 'g:' + guestId : null);
  if (!sub) throw new HttpError(401, '로그인이 필요해요');
  const tk = await verifyToken<{ rid: string; sub: string; t: number; track: string; mode: string; diff: string }>(b.token);
  if (!tk || tk.sub !== sub || tk.rid !== b.raceId) throw new HttpError(403, '레이스 토큰이 올바르지 않아요');
  if (tk.track !== b.trackId || tk.mode !== b.mode || tk.diff !== b.difficulty) throw new HttpError(403, '레이스 정보가 일치하지 않아요');
  if (!VEHICLE_BY_ID[b.vehicleId] || !CHAR_BY_ID[b.charId as CharId]) throw new HttpError(400, 'bad kart');
  const c = await ready();
  const t = await c.execute({ sql: 'UPDATE race_tickets SET used = 1 WHERE race_id = ? AND user_id = ? AND used = 0', args: [b.raceId, sub] });
  if (!t.rowsAffected) throw new HttpError(409, '이미 제출된 레이스예요');
  const laps = b.mode === 'practice' ? Math.max(1, b.lapTimes.length) : 3;
  const err = validateRace({ ...b, laps }, Date.now() - tk.t);
  const race = (gold: number, valid: number): InStatement => ({ sql: RACE_INSERT, args: [b.raceId, uid, guestId, b.mode, b.trackId, b.difficulty, b.charId, b.vehicleId, b.position, b.totalMs, b.bestLapMs, b.coins, gold, tk.t, Date.now(), valid] });
  if (err) {
    await c.execute(race(0, 0));
    throw new HttpError(422, `비정상 기록으로 판정되었어요 (${err})`);
  }
  const details = () => {
    const s: InStatement[] = [];
    b.entrants.forEach((e, i) => s.push({ sql: 'INSERT INTO race_entrants VALUES (?,?,?,?,?,?,?,?)', args: [b.raceId, i, e.charId, e.vehicleId, e.name, e.isPlayer ? 1 : 0, e.position, Math.round(e.totalMs)] }));
    b.lapTimes.forEach((ms, i) => s.push({ sql: 'INSERT INTO lap_times VALUES (?,?,?)', args: [b.raceId, i + 1, ms] }));
    for (const [id, st] of Object.entries(b.items)) s.push({ sql: 'INSERT INTO race_item_stats VALUES (?,?,?,?,?)', args: [b.raceId, id, st.used, st.hits, st.gotHit] });
    return s;
  };
  if (!uid) {
    // guest gold is computed on the device; it is only displayed, never credited
    await batch([race(b.gold ?? 0, 1), ...details(), { sql: 'UPDATE guests SET races_played = races_played + 1 WHERE guest_id = ?', args: [guestId] }]);
    return { ok: true };
  }
  const res = await mutateProfile(
    uid,
    (p) => {
      if (!p.unlockedVehicles.includes(b.vehicleId)) throw new HttpError(403, '보유하지 않은 차량이에요');
      return applyRace(p, { ...b, id: b.raceId, charId: b.charId as CharId, entrants: b.entrants, items: b.items });
    },
    (_p, out) => [race(out.reward.total, 1), ...details()],
  );
  return { profile: res.profile, out: res.result };
});
