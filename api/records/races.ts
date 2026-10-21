import { route } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { countRaces, loadRaces, type RaceFilter } from '../_lib/repo';

/** Public race log of every member (mine=1 narrows it to the signed-in user). */
export default route(['GET'], async (req) => {
  const q = req.query;
  const uid = q.mine === '1' ? await requireUser(req) : null;
  const limit = Math.max(1, Math.min(100, Number(q.limit) || 20));
  const offset = Math.max(0, Number(q.offset) || 0);
  const days = Math.max(0, Math.min(3650, Number(q.days) || 0));
  const str = (v: string | undefined) => (v ? String(v).slice(0, 32) : undefined);
  const filter: RaceFilter = {
    track: str(q.track),
    mode: str(q.mode),
    char: str(q.char),
    vehicle: str(q.vehicle),
    since: days ? Date.now() - days * 864e5 : undefined,
    sort: str(q.sort),
  };
  const [races, total] = await Promise.all([loadRaces(uid, limit, offset, filter), countRaces(uid, filter)]);
  return { races, total };
});
