import { route } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { ready } from '../_lib/db';
export default route(['GET'], async (req) => {
  const uid = await requireUser(req);
  const c = await ready();
  const r = await c.execute({
    sql: `SELECT COUNT(*) n, SUM(position = 1) wins, SUM(position <= 3) top3, AVG(position) avgPos, SUM(total_ms) playMs, SUM(gold_earned) gold
          FROM races WHERE user_id = ? AND valid = 1 AND mode = 'race'`,
    args: [uid],
  });
  const p = await c.execute({ sql: 'SELECT gold, xp, level, gold_earned, gold_spent FROM profiles WHERE user_id = ?', args: [uid] });
  return { races: r.rows[0], profile: p.rows[0] };
});
