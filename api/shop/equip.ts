import { route, HttpError } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { mutateProfile } from '../_lib/repo';
import { equip, setLoadout } from '../../shared/progress';
import { z } from 'zod';
import { parse } from '../_lib/validate';
import { CHAR_BY_ID, type CharId } from '../../src/data/characters';
import { CATEGORIES, type CosCategory } from '../../src/data/cosmetics';

const Body = z.object({
  charId: z.string().max(10).optional(),
  itemId: z.string().max(40).nullable().optional(),
  cat: z.string().max(12).optional(),
  loadout: z.array(z.string().max(40)).max(3).optional(),
  select: z.object({ charId: z.string().max(10), vehicleId: z.string().max(20) }).optional(),
});
export default route(['POST'], async (req) => {
  const uid = await requireUser(req);
  const b = parse(Body, req.body);
  const r = await mutateProfile(uid, (p) => {
    if (b.loadout) setLoadout(p, b.loadout);
    if (b.select) {
      if (!CHAR_BY_ID[b.select.charId as CharId] || !p.unlockedVehicles.includes(b.select.vehicleId)) throw new HttpError(400, '선택할 수 없어요');
      p.selectedChar = b.select.charId as CharId;
      p.selectedVehicle = b.select.vehicleId;
    }
    if (b.charId && b.cat) {
      if (!CHAR_BY_ID[b.charId as CharId] || !CATEGORIES.some((c) => c.id === b.cat)) throw new HttpError(400, 'bad slot');
      const e = equip(p, b.charId as CharId, b.itemId ?? null, b.cat as CosCategory);
      if (e) throw new HttpError(400, e);
    }
    return true;
  });
  return { profile: r.profile };
});
