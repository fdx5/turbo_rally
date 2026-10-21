import { route } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { ready } from '../_lib/db';
export default route(['GET'], async (req) => {
  const uid = await requireUser(req);
  const c = await ready();
  const [ch, ve, it] = await c.batch(
    [
      { sql: `SELECT character_id k, COUNT(*) n, SUM(position=1) wins, AVG(position) avgPos FROM races WHERE user_id=? AND valid=1 AND mode='race' GROUP BY character_id`, args: [uid] },
      { sql: `SELECT vehicle_id k, COUNT(*) n, SUM(position=1) wins, AVG(position) avgPos FROM races WHERE user_id=? AND valid=1 AND mode='race' GROUP BY vehicle_id`, args: [uid] },
      { sql: `SELECT s.item_id k, SUM(s.used) used, SUM(s.hits) hits, SUM(s.got_hit) gotHit FROM race_item_stats s JOIN races r ON r.id = s.race_id WHERE r.user_id=? GROUP BY s.item_id`, args: [uid] },
    ],
    'read',
  );
  return { characters: ch.rows, vehicles: ve.rows, items: it.rows };
});
