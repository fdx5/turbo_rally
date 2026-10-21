-- TURBO RALLY schema (§12.3). Idempotent: safe to run on every cold start.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  pw_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  is_guest_migrated INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  gold INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  selected_character TEXT,
  selected_vehicle TEXT,
  total_play_ms INTEGER DEFAULT 0,
  login_streak INTEGER DEFAULT 0,
  last_daily_claim TEXT,
  gold_earned INTEGER DEFAULT 0,
  gold_spent INTEGER DEFAULT 0,
  extra_json TEXT DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS guests (
  guest_id TEXT PRIMARY KEY,
  created_at INTEGER,
  races_played INTEGER DEFAULT 0,
  migrated_user_id TEXT
);
CREATE TABLE IF NOT EXISTS races (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  guest_id TEXT,
  mode TEXT,
  track_id TEXT,
  difficulty TEXT,
  character_id TEXT,
  vehicle_id TEXT,
  position INTEGER,
  total_ms INTEGER,
  best_lap_ms INTEGER,
  coins INTEGER,
  gold_earned INTEGER,
  started_at INTEGER,
  finished_at INTEGER,
  valid INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS race_entrants (
  race_id TEXT,
  slot INTEGER,
  character_id TEXT,
  vehicle_id TEXT,
  name TEXT,
  is_player INTEGER,
  position INTEGER,
  total_ms INTEGER
);
CREATE TABLE IF NOT EXISTS lap_times (race_id TEXT, lap INTEGER, ms INTEGER);
CREATE TABLE IF NOT EXISTS race_item_stats (race_id TEXT, item_id TEXT, used INTEGER, hits INTEGER, got_hit INTEGER);
CREATE TABLE IF NOT EXISTS time_attack_records (
  user_id TEXT,
  track_id TEXT,
  vehicle_id TEXT,
  character_id TEXT,
  total_ms INTEGER,
  best_lap_ms INTEGER,
  ghost_blob BLOB,
  created_at INTEGER,
  PRIMARY KEY (user_id, track_id)
);
CREATE TABLE IF NOT EXISTS unlocks (user_id TEXT, kind TEXT, ref_id TEXT, unlocked_at INTEGER, PRIMARY KEY (user_id, kind, ref_id));
CREATE TABLE IF NOT EXISTS track_stars (user_id TEXT, track_id TEXT, stars INTEGER, PRIMARY KEY (user_id, track_id));
CREATE TABLE IF NOT EXISTS inventory (user_id TEXT, item_id TEXT, kind TEXT, acquired_at INTEGER, PRIMARY KEY (user_id, item_id));
CREATE TABLE IF NOT EXISTS equipment (user_id TEXT, character_id TEXT, slot TEXT, item_id TEXT, PRIMARY KEY (user_id, character_id, slot));
CREATE TABLE IF NOT EXISTS weapon_loadout (user_id TEXT, slot INTEGER, weapon_id TEXT, PRIMARY KEY (user_id, slot));
CREATE TABLE IF NOT EXISTS gold_ledger (id TEXT PRIMARY KEY, user_id TEXT, delta INTEGER, reason TEXT, ref_id TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS achievements (user_id TEXT, achievement_id TEXT, progress INTEGER, completed_at INTEGER, PRIMARY KEY (user_id, achievement_id));
CREATE TABLE IF NOT EXISTS daily_missions (user_id TEXT, date TEXT, mission_id TEXT, progress INTEGER, claimed INTEGER, PRIMARY KEY (user_id, date, mission_id));
CREATE TABLE IF NOT EXISTS login_attempts (username TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS race_tickets (race_id TEXT PRIMARY KEY, user_id TEXT, track_id TEXT, mode TEXT, difficulty TEXT, started_at INTEGER, used INTEGER DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_races_user ON races(user_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_races_track ON races(track_id, mode);
CREATE INDEX IF NOT EXISTS idx_ta_track ON time_attack_records(track_id, total_ms);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON gold_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(username, ts);
