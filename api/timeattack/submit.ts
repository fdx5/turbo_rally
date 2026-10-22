import { route, HttpError } from '../_lib/http';
import { ready } from '../_lib/db';
import { requireUser } from '../_lib/auth';
import { z } from 'zod';
import { parse } from '../_lib/validate';

/** Stores the ghost for the member's best time (the time itself was validated in race/finish). */
export default route(['POST'], async (req) => {
  const uid = await requireUser(req);
  const b = parse(z.object({ trackId: z.string().max(10), totalMs: z.number().int(), ghost: z.string().max(800_000) }).passthrough(), req.body);
  const c = await ready();
  const r = await c.execute({ sql: 'SELECT total_ms FROM time_attack_records WHERE user_id = ? AND track_id = ?', args: [uid, b.trackId] });
  if (!r.rows.length || Number(r.rows[0].total_ms) !== b.totalMs) throw new HttpError(409, '검증된 기록과 일치하지 않아요');
  await c.execute({ sql: 'UPDATE time_attack_records SET ghost_blob = ? WHERE user_id = ? AND track_id = ?', args: [b.ghost, uid, b.trackId] });
  return { ok: true };
});
