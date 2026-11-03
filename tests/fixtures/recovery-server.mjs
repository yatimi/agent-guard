// Author: Tommy
// Isolated process fixture: no NEAR endpoints, credentials, Keychain or real signing.
import { createServer } from 'node:http';
import { appendFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PurchaseWorkflow } from '../../server/purchase-workflow.mjs';
import { localApi } from '../../server/local-api.mjs';
import { readJson } from '../../server/json-file.mjs';
import { buildIncidentReport, normalizeIncident } from '../../server/incident-report.mjs';
import { receiptFixture } from '../receipt-fixture.mjs';

const [directory, requestedMode] = process.argv.slice(2);
const mode = requestedMode.replace(/^incident-/, '');
const record = async kind => appendFile(join(directory, 'calls.ndjson'), JSON.stringify({ kind }) + '\n');
const hang = stage => { process.send({ stage }); return new Promise(() => {}); };
const config = { network: 'testnet', owner: 'owner.testnet', vault: 'vault.testnet', supplier: 'supplier.testnet', agentPublicKey: 'agent' };
const state = { owner: config.owner, policy: { agent_key: 'agent', recipients: [config.supplier], per_payment: '100000000000000000000000', per_day: '200000000000000000000000', lifetime_budget: '500000000000000000000000' }, next_nonce: '2', daily_spent: '0', total_spent: '0', pending: null, paused: false };
const rpc = {
  query: async args => args.request_type === 'view_access_key'
    ? { permission: { FunctionCall: { receiver_id: config.vault, method_names: ['pay'], allowance: '100000000000000000000000' } } }
    : { code_hash: 'BC9G5oZ61QQXi87HNmCYTwGSzb3zojE5VBybwbPNgr4d', amount: '6500000000000000000000000', storage_usage: 1000 },
  view: async () => state,
  call: async (method, args) => {
    if (method === 'broadcast_tx_commit') { await record('broadcast'); if (mode === 'hang-broadcast') return hang('broadcast'); return {}; }
    if (method !== 'tx') throw new Error('Unexpected RPC call');
    await record('receipt');
    for (const name of await readdir(join(directory, 'purchases'))) {
      if (!name.endsWith('.json')) continue;
      const run = await readJson(join(directory, 'purchases', name));
      if (run.payment?.hash === args.tx_hash) return receiptFixture(run.payment, config);
    }
    throw new Error('Unknown fixture transaction');
  },
};
const dataset = { title: 'Fixture six-block snapshot', metrics: {}, limitations: [], blocks: [] };
dataset.sha256 = createHash('sha256').update(JSON.stringify(dataset)).digest('hex');
const workflow = new PurchaseWorkflow({ config, rpc, directory,
  supplier: { collect: async () => dataset },
  wallet: { sign: async (_method, args) => { await record('sign'); return { encoded: 'FAKE-SIGNED-BYTES', hash: `fixture-hash-${args.nonce}`, argsText: JSON.stringify(args) }; } },
  ai: { complete: async request => {
    await record(request.tools ? 'proposal' : 'summary');
    if (!request.tools) { if (mode === 'hang-summary') return hang('summary'); return { content: 'Fixture summary.' }; }
    if (mode === 'hang-planning') return hang('planning');
    const quote = JSON.parse(request.messages[1].content.split('Owner-approved quote: ')[1].split('\n')[0]);
    return { model: 'fixture', toolCalls: [{ type: 'function', function: { name: 'propose_payment', arguments: JSON.stringify({ recipient: quote.recipient, amount_yocto: quote.amountYocto, invoice_id: quote.id }) } }] };
  } },
});
if (requestedMode.startsWith('incident-')) {
  const evidence = JSON.parse(await readFile(new URL('../../docs/runtime-verification.json', import.meta.url)));
  const raw = evidence.cases.find(c => c.case === 'failed-transfer').evidence.finalRpcReceipt;
  workflow.incidents = { collect: async target => buildIncidentReport(normalizeIncident(raw, target), new Date().toISOString(), 'recorded-local-sandbox'), verify: async () => {} };
}
const api = localApi(workflow);
const server = createServer((request, response) => api(request, response, new URL(request.url, 'http://127.0.0.1:4173')));
server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
