import { route, HttpError } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { loadProfile, mutateProfile } from '../_lib/repo';
import { claimAttendance, spinRoulette } from '../../shared/progress';
import { z } from 'zod';
import { parse } from '../_lib/validate';
export default route(['GET', 'POST'], async (req) => {
  const uid = await requireUser(req);
  if (req.method === 'GET') {
    const p = await loadProfile(uid, 0);
    return { daily: p.daily, weekly: p.weekly, attendance: p.attendance };
  }
  const { action } = parse(z.object({ action: z.enum(['attendance', 'roulette']) }), req.body);
  const r = await mutateProfile(uid, (p) => {
    const res = action === 'attendance' ? claimAttendance(p) : spinRoulette(p);
    if (typeof res === 'string') throw new HttpError(400, res);
    return res;
  });
  return { profile: r.profile, result: r.result };
});
