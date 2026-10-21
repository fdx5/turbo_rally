import { route } from '../_lib/http';
import { currentUser } from '../_lib/auth';
import { loadProfile } from '../_lib/repo';
export default route(['GET'], async (req) => {
  const u = await currentUser(req);
  if (!u) return null;
  try {
    return { profile: await loadProfile(u) };
  } catch {
    return null;
  }
});
