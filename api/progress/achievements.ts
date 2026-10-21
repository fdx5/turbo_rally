import { route } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { loadProfile } from '../_lib/repo';
export default route(['GET'], async (req) => {
  const p = await loadProfile(await requireUser(req), 0);
  return { achievements: p.achievements, titles: p.titles };
});
