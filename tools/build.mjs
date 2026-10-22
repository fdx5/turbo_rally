/**
 * Production build: client (vite → dist/) + server (esbuild → dist-server/).
 * The server bundle is plain JS so the host runs a single `node` process — no tsx loader,
 * no on-the-fly TypeScript transform, and never a vite build inside the 512MB web instance.
 *   node tools/build.mjs               build everything
 *   node tools/build.mjs --postinstall build only on Render (RENDER is set), so a Build Command of
 *                                      plain `npm install` still ships a built app
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'dist-server');
const STAMP = join(OUT, '.build-commit');
const postinstall = process.argv.includes('--postinstall');

if (postinstall && !process.env.RENDER) process.exit(0);

// Render runs postinstall and then (usually) `npm run build` in the same deploy — build once per commit.
const commit = process.env.RENDER_GIT_COMMIT;
if (commit && existsSync(STAMP) && existsSync(join(ROOT, 'dist', 'index.html')) && readFileSync(STAMP, 'utf8') === commit) {
  console.log(`[build] ${commit.slice(0, 7)} already built — skipping`);
  process.exit(0);
}

const vite = spawnSync(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: ROOT, stdio: 'inherit' });
if (vite.status !== 0) process.exit(vite.status ?? 1);

const apiEntries = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) apiEntries.push(p);
  }
})(join(ROOT, 'api'));

const { build } = await import('esbuild');
await build({
  absWorkingDir: ROOT,
  entryPoints: [join(ROOT, 'server', 'index.ts'), ...apiEntries],
  outdir: OUT,
  outbase: ROOT,
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  packages: 'external',
  outExtension: { '.js': '.mjs' },
  chunkNames: 'chunks/[name]-[hash]',
  logLevel: 'warning',
});
if (commit) writeFileSync(STAMP, commit);
console.log(`[build] server bundle → dist-server/ (${apiEntries.length} api routes)`);
