import { route, HttpError } from '../_lib/http';
import { ready } from '../_lib/db';
import { requireUser } from '../_lib/auth';
import { mutateProfile } from '../_lib/repo';
import { migrateGuest, type Profile } from '../../shared/progress';
import { COSMETIC_BY_ID } from '../../src/data/cosmetics';
import { VEHICLE_BY_ID } from '../../src/data/vehicles';
import { TRACK_BY_ID } from '../../src/data/tracks';

/** Guest → member migration (§11.2). Untrusted client data is sanitised; gold capped at 20,000. */
export default route(['POST'], async (req) => {
  const uid = await requireUser(req);
  const g = (req.body as { guest?: Profile }).guest;
  if (!g || typeof g !== 'object') throw new HttpError(400, 'no guest data');
  const c = await ready();
  const u = await c.execute({ sql: 'SELECT is_guest_migrated FROM users WHERE id = ?', args: [uid] });
  if (Number(u.rows[0]?.is_guest_migrated) === 1) throw new HttpError(409, '이미 이관했어요');
  const arr = (x: unknown) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string').slice(0, 400) : []);
  const clean = {
    gold: Math.max(0, Math.min(20000, Math.floor(Number(g.gold) || 0))),
    unlockedTracks: arr(g.unlockedTracks).filter((t) => TRACK_BY_ID[t]),
    unlockedVehicles: arr(g.unlockedVehicles).filter((v) => VEHICLE_BY_ID[v]),
    inventory: arr(g.inventory).filter((i) => COSMETIC_BY_ID[i]),
    stars: Object.fromEntries(Object.entries(g.stars ?? {}).filter(([t, v]) => TRACK_BY_ID[t] && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 7)),
    bestTA: {},
    bestRace: {},
    races: [],
    podiumTracks: arr(g.podiumTracks).filter((t) => TRACK_BY_ID[t]),
    counters: {},
  } as unknown as Profile;
  const r = await mutateProfile(uid, (p) => {
    migrateGuest(clean, p);
    p.ledger.unshift({ id: 'migrate-' + uid, t: Date.now(), delta: clean.gold, reason: '게스트 진행도 이관' });
    p.goldEarned += clean.gold;
    return true;
  });
  await c.execute({ sql: 'UPDATE users SET is_guest_migrated = 1 WHERE id = ?', args: [uid] });
  if (g.guestId) await c.execute({ sql: 'UPDATE guests SET migrated_user_id = ? WHERE guest_id = ?', args: [uid, String(g.guestId).slice(0, 80)] });
  return { profile: r.profile };
});
