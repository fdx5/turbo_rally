import { route, HttpError } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { mutateProfile } from '../_lib/repo';
import { buy } from '../../shared/progress';
import { z } from 'zod';
import { parse } from '../_lib/validate';
export default route(['POST'], async (req) => {
  const uid = await requireUser(req);
  const { itemId } = parse(z.object({ itemId: z.string().max(40) }), req.body);
  const r = await mutateProfile(uid, (p) => {
    const e = buy(p, itemId);
    if (e) throw new HttpError(400, e);
    return true;
  });
  return { profile: r.profile };
});
