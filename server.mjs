import http from 'node:http';
import https from 'node:https';
import {isIPv6} from 'node:net';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
const port = Number(process.env.PORT || process.env.DEV_SERVER_PORT || 5173);
const host = process.env.DEV_SERVER_HOST || '127.0.0.1';
const backend = new URL(process.env.API_ORIGIN || 'http://127.0.0.1:8080');
const transport = backend.protocol === 'https:' ? https : http;
const proxyTimeoutMs = Number(process.env.API_PROXY_TIMEOUT_MS || 15000);
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      const upstream = transport.request(backend, {
        path:req.url, method:req.method, headers:{...req.headers,host:backend.host}}, response => {
        res.writeHead(response.statusCode, response.headers);
        response.on('error', () => res.destroy());
        response.pipe(res);
      });
      res.on('close', () => upstream.destroy());
      upstream.setTimeout(proxyTimeoutMs, () => upstream.destroy(new Error('API timeout')));
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502, {'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify({message:'백엔드 서버를 먼저 실행해주세요. (npm start)'}));
        else res.destroy();
      });
      req.pipe(upstream);
      return;
    }
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(target);
    res.writeHead(200, {'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache'}).end(data);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, host, () => {
  const urlHost = isIPv6(host) ? `[${host}]` : host;
  console.log(`LifeQuest: http://${urlHost}:${server.address().port}`);
});
