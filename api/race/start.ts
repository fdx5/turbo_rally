import { route, HttpError } from '../_lib/http';
import { ready } from '../_lib/db';
import { currentUser, signToken } from '../_lib/auth';
import { parse, RaceStart } from '../_lib/validate';
import { TRACK_BY_ID } from '../../src/data/tracks';
import { randomUUID } from 'node:crypto';

/** Members get a ticket for their session; guests (guestId in body) get one so their race shows in public records. */
export default route(['POST'], async (req) => {
  const b = parse(RaceStart, req.body);
  const uid = await currentUser(req);
  const sub = uid ?? (b.guestId ? 'g:' + b.guestId : null);
  if (!sub) throw new HttpError(401, '로그인이 필요해요');
  if (!TRACK_BY_ID[b.trackId]) throw new HttpError(400, 'unknown track');
  const raceId = randomUUID();
  const t = Date.now();
  const c = await ready();
  if (!uid) await c.execute({ sql: 'INSERT OR IGNORE INTO guests (guest_id, created_at, races_played) VALUES (?,?,0)', args: [b.guestId!, t] });
  await c.execute({ sql: 'INSERT INTO race_tickets VALUES (?,?,?,?,?,?,0)', args: [raceId, sub, b.trackId, b.mode, b.difficulty, t] });
  const token = await signToken({ rid: raceId, sub, t, track: b.trackId, mode: b.mode, diff: b.difficulty }, '2h');
  return { raceId, token };
});
