import { route } from '../_lib/http';
import { ready } from '../_lib/db';
export default route(['GET'], async (req) => {
  const track = String(req.query.track ?? 't1').slice(0, 10);
  const c = await ready();
  const r = await c.execute({
    sql: `SELECT t.user_id, u.nickname, t.total_ms, t.vehicle_id, t.character_id FROM time_attack_records t JOIN users u ON u.id = t.user_id
          WHERE t.track_id = ? ORDER BY t.total_ms ASC LIMIT 100`,
    args: [track],
  });
  return { rows: r.rows.map((x, i) => ({ rank: i + 1, userId: String(x.user_id), nickname: String(x.nickname), totalMs: Number(x.total_ms), vehicleId: String(x.vehicle_id), charId: String(x.character_id) })) };
});
