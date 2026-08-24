/* Static server for the legacy app with no-store cache headers — the
   preview browser must never serve a stale index.html/styles.css. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const root = process.cwd();
http.createServer(async (req, res) => {
  const p = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = normalize(join(root, p === '/' ? '/index.html' : p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'cache-control': 'no-store' });
    res.end('not found: ' + p);
  }
}).listen(8080, '0.0.0.0', () => console.log('legacy app on :8080 (no-store cache)'));
