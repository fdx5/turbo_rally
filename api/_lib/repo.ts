import type { InStatement, Row } from '@libsql/client';
import { ready, batch } from './db';
import { newProfile, refreshDaily, type Profile, type RaceRecord } from '../../shared/progress';
import { COSMETIC_BY_ID } from '../../src/data/cosmetics';
import { WEAPON_BY_ID } from '../../src/data/items';
import type { CharId } from '../../src/data/characters';
import type { CosCategory } from '../../src/data/cosmetics';

/** Fields of Profile that have no dedicated table live in profiles.extra_json. */
const EXTRA_KEYS = ['podiumTracks', 'bestRace', 'counters', 'titles', 'title', 'winStreak', 'guestRaces', 'attendance', 'weekly', 'recentVehicles', 'createdAt'] as const;

const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => (v == null ? '' : String(v));

export async function loadProfile(userId: string, withRaces = 200): Promise<Profile> {
  const c = await ready();
  const [u, pr, un, st, ta, inv, eq, wl, led, ach] = await c.batch(
    [
      { sql: 'SELECT username, nickname, created_at FROM users WHERE id = ?', args: [userId] },
      { sql: 'SELECT * FROM profiles WHERE user_id = ?', args: [userId] },
      { sql: 'SELECT kind, ref_id FROM unlocks WHERE user_id = ?', args: [userId] },
      { sql: 'SELECT track_id, stars FROM track_stars WHERE user_id = ?', args: [userId] },
      { sql: 'SELECT track_id, vehicle_id, character_id, total_ms, best_lap_ms, created_at FROM time_attack_records WHERE user_id = ?', args: [userId] },
      { sql: 'SELECT item_id FROM inventory WHERE user_id = ? ORDER BY acquired_at', args: [userId] },
      { sql: 'SELECT character_id, slot, item_id FROM equipment WHERE user_id = ?', args: [userId] },
      { sql: 'SELECT slot, weapon_id FROM weapon_loadout WHERE user_id = ? ORDER BY slot', args: [userId] },
      { sql: 'SELECT id, delta, reason, ref_id, created_at FROM gold_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 400', args: [userId] },
      { sql: 'SELECT achievement_id, progress, completed_at FROM achievements WHERE user_id = ?', args: [userId] },
    ],
    'read',
  );
  if (!u.rows.length) throw new Error('no user');
  const p = newProfile('u-' + userId, s(u.rows[0].nickname));
  p.userId = userId;
  p.username = s(u.rows[0].username);
  p.ledger = [];
  p.gold = 0;
  p.goldEarned = 0;
  const row = pr.rows[0];
  if (row) {
    p.gold = n(row.gold);
    p.xp = n(row.xp);
    p.level = n(row.level) || 1;
    p.selectedChar = (s(row.selected_character) || 'momo') as CharId;
    p.selectedVehicle = s(row.selected_vehicle) || 'coupang';
    p.totalPlayMs = n(row.total_play_ms);
    p.goldEarned = n(row.gold_earned);
    p.goldSpent = n(row.gold_spent);
    const extra = JSON.parse(s(row.extra_json) || '{}');
    for (const k of EXTRA_KEYS) if (extra[k] !== undefined) (p as unknown as Record<string, unknown>)[k] = extra[k];
    if (extra.daily) p.daily = { ...p.daily, ...extra.daily, missions: [] };
  }
  p.unlockedTracks = [...new Set([...p.unlockedTracks, ...un.rows.filter((r) => r.kind === 'track').map((r) => s(r.ref_id))])];
  p.unlockedVehicles = [...new Set([...p.unlockedVehicles, ...un.rows.filter((r) => r.kind === 'vehicle').map((r) => s(r.ref_id))])];
  for (const r of st.rows) p.stars[s(r.track_id)] = n(r.stars);
  for (const r of ta.rows) p.bestTA[s(r.track_id)] = { ms: n(r.total_ms), lap: n(r.best_lap_ms), vehicleId: s(r.vehicle_id), charId: s(r.character_id), at: n(r.created_at) };
  p.inventory = inv.rows.map((r) => s(r.item_id));
  for (const r of eq.rows) ((p.equipment[s(r.character_id) as CharId] ??= {}) as Record<string, string>)[s(r.slot)] = s(r.item_id);
  p.weaponLoadout = wl.rows.map((r) => s(r.weapon_id));
  p.ledger = led.rows.map((r) => ({ id: s(r.id), t: n(r.created_at), delta: n(r.delta), reason: s(r.reason), ref: s(r.ref_id) || undefined }));
  for (const r of ach.rows) p.achievements[s(r.achievement_id)] = { p: n(r.progress), done: r.completed_at ? n(r.completed_at) : undefined };
  // daily missions of the stored day
  if (p.daily.date) {
    const dm = await c.execute({ sql: 'SELECT mission_id, progress, claimed FROM daily_missions WHERE user_id = ? AND date = ?', args: [userId, p.daily.date] });
    p.daily.missions = dm.rows.map((r) => ({ id: s(r.mission_id), progress: n(r.progress), claimed: n(r.claimed) === 1 }));
  }
  if (withRaces) p.races = await loadRaces(userId, withRaces, 0);
  refreshDaily(p);
  return p;
}

