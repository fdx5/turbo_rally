// API integration test against the local libSQL file DB (no network).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { priceOf } from '../shared/progress';

process.env.TURSO_DATABASE_URL = '';
process.env.TR_LOCAL_DB = 'test.db';
const dbFile = join(process.cwd(), '.data', 'test.db');
let cookie = '';
async function call(path: string, body?: unknown, opts: { csrf?: boolean; method?: string } = {}) {
  const mod = await import(/* @vite-ignore */ pathToFileURL(join(process.cwd(), 'api', path.split('?')[0] + '.ts')).href);
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), {
    method: opts.method ?? (body === undefined ? 'GET' : 'POST'),
    url: '/api/' + path,
    headers: { cookie, ...(opts.csrf === false ? {} : { 'x-tr-client': 'turbo-rally' }) },
  });
  let status = 0;
  let out = '';
  const headers: Record<string, unknown> = {};
  const res = {
    set statusCode(v: number) { status = v; },
    get statusCode() { return status; },
    setHeader: (k: string, v: unknown) => (headers[k.toLowerCase()] = v),
    end: (s: string) => (out = s),
  };
  await mod.default(req, res);
  const sc = headers['set-cookie'] as string[] | undefined;
  if (sc) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  return { status, json: JSON.parse(out) };
}

