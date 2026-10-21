import { route, HttpError } from '../_lib/http';
import { ready } from '../_lib/db';
import { requireUser, signToken } from '../_lib/auth';
import { parse, RaceStart } from '../_lib/validate';
import { TRACK_BY_ID } from '../../src/data/tracks';
import { randomUUID } from 'node:crypto';

export default route(['POST'], async (req) => {
  const uid = await requireUser(req);
  const b = parse(RaceStart, req.body);
  if (!TRACK_BY_ID[b.trackId]) throw new HttpError(400, 'unknown track');
  const raceId = randomUUID();
  const t = Date.now();
  const c = await ready();
  await c.execute({ sql: 'INSERT INTO race_tickets VALUES (?,?,?,?,?,?,0)', args: [raceId, uid, b.trackId, b.mode, b.difficulty, t] });
  const token = await signToken({ rid: raceId, sub: uid, t, track: b.trackId, mode: b.mode, diff: b.difficulty }, '2h');
  return { raceId, token };
});
