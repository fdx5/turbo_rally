import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HttpError, setCookie, type Req } from './http';
import { ready } from './db';

const pbkdf2Async = promisify(pbkdf2);
const ITER = 210_000; // §12.2

export async function hashPassword(pw: string, salt = randomBytes(16).toString('hex')) {
  const h = await pbkdf2Async(pw, salt, ITER, 32, 'sha256');
  return { hash: h.toString('hex'), salt };
}
export async function verifyPassword(pw: string, hash: string, salt: string) {
  const h = await pbkdf2Async(pw, salt, ITER, 32, 'sha256');
  const a = Buffer.from(hash, 'hex');
  return a.length === h.length && timingSafeEqual(a, h);
}

function secret(): Uint8Array {
  let s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new HttpError(500, 'JWT_SECRET 미설정');
    // local dev only: per-machine random secret in git-ignored .data/
    const dir = join(process.cwd(), '.data');
    const f = join(dir, 'dev-jwt-secret');
    if (!existsSync(f)) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(f, randomBytes(32).toString('hex'));
    }
    s = readFileSync(f, 'utf8');
  }
  return new TextEncoder().encode(s);
}
export async function signToken(claims: Record<string, unknown>, expires: string) {
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expires).sign(secret());
}
export async function verifyToken<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as T;
  } catch {
    return null;
  }
}

const COOKIE = 'tr_session';
export async function startSession(req: Req, userId: string, remember: boolean) {
  const days = remember ? 30 : 1;
  const tok = await signToken({ sub: userId }, `${days}d`);
  const secure = process.env.VERCEL || process.env.RENDER || (req.headers['x-forwarded-proto'] ?? '') === 'https' ? '; Secure' : '';
  setCookie(req, `${COOKIE}=${tok}; Path=/; HttpOnly; SameSite=Lax${secure}${remember ? `; Max-Age=${days * 86400}` : ''}`);
}
export function endSession(req: Req) {
  setCookie(req, `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
export async function currentUser(req: Req): Promise<string | null> {
  const t = req.cookies[COOKIE];
  if (!t) return null;
  const p = await verifyToken<{ sub: string }>(t);
  return p?.sub ?? null;
}
export async function requireUser(req: Req): Promise<string> {
  const u = await currentUser(req);
  if (!u) throw new HttpError(401, '로그인이 필요해요');
  return u;
}

/** 5 failures within 10 minutes → locked for 15 minutes (§12.2). */
export async function checkLock(username: string) {
  const c = await ready();
  const since = Date.now() - 15 * 60 * 1000;
  const r = await c.execute({ sql: 'SELECT ts FROM login_attempts WHERE username = ? AND ts > ? ORDER BY ts', args: [username, since] });
  const ts = r.rows.map((x) => Number(x.ts));
  for (let i = 0; i + 4 < ts.length; i++) {
    if (ts[i + 4] - ts[i] <= 10 * 60 * 1000) throw new HttpError(429, '로그인 실패가 많아 15분 동안 잠겼어요');
  }
}
export async function recordFailure(username: string) {
  const c = await ready();
  await c.execute({ sql: 'INSERT INTO login_attempts (username, ts) VALUES (?, ?)', args: [username, Date.now()] });
}
export async function clearFailures(username: string) {
  const c = await ready();
  await c.execute({ sql: 'DELETE FROM login_attempts WHERE username = ?', args: [username] });
}
