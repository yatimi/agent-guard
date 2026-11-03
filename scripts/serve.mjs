// Author: Tommy
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { RpcClient } from '../server/rpc-client.mjs';
import { AiClient } from '../server/ai-client.mjs';
import { NetworkPulse } from '../server/network-pulse.mjs';
import { TestnetWallet } from '../server/testnet-wallet.mjs';
import { PurchaseWorkflow } from '../server/purchase-workflow.mjs';
import { localApi } from '../server/local-api.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const stateDirectory = resolve(project, '.local');
const config = JSON.parse(await readFile(resolve(project, 'testnet.json'), 'utf8'));
const rpc = new RpcClient('https://test.rpc.fastnear.com');
const workflow = new PurchaseWorkflow({ config, rpc, directory: stateDirectory,
  wallet: new TestnetWallet(config, rpc, stateDirectory),
  ai: new AiClient({ apiKey: process.env.NEAR_AI_API_KEY, stateDirectory }),
  supplier: new NetworkPulse(new RpcClient('https://free.rpc.fastnear.com')) });
const api = localApi(workflow);

const root = fileURLToPath(new URL('../web/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) { await api(request, response, url); return; }
    const path = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || !['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(403).end('Forbidden'); return;
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Agent Guard: http://127.0.0.1:4173'));
