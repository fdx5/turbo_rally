import { route, HttpError } from '../_lib/http';
import { ready } from '../_lib/db';
import { TRACK_LAYOUT_VERSION } from '../../src/data/trackLayout';
export default route(['GET'], async (req) => {
  const track = String(req.query.track ?? '').slice(0, 10);
  const user = String(req.query.user ?? '').slice(0, 64);
  const c = await ready();
  const r = await c.execute({ sql: 'SELECT ghost_blob FROM time_attack_records WHERE track_id = ? AND user_id = ? AND layout_version = ?', args: [track, user, TRACK_LAYOUT_VERSION] });
  const g = r.rows[0]?.ghost_blob;
  if (!g) throw new HttpError(404, '고스트가 없어요');
  return { ghost: String(g) };
});
