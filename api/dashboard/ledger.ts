import { route } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { ready } from '../_lib/db';
export default route(['GET'], async (req) => {
  const uid = await requireUser(req);
  const c = await ready();
  const r = await c.execute({ sql: 'SELECT delta, reason, ref_id, created_at FROM gold_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', args: [uid, Math.min(200, Number(req.query.limit ?? 50)), Math.max(0, Number(req.query.offset ?? 0))] });
  return { ledger: r.rows };
});
