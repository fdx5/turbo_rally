// End-to-end API smoke test against the configured database (Turso via .env.local).
// Creates a qa_* account, exercises the main flows, verifies rows, then deletes the QA data.
import { readFileSync, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
if (existsSync('.env.local')) for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
let cookie = '';
async function call(path: string, body?: unknown) {
  const mod = await import(pathToFileURL(join(process.cwd(), 'api', path.split('?')[0] + '.ts')).href);
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), { method: body === undefined ? 'GET' : 'POST', url: '/api/' + path, headers: { cookie, 'x-tr-client': 'turbo-rally' } });
  let status = 0, out = '';
  const headers: Record<string, unknown> = {};
  await mod.default(req, { set statusCode(v: number) { status = v; }, get statusCode() { return status; }, setHeader: (k: string, v: unknown) => (headers[k.toLowerCase()] = v), end: (s: string) => (out = s) });
  const sc = headers['set-cookie'] as string[] | undefined;
  if (sc) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  return { status, json: JSON.parse(out) };
}
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) process.exitCode = 1; };
const user = 'qa_' + Date.now().toString(36);
const h = await call('health'); ok(h.json.ok, 'health');
const s = await call('auth/signup', { username: user, password: 'qaTest1234', nickname: 'QA봇' });
ok(s.status === 200 && s.json.profile.gold === 8000, `signup ${user} → 8,000G + 웰컴 모자 (${s.json.profile?.gold})`);
const uid = s.json.profile.userId;
cookie = '';
ok((await call('auth/login', { username: user, password: 'wrong12345' })).status === 401, 'wrong password rejected');
ok((await call('auth/login', { username: user, password: 'qaTest1234', remember: true })).status === 200, 'login');
ok((await call('auth/me')).json?.profile?.username === user, 'session /auth/me');
const { signToken } = await import('../api/_lib/auth.ts');
const { db } = await import('../api/_lib/db.ts');
const c = db();
const t = Date.now() - 140000, rid = crypto.randomUUID();
await c.execute({ sql: 'INSERT INTO race_tickets VALUES (?,?,?,?,?,?,0)', args: [rid, uid, 't2', 'race', 'normal', t] });
const token = await signToken({ rid, sub: uid, t, track: 't2', mode: 'race', diff: 'normal' }, '2h');
const r = await call('race/finish', { raceId: rid, token, mode: 'race', trackId: 't2', difficulty: 'normal', charId: 'momo', vehicleId: 'coupang', position: 1, totalMs: 136000, bestLapMs: 44000, lapTimes: [46000, 45000, 45000], coins: 6, mt3: 4, hitsDealt: 2, entrants: [{ charId: 'momo', vehicleId: 'coupang', name: 'QA봇', isPlayer: true, position: 1, totalMs: 136000 }], items: { jelly: { used: 2, hits: 1, gotHit: 0 } } });
if (r.status !== 200) console.log('race/finish ->', r.status, JSON.stringify(r.json));
ok(r.status === 200, `race/finish accepted, server gold +${r.json.out?.reward?.total}`);
ok(r.json.profile?.unlockedTracks?.includes('t3'), 'track 3 unlocked by podium on track 2');
const st = await call('race/start', { trackId: 't1', mode: 'race', difficulty: 'easy' });
ok((await call('race/finish', { raceId: st.json.raceId, token: st.json.token, mode: 'race', trackId: 't1', difficulty: 'easy', charId: 'momo', vehicleId: 'coupang', position: 1, totalMs: 20000, bestLapMs: 6000, lapTimes: [7000, 7000, 6000], coins: 0, mt3: 0, hitsDealt: 0, entrants: [], items: {} })).status === 422, 'impossible time rejected (anti-cheat)');
const b = await call('shop/buy', { itemId: 'hat_02' });
ok(b.status === 200 && b.json.profile.inventory.includes('hat_02'), 'shop buy');
ok((await call('shop/equip', { charId: 'momo', itemId: 'hat_02', cat: 'hat' })).json.profile?.equipment?.momo?.hat === 'hat_02', 'equip');
ok((await call('progress/daily', { action: 'attendance' })).status === 200, 'attendance');
ok((await call('dashboard/races')).json.races?.length === 1, 'dashboard/races');
ok((await call('dashboard/ledger')).json.ledger?.length >= 3, 'dashboard/ledger');
ok((await call('timeattack/leaderboard?track=t1')).status === 200, 'leaderboard');
const counts = await c.batch(['users', 'profiles', 'races', 'race_entrants', 'lap_times', 'race_item_stats', 'inventory', 'equipment', 'gold_ledger', 'unlocks', 'track_stars'].map((tb) => ({ sql: `SELECT '${tb}' t, COUNT(*) n FROM ${tb} WHERE ${tb === 'users' ? 'id' : tb.startsWith('race_') || tb === 'lap_times' ? 'race_id IN (SELECT id FROM races WHERE user_id = ?)' : 'user_id'} ${tb.startsWith('race_') || tb === 'lap_times' ? '' : '= ?'}`, args: [uid] })), 'read');
console.log('rows written:', counts.map((x) => `${x.rows[0].t}=${x.rows[0].n}`).join(' '));
// cleanup QA data
const raceIds = (await c.execute({ sql: 'SELECT id FROM races WHERE user_id = ?', args: [uid] })).rows.map((x) => String(x.id));
const del = [
  ...raceIds.flatMap((id) => ['race_entrants', 'lap_times', 'race_item_stats'].map((tb) => ({ sql: `DELETE FROM ${tb} WHERE race_id = ?`, args: [id] }))),
  ...['races', 'race_tickets', 'profiles', 'unlocks', 'track_stars', 'inventory', 'equipment', 'weapon_loadout', 'gold_ledger', 'achievements', 'daily_missions', 'time_attack_records'].map((tb) => ({ sql: `DELETE FROM ${tb} WHERE user_id = ?`, args: [uid] })),
  { sql: 'DELETE FROM login_attempts WHERE username = ?', args: [user] },
  { sql: 'DELETE FROM users WHERE id = ?', args: [uid] },
];
await c.batch(del, 'write');
console.log('cleanup: QA account and its rows deleted, users left =', (await c.execute('SELECT COUNT(*) n FROM users')).rows[0].n);
