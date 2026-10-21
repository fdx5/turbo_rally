import { route, HttpError } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { loadProfile, mutateProfile } from '../_lib/repo';
import { claimMission } from '../../shared/progress';
import { z } from 'zod';
import { parse } from '../_lib/validate';
export default route(['GET', 'POST'], async (req) => {
  const uid = await requireUser(req);
  if (req.method === 'GET') {
    const p = await loadProfile(uid, 0);
    return { daily: p.daily.missions, weekly: p.weekly.missions };
  }
  const { id } = parse(z.object({ id: z.string().max(30) }), req.body);
  const r = await mutateProfile(uid, (p) => {
    const e = claimMission(p, id);
    if (e) throw new HttpError(400, e);
    return true;
  });
  return { profile: r.profile };
});