export interface RaceFilter {
  track?: string;
  mode?: string;
  char?: string;
  vehicle?: string;
  since?: number;
  sort?: string;
}
export type PublicRace = RaceRecord & { userId: string; nickname: string };
const RACE_SORT: Record<string, string> = {
  at: 'r.finished_at DESC',
  position: 'r.position ASC, r.finished_at DESC',
  totalMs: 'r.total_ms ASC, r.finished_at DESC',
  gold: 'r.gold_earned DESC, r.finished_at DESC',
};

function raceWhere(userId: string | null, filter: RaceFilter) {
  const where = ['r.valid = 1'];
  const args: (string | number)[] = [];
  const eq = (col: string, v: string | number | undefined) => {
    if (v === undefined || v === '') return;
    where.push(`${col} = ?`);
    args.push(v);
  };
  eq('r.user_id', userId ?? undefined);
  eq('r.track_id', filter.track);
  eq('r.mode', filter.mode);
  eq('r.character_id', filter.char);
  eq('r.vehicle_id', filter.vehicle);
  if (filter.since) {
    where.push('r.finished_at > ?');
    args.push(filter.since);
  }
  return { sql: where.join(' AND '), args };
}

/** Number of valid races matching the filter (userId null = every member). */
export async function countRaces(userId: string | null, filter: RaceFilter = {}): Promise<number> {
  const c = await ready();
  const w = raceWhere(userId, filter);
  const r = await c.execute({ sql: `SELECT COUNT(*) n FROM races r WHERE ${w.sql}`, args: w.args });
  return n(r.rows[0]?.n);
}

