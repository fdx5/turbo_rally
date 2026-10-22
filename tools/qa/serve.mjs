// Serve an already built game for browser QA without the Vite development optimizer.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.argv[2] ?? 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
http.createServer(async (req, res) => {
  const path = resolve(root, `.${new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html')}`);
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { const data = await readFile(path); res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404).end(); }
}).listen(5193, '127.0.0.1', () => console.log('QA server: http://127.0.0.1:5193'));
