import { route } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { loadRaces } from '../_lib/repo';
export default route(['GET'], async (req) => {
  const uid = await requireUser(req);
  const limit = Math.min(100, Number(req.query.limit ?? 20));
  const offset = Math.max(0, Number(req.query.offset ?? 0));
  return { races: await loadRaces(uid, limit, offset, { track: req.query.track, mode: req.query.mode }) };
});
