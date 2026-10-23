import { createClient, type Client, type InStatement } from '@libsql/client';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Turso/libSQL client. The token only ever lives in server env vars (§12.1).
 * Local dev without TURSO_* falls back to a file database in .data/ (git-ignored).
 */
let client: Client | null = null;
let migrated: Promise<void> | null = null;

export function db(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  } else {
    const dir = join(process.cwd(), '.data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    client = createClient({ url: `file:${join(dir, process.env.TR_LOCAL_DB || 'local.db').replace(/\\/g, '/')}` });
  }
  return client;
}

export async function ready(): Promise<Client> {
  const c = db();
  if (!migrated) {
    migrated = (async () => {
      const sql = readFileSync(join(process.cwd(), 'db', 'migrations', '0001_init.sql'), 'utf8');
      const stmts = sql
        .split(/;\s*\n/)
        .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
        .filter(Boolean);
      await c.batch(stmts, 'write');
      // Additive, idempotent migration: old races stay available in history.
      for (const table of ['races', 'time_attack_records']) {
        const columns = await c.execute(`PRAGMA table_info(${table})`);
        if (!columns.rows.some(row => row.name === 'layout_version'))
          await c.execute(`ALTER TABLE ${table} ADD COLUMN layout_version INTEGER NOT NULL DEFAULT 1`);
      }
    })().catch((e) => {
      migrated = null;
      throw e;
    });
  }
  await migrated;
  return c;
}

export async function batch(stmts: InStatement[]) {
  if (!stmts.length) return;
  await db().batch(stmts, 'write');
}
