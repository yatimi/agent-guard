// Author: Tommy
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
const root = fileURLToPath(new URL('../web/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
export function siteServer({ api, transformIndex = html => html }) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) { await api(request, response, url); return; }
      const path = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || !['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(403).end('Forbidden'); return;
      }
      let body = await readFile(path);
      if (path.toLowerCase() === resolve(root, 'index.html').toLowerCase()) body = await transformIndex(body.toString('utf8'));
      response.writeHead(200, { 'Content-Type': types[extname(path).toLowerCase()] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404).end('Not found'); }
  });
}
