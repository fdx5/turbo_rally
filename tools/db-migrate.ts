// Apply db/migrations to the database in TURSO_* env (reads .env.local), then list tables.
import { readFileSync, existsSync } from 'node:fs';
if (existsSync('.env.local')) for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { ready } = await import('../api/_lib/db.ts');
const c = await ready();
const t = await c.execute("SELECT type, name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name");
console.log('target:', process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.replace(/\/\/.*@/, '//') : 'local file');
for (const r of t.rows) {
  let n = '';
  if (r.type === 'table') n = ' rows=' + (await c.execute(`SELECT COUNT(*) n FROM ${r.name}`)).rows[0].n;
  console.log(`${r.type}\t${r.name}${n}`);
}
