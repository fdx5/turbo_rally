import { route } from './_lib/http';
import { ready } from './_lib/db';
export default route(['GET'], async () => {
  await ready();
  return { ok: true, t: Date.now() };
});
