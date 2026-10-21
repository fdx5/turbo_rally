import { route } from '../_lib/http';
import { endSession } from '../_lib/auth';
export default route(['POST'], async (req) => {
  endSession(req);
  return { ok: true };
});
