// Author: Tommy
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { siteServer } from '../server/site-server.mjs';
import { RpcClient } from '../server/rpc-client.mjs';
import { AiClient } from '../server/ai-client.mjs';
import { IncidentService } from '../server/incident-service.mjs';
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
  incidents: new IncidentService({ testnet: new RpcClient('https://test.rpc.fastnear.com', { timeoutMs: 10000 }), mainnet: new RpcClient('https://free.rpc.fastnear.com', { timeoutMs: 10000 }) }) });
siteServer({ api: localApi(workflow) }).listen(4173, '127.0.0.1', () => console.log('AgentGuard LIVE testnet: http://127.0.0.1:4173'));
