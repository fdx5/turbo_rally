import { route } from '../_lib/http';
import { ready } from '../_lib/db';
import { z } from 'zod';
import { parse } from '../_lib/validate';
export default route(['POST'], async (req) => {
  const { guestId } = parse(z.object({ guestId: z.string().min(4).max(80) }), req.body);
  const c = await ready();
  await c.execute({ sql: 'INSERT OR IGNORE INTO guests (guest_id, created_at, races_played) VALUES (?,?,0)', args: [guestId, Date.now()] });
  return { ok: true };
});
