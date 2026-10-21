import { route } from '../_lib/http';
import { ready } from '../_lib/db';

/** Per-track records across every member: play counts and record holders. */
export default route(['GET'], async () => {
  const c = await ready();
  const top = (col: string, where: string) => ({
    sql: `SELECT * FROM (SELECT r.track_id, r.${col} ms, r.user_id, u.nickname, r.character_id, r.vehicle_id,
            ROW_NUMBER() OVER (PARTITION BY r.track_id ORDER BY r.${col} ASC, r.finished_at ASC) rn
          FROM races r JOIN users u ON u.id = r.user_id WHERE r.valid = 1 AND r.${col} > 0 AND ${where}) WHERE rn = 1`,
    args: [],
  });
  const [agg, race, lap, ta] = await c.batch(
    [
      {
        sql: `SELECT track_id, COUNT(*) plays, COUNT(DISTINCT user_id) players, SUM(CASE WHEN mode='race' AND position=1 THEN 1 ELSE 0 END) wins FROM races WHERE valid = 1 AND mode <> 'practice' GROUP BY track_id`,
        args: [],
      },
      top('total_ms', "r.mode = 'race'"),
      top('best_lap_ms', "r.mode <> 'practice'"),
      {
        sql: `SELECT * FROM (SELECT t.track_id, t.total_ms ms, t.user_id, u.nickname, t.character_id, t.vehicle_id,
                ROW_NUMBER() OVER (PARTITION BY t.track_id ORDER BY t.total_ms ASC, t.created_at ASC) rn
              FROM time_attack_records t JOIN users u ON u.id = t.user_id) WHERE rn = 1`,
        args: [],
      },
    ],
    'read',
  );
  type Holder = { ms: number; userId: string; nickname: string; charId: string; vehicleId: string };
  const tracks: Record<
    string,
    { plays: number; players: number; wins: number; race?: Holder; lap?: Holder; ta?: Holder }
  > = {};
  const get = (id: string) => (tracks[id] ??= { plays: 0, players: 0, wins: 0 });
  for (const r of agg.rows)
    Object.assign(get(String(r.track_id)), {
      plays: Number(r.plays),
      players: Number(r.players),
      wins: Number(r.wins),
    });
  const holders = (rows: typeof race.rows, key: 'race' | 'lap' | 'ta') => {
    for (const r of rows)
      get(String(r.track_id))[key] = {
        ms: Number(r.ms),
        userId: String(r.user_id),
        nickname: String(r.nickname),
        charId: String(r.character_id),
        vehicleId: String(r.vehicle_id),
      };
  };
  holders(race.rows, 'race');
  holders(lap.rows, 'lap');
  holders(ta.rows, 'ta');
  return { tracks };
});