describe('api', () => {
  beforeAll(() => {
    try { rmSync(dbFile); } catch { /* fresh */ }
  });
  it('health', async () => {
    expect((await call('health')).json.ok).toBe(true);
  });
  it('rejects missing CSRF header', async () => {
    expect((await call('auth/login', { username: 'x', password: 'y' }, { csrf: false })).status).toBe(403);
  });
  it('signup → welcome gift, login, me', async () => {
    const r = await call('auth/signup', { username: 'tester_01', password: 'abcd1234', nickname: '테스터' });
    expect(r.status).toBe(200);
    expect(r.json.profile.gold).toBe(8000);
    expect(r.json.profile.inventory).toContain('hat_welcome');
    expect((await call('auth/signup', { username: 'tester_01', password: 'abcd1234', nickname: '또또' })).status).toBe(409);
    cookie = '';
    expect((await call('auth/login', { username: 'tester_01', password: 'wrongpw11' })).status).toBe(401);
    const ok = await call('auth/login', { username: 'tester_01', password: 'abcd1234', remember: true });
    expect(ok.status).toBe(200);
    const me = await call('auth/me');
    expect(me.json.profile.username).toBe('tester_01');
  });
  it('race finish: valid race pays gold server-side, cheated race is rejected', async () => {
    const s = await call('race/start', { trackId: 't1', mode: 'race', difficulty: 'normal' });
    expect(s.status).toBe(200);
    const base = { raceId: s.json.raceId, token: s.json.token, mode: 'race', trackId: 't1', difficulty: 'normal', charId: 'momo', vehicleId: 'coupang', coins: 5, mt3: 2, hitsDealt: 1, entrants: [], items: {} };
    // impossible lap time
    const bad = await call('race/finish', { ...base, position: 1, totalMs: 30000, bestLapMs: 10000, lapTimes: [10000, 10000, 10000] });
    expect(bad.status).toBe(422);
    const s2 = await call('race/start', { trackId: 't1', mode: 'race', difficulty: 'normal' });
    // wall-clock check: race "finished" 130s after a ticket issued now -> clock mismatch
    const tooFast = await call('race/finish', { ...base, raceId: s2.json.raceId, token: s2.json.token, position: 1, totalMs: 130000, bestLapMs: 42000, lapTimes: [44000, 43000, 43000] });
    expect(tooFast.status).toBe(422);
  });
  it('valid race is accepted, gold computed on server and persisted', async () => {
    const { signToken } = await import('../api/_lib/auth');
    const { ready } = await import('../api/_lib/db');
    const me = (await call('auth/me')).json.profile;
    const t = Date.now() - 140000;
    const rid = 'race-valid-1';
    await (await ready()).execute({ sql: 'INSERT INTO race_tickets VALUES (?,?,?,?,?,?,0)', args: [rid, me.userId, 't2', 'race', 'normal', t] });
    const token = await signToken({ rid, sub: me.userId, t, track: 't2', mode: 'race', diff: 'normal' }, '2h');
    const body = { raceId: rid, token, mode: 'race', trackId: 't2', difficulty: 'normal', charId: 'momo', vehicleId: 'coupang', position: 2, totalMs: 136000, bestLapMs: 44000, lapTimes: [46000, 45000, 45000], coins: 5, mt3: 3, hitsDealt: 2,
      entrants: [{ charId: 'momo', vehicleId: 'coupang', name: '테스터', isPlayer: true, position: 2, totalMs: 136000 }], items: { jelly: { used: 2, hits: 1, gotHit: 0 } } };
    const r = await call('race/finish', body);
    expect(r.status).toBe(200);
    // 2nd place 1100 ×1.25 diff, first podium +3000, coins +50, first race today ×2
    expect(r.json.out.reward.total).toBeGreaterThan(8000);
    expect(r.json.profile.gold).toBeGreaterThanOrEqual(me.gold + r.json.out.reward.total);
    expect(r.json.profile.races[0].id).toBe(rid);
    expect(r.json.profile.unlockedTracks).toContain('t3');
    expect(r.json.profile.races[0].items.jelly.hits).toBe(1);
    // replay of the same ticket is refused
    expect((await call('race/finish', body)).status).toBe(409);
  });
  it('shop buy deducts gold & equip works; insufficient gold rejected', async () => {
    const price = priceOf((await call('auth/me')).json.profile, 'hat_01');
    const b = await call('shop/buy', { itemId: 'hat_01' });
    expect(b.status).toBe(200);
    expect(b.json.profile.inventory).toContain('hat_01');
    expect((await call('shop/buy', { itemId: 'hat_20' })).status).toBe(400);
    const e = await call('shop/equip', { charId: 'momo', itemId: 'hat_01', cat: 'hat' });
    expect(e.json.profile.equipment.momo.hat).toBe('hat_01');
    const led = await call('dashboard/ledger');
    expect(led.json.ledger.some((l: { delta: number; ref_id: string }) => l.ref_id === 'hat_01' && l.delta === -price!)).toBe(true);
  });
  it('attendance & roulette once per day', async () => {
    expect((await call('progress/daily', { action: 'attendance' })).status).toBe(200);
    expect((await call('progress/daily', { action: 'attendance' })).status).toBe(400);
    expect((await call('progress/daily', { action: 'roulette' })).status).toBe(200);
    expect((await call('progress/daily', { action: 'roulette' })).status).toBe(400);
  });
  it('persists both daily rewards again on the next Korean day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 86400000);
    try {
      const daily = await call('progress/daily');
      expect(daily.json.attendance.claimedToday).toBe(false);
      expect(daily.json.daily.roulette).toBe(false);
      const attendance = await call('progress/daily', { action: 'attendance' });
      expect(attendance.status).toBe(200);
      expect(attendance.json.result.day).toBe(2);
      const roulette = await call('progress/daily', { action: 'roulette' });
      expect(roulette.status).toBe(200);
      const me = (await call('auth/me')).json.profile;
      expect(me.attendance.claimedToday).toBe(true);
      expect(me.daily.roulette).toBe(true);
      expect(me.gold).toBe(roulette.json.profile.gold);
      expect((await call('progress/daily', { action: 'attendance' })).status).toBe(400);
      expect((await call('progress/daily', { action: 'roulette' })).status).toBe(400);
    } finally {
      vi.useRealTimers();
    }
  });
  it('guest race is recorded and public records list every racer', async () => {
    const { signToken } = await import('../api/_lib/auth');
    const { ready } = await import('../api/_lib/db');
    const memberCookie = cookie;
    cookie = '';
    const guestId = 'guest-abcd1234';
    expect((await call('race/start', { trackId: 't1', mode: 'race', difficulty: 'normal' })).status).toBe(401);
    expect((await call('race/start', { trackId: 't1', mode: 'race', difficulty: 'normal', guestId })).status).toBe(200);
    const t = Date.now() - 140000;
    const rid = 'race-guest-1';
    await (await ready()).execute({ sql: 'INSERT INTO race_tickets VALUES (?,?,?,?,?,?,0)', args: [rid, 'g:' + guestId, 't2', 'race', 'normal', t] });
    const token = await signToken({ rid, sub: 'g:' + guestId, t, track: 't2', mode: 'race', diff: 'normal' }, '2h');
    const body = { raceId: rid, token, guestId, gold: 1234, mode: 'race', trackId: 't2', difficulty: 'normal', charId: 'momo', vehicleId: 'coupang', position: 1, totalMs: 130000, bestLapMs: 42000, lapTimes: [44000, 43000, 43000], coins: 3, mt3: 1, hitsDealt: 0,
      entrants: [{ charId: 'momo', vehicleId: 'coupang', name: '게스트', isPlayer: true, position: 1, totalMs: 130000 }], items: {} };
    // another guest cannot submit this ticket
    expect((await call('race/finish', { ...body, guestId: 'guest-other' })).status).toBe(403);
    expect((await call('race/finish', body)).status).toBe(200);
    const all = await call('records/races?track=t2&sort=totalMs');
    expect(all.json.total).toBe(2);
    expect(all.json.races.map((r: { nickname: string }) => r.nickname)).toEqual(['게스트#1234', '테스터']);
    expect(all.json.races[0].gold).toBe(1234);
    expect((await call('records/races?mine=1')).status).toBe(401);
    const tr = await call('records/tracks');
    expect(tr.json.tracks.t2).toMatchObject({ plays: 2, players: 2, race: { nickname: '게스트#1234', ms: 130000 } });
    cookie = memberCookie;
    const mine = await call('records/races?mine=1');
    expect(mine.json.races.every((r: { nickname: string }) => r.nickname === '테스터')).toBe(true);
  });
  it('login lockout after 5 failures', async () => {
    for (let i = 0; i < 5; i++) await call('auth/login', { username: 'tester_01', password: 'nope12345' });
    expect((await call('auth/login', { username: 'tester_01', password: 'abcd1234' })).status).toBe(429);
  });
});