/** Valid races, newest first by default. userId null = races of every member (public records). */
export async function loadRaces(userId: string | null, limit: number, offset: number, filter: RaceFilter = {}): Promise<PublicRace[]> {
  const c = await ready();
  const w = raceWhere(userId, filter);
  const order = RACE_SORT[filter.sort ?? ''] ?? RACE_SORT.at;
  const rs = await c.execute({
    sql: `SELECT r.*, u.nickname FROM races r LEFT JOIN users u ON u.id = r.user_id WHERE ${w.sql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    args: [...w.args, limit, offset],
  });
  if (!rs.rows.length) return [];
  const ids = rs.rows.map((r) => s(r.id));
  const ph = ids.map(() => '?').join(',');
  const [en, laps, its] = await c.batch(
    [
      { sql: `SELECT * FROM race_entrants WHERE race_id IN (${ph}) ORDER BY slot`, args: ids },
      { sql: `SELECT * FROM lap_times WHERE race_id IN (${ph}) ORDER BY lap`, args: ids },
      { sql: `SELECT * FROM race_item_stats WHERE race_id IN (${ph})`, args: ids },
    ],
    'read',
  );
  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const k = s(r.race_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  };
  const E = group(en.rows);
  const Lp = group(laps.rows);
  const It = group(its.rows);
  return rs.rows.map((r) => ({
    id: s(r.id),
    userId: s(r.user_id),
    nickname: s(r.nickname),
    mode: s(r.mode) as RaceRecord['mode'],
    trackId: s(r.track_id),
    difficulty: s(r.difficulty) as RaceRecord['difficulty'],
    charId: s(r.character_id) as CharId,
    vehicleId: s(r.vehicle_id),
    position: n(r.position),
    totalMs: n(r.total_ms),
    bestLapMs: n(r.best_lap_ms),
    lapTimes: (Lp.get(s(r.id)) ?? []).map((x) => n(x.ms)),
    coins: n(r.coins),
    gold: n(r.gold_earned),
    at: n(r.finished_at),
    entrants: (E.get(s(r.id)) ?? []).map((x) => ({ charId: s(x.character_id), vehicleId: s(x.vehicle_id), name: s(x.name), isPlayer: n(x.is_player) === 1, position: n(x.position), totalMs: n(x.total_ms) })),
    items: Object.fromEntries((It.get(s(r.id)) ?? []).map((x) => [s(x.item_id), { used: n(x.used), hits: n(x.hits), gotHit: n(x.got_hit) }])),
  }));
}

/** Persist the difference between two profile states (one atomic batch). */
export function diffStatements(userId: string, a: Profile, b: Profile): InStatement[] {
  const out: InStatement[] = [];
  const extra: Record<string, unknown> = {};
  for (const k of EXTRA_KEYS) extra[k] = (b as unknown as Record<string, unknown>)[k];
  extra.daily = { date: b.daily.date, firstRaceDone: b.daily.firstRaceDone, roulette: b.daily.roulette, discounts: b.daily.discounts, ta: b.daily.ta };
  out.push({
    sql: `INSERT INTO profiles (user_id, gold, xp, level, selected_character, selected_vehicle, total_play_ms, login_streak, last_daily_claim, gold_earned, gold_spent, extra_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET gold=excluded.gold, xp=excluded.xp, level=excluded.level, selected_character=excluded.selected_character,
          selected_vehicle=excluded.selected_vehicle, total_play_ms=excluded.total_play_ms, login_streak=excluded.login_streak,
          last_daily_claim=excluded.last_daily_claim, gold_earned=excluded.gold_earned, gold_spent=excluded.gold_spent, extra_json=excluded.extra_json`,
    args: [userId, b.gold, b.xp, b.level, b.selectedChar, b.selectedVehicle, b.totalPlayMs, b.attendance.streak, b.attendance.last, b.goldEarned, b.goldSpent, JSON.stringify(extra)],
  });
  const now = Date.now();
  for (const t of b.unlockedTracks) if (!a.unlockedTracks.includes(t)) out.push({ sql: 'INSERT OR IGNORE INTO unlocks VALUES (?,?,?,?)', args: [userId, 'track', t, now] });
  for (const v of b.unlockedVehicles) if (!a.unlockedVehicles.includes(v)) out.push({ sql: 'INSERT OR IGNORE INTO unlocks VALUES (?,?,?,?)', args: [userId, 'vehicle', v, now] });
  for (const [t, st] of Object.entries(b.stars)) if (a.stars[t] !== st) out.push({ sql: 'INSERT INTO track_stars VALUES (?,?,?) ON CONFLICT DO UPDATE SET stars=excluded.stars', args: [userId, t, st] });
  for (const [t, r] of Object.entries(b.bestTA)) {
    const prev = a.bestTA[t];
    if (!prev || prev.ms !== r.ms)
      out.push({
        sql: `INSERT INTO time_attack_records (user_id, track_id, vehicle_id, character_id, total_ms, best_lap_ms, created_at) VALUES (?,?,?,?,?,?,?)
              ON CONFLICT(user_id, track_id) DO UPDATE SET vehicle_id=excluded.vehicle_id, character_id=excluded.character_id, total_ms=excluded.total_ms, best_lap_ms=excluded.best_lap_ms, created_at=excluded.created_at`,
        args: [userId, t, r.vehicleId, r.charId, r.ms, r.lap, r.at],
      });
  }
  for (const it of b.inventory)
    if (!a.inventory.includes(it)) out.push({ sql: 'INSERT OR IGNORE INTO inventory VALUES (?,?,?,?)', args: [userId, it, COSMETIC_BY_ID[it] ? 'cosmetic' : WEAPON_BY_ID[it] ? 'weapon' : 'other', now] });
  if (JSON.stringify(a.equipment) !== JSON.stringify(b.equipment)) {
    out.push({ sql: 'DELETE FROM equipment WHERE user_id = ?', args: [userId] });
    for (const [ch, slots] of Object.entries(b.equipment)) for (const [slot, item] of Object.entries(slots ?? {})) if (item) out.push({ sql: 'INSERT INTO equipment VALUES (?,?,?,?)', args: [userId, ch, slot, item] });
  }
  if (JSON.stringify(a.weaponLoadout) !== JSON.stringify(b.weaponLoadout)) {
    out.push({ sql: 'DELETE FROM weapon_loadout WHERE user_id = ?', args: [userId] });
    b.weaponLoadout.forEach((w, i) => out.push({ sql: 'INSERT INTO weapon_loadout VALUES (?,?,?)', args: [userId, i + 1, w] }));
  }
  const seen = new Set(a.ledger.map((l) => l.id));
  for (const l of b.ledger) if (l.id && !seen.has(l.id)) out.push({ sql: 'INSERT OR IGNORE INTO gold_ledger VALUES (?,?,?,?,?,?)', args: [l.id, userId, l.delta, l.reason, l.ref ?? null, l.t] });
  for (const [id, st] of Object.entries(b.achievements)) {
    const p = a.achievements[id];
    if (!p || p.p !== st.p || p.done !== st.done)
      out.push({ sql: 'INSERT INTO achievements VALUES (?,?,?,?) ON CONFLICT DO UPDATE SET progress=excluded.progress, completed_at=excluded.completed_at', args: [userId, id, st.p, st.done ?? null] });
  }
  for (const m of b.daily.missions) out.push({ sql: 'INSERT INTO daily_missions VALUES (?,?,?,?,?) ON CONFLICT DO UPDATE SET progress=excluded.progress, claimed=excluded.claimed', args: [userId, b.daily.date, m.id, m.progress, m.claimed ? 1 : 0] });
  return out;
}

/** Load → mutate (shared rules) → persist diff. Returns the fresh profile. */
export async function mutateProfile<T>(userId: string, fn: (p: Profile) => T, extra: (p: Profile, r: T) => InStatement[] = () => []): Promise<{ profile: Profile; result: T }> {
  const before = await loadProfile(userId, 0);
  const after = structuredClone(before);
  const result = fn(after);
  await batch([...diffStatements(userId, before, after), ...extra(after, result)]);
  const profile = await loadProfile(userId);
  return { profile, result };
}
export type { CosCategory };
