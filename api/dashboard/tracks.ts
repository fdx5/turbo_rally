import { route } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { ready } from '../_lib/db';
export default route(['GET'], async (req) => {
  const uid = await requireUser(req);
  const c = await ready();
  const r = await c.execute({
    sql: `SELECT track_id, COUNT(*) plays, MIN(CASE WHEN mode='race' THEN position END) bestPos, MIN(CASE WHEN mode='race' THEN total_ms END) bestMs, MIN(best_lap_ms) bestLap
          FROM races WHERE user_id = ? AND valid = 1 GROUP BY track_id`,
    args: [uid],
  });
  return { tracks: r.rows };
});
