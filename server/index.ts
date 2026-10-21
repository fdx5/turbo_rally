/**
 * Production server for Render.com (or any Node host): serves the built SPA from dist/ and
 * mounts the same /api/* handlers used on Vercel. Secrets come only from environment variables.
 *   start: npx tsx server/index.ts
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 10000);

if (process.env.NODE_ENV === 'production') {
  for (const k of ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'JWT_SECRET']) {
    if (!process.env[k]) console.warn(`[turbo-rally] WARNING: env ${k} is not set`);
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest']);
const handlers = new Map<string, (req: unknown, res: unknown) => Promise<void>>();
const gzCache = new Map<string, Buffer>();
let clientReady = existsSync(join(DIST, 'index.html'));
const BUILDING_PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="5"><title>TURBO RALLY</title></head><body style="margin:0;height:100vh;display:grid;place-items:center;background:#ffe9f2;font-family:sans-serif;color:#3d2c4e"><div style="text-align:center"><h1>TURBO RALLY</h1><p>게임을 준비하고 있어요… 잠시 후 자동으로 열려요</p></div></body></html>`;

async function apiHandler(path: string) {
  if (handlers.has(path)) return handlers.get(path)!;
  if (!/^[a-z0-9_/]+$/i.test(path) || path.split('/').some((p) => p.startsWith('_'))) return null;
  const file = join(ROOT, 'api', `${path}.ts`);
  if (!existsSync(file)) return null;
  const mod = await import(pathToFileURL(file).href);
  handlers.set(path, mod.default);
  return mod.default as (req: unknown, res: unknown) => Promise<void>;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname.startsWith('/api/')) {
      const h = await apiHandler(url.pathname.slice(5).replace(/\/$/, ''));
      if (!h) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end('{"error":"not found"}');
      }
      return await h(req, res);
    }
    // client still being built (first boot without a build step): friendly retry page, never a crash
    if (!clientReady) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '5', 'Cache-Control': 'no-store' });
      return res.end(BUILDING_PAGE);
    }
    // static files with SPA fallback
    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = join(DIST, rel);
    if (!file.startsWith(DIST)) {
      res.writeHead(403);
      return res.end();
    }
    let st = await stat(file).catch(() => null);
    if (!st || st.isDirectory()) {
      const idx = join(file, 'index.html');
      if (st?.isDirectory() && existsSync(idx)) file = idx;
      else {
        rel = 'index.html';
        file = join(DIST, 'index.html');
      }
      st = await stat(file);
    }
    const ext = extname(file);
    const headers: Record<string, string> = { 'Content-Type': MIME[ext] ?? 'application/octet-stream' };
    if (file.includes(`${join(DIST, 'assets')}`) || file.includes(join(DIST, 'audio'))) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    else headers['Cache-Control'] = 'no-cache';
    let body = await readFile(file);
    if (COMPRESSIBLE.has(ext) && /gzip/.test(String(req.headers['accept-encoding'] ?? ''))) {
      let gz = gzCache.get(file);
      if (!gz) gzCache.set(file, (gz = gzipSync(body)));
      body = gz;
      headers['Content-Encoding'] = 'gzip';
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
// Open the port first (Render health/port scan), then build the client in the background
// if the host skipped the build step (e.g. Build Command = "npm install").
server.listen(PORT, () => console.log(`TURBO RALLY listening on :${PORT}`));
if (!clientReady) {
  console.log('[turbo-rally] dist/ not found — building client in background (vite build)…');
  const t0 = Date.now();
  import('vite')
    .then(({ build }) => build({ root: ROOT, configFile: join(ROOT, 'vite.config.ts'), logLevel: 'warn' }))
    .then(() => {
      clientReady = existsSync(join(DIST, 'index.html'));
      console.log(`[turbo-rally] client built in ${((Date.now() - t0) / 1000).toFixed(1)}s (ready=${clientReady})`);
    })
    .catch((e) => console.error('[turbo-rally] client build failed', e));
}
