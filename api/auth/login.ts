import { route, HttpError } from '../_lib/http';
import { ready } from '../_lib/db';
import { checkLock, clearFailures, recordFailure, startSession, verifyPassword } from '../_lib/auth';
import { parse, Login } from '../_lib/validate';
import { loadProfile } from '../_lib/repo';

export default route(['POST'], async (req) => {
  const b = parse(Login, req.body);
  await checkLock(b.username);
  const c = await ready();
  const r = await c.execute({ sql: 'SELECT id, pw_hash, pw_salt FROM users WHERE username = ?', args: [b.username] });
  const u = r.rows[0];
  if (!u || !(await verifyPassword(b.password, String(u.pw_hash), String(u.pw_salt)))) {
    await recordFailure(b.username);
    throw new HttpError(401, '아이디 또는 비밀번호가 맞지 않아요');
  }
  await clearFailures(b.username);
  await c.execute({ sql: 'UPDATE users SET last_login_at = ? WHERE id = ?', args: [Date.now(), String(u.id)] });
  await startSession(req, String(u.id), b.remember !== false);
  return { profile: await loadProfile(String(u.id)) };
});
