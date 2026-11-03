// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { PurchaseWorkflow } from '../server/purchase-workflow.mjs';
import { receiptFixture } from './receipt-fixture.mjs';

async function fixture(t, { unknown = false, invalidProposal = false, summaryFailure = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'agentguard-workflow-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const config = { network: 'testnet', owner: 'owner.testnet', agentPublicKey: 'agent', vault: 'vault.testnet', supplier: 'supplier.testnet' };
  let signed = 0, broadcast = 0, calls = 0, payment;
  const state = { owner: config.owner, policy: { agent_key: 'agent', recipients: [config.supplier], per_payment: '100000000000000000000000', lifetime_budget: '500000000000000000000000' }, next_nonce: '2', total_spent: '0', pending: null, paused: false };
  const rpc = {
    query: async args => args.request_type === 'view_access_key' ? { permission: { FunctionCall: { receiver_id: config.vault, method_names: ['pay'], allowance: '100000000000000000000000' } } } : { code_hash: 'BC9G5oZ61QQXi87HNmCYTwGSzb3zojE5VBybwbPNgr4d', amount: '6500000000000000000000000' },
    view: async () => state,
    call: async method => {
      if (method === 'broadcast_tx_commit') { broadcast++; if (unknown) throw new Error('timeout'); return {}; }
      if (unknown) throw new Error('unknown transaction');
      return receiptFixture(payment, config);
    },
  };
  const dataset = { title: 'NEAR Mainnet Pulse', metrics: {}, limitations: [], blocks: [] };
  dataset.sha256 = createHash('sha256').update(JSON.stringify(dataset)).digest('hex');
  const workflow = new PurchaseWorkflow({ config, rpc, directory,
    supplier: { collect: async () => dataset },
    wallet: { sign: async (method, args) => { signed++; payment = { encoded: 'signed-bytes', hash: 'known-hash', argsText: JSON.stringify(args) }; return payment; } },
    ai: { complete: async request => {
      calls++;
      if (!request.tools) { if (summaryFailure) throw new Error('model timeout'); return { content: 'Six blocks only.' }; }
      const quote = JSON.parse(request.messages[1].content.split('Owner-approved quote: ')[1].split('\n')[0]);
      return { model: 'model', usage: {}, toolCalls: [{ type: 'function', function: { name: 'propose_payment', arguments: JSON.stringify({ recipient: invalidProposal ? 'attacker.testnet' : quote.recipient, amount_yocto: quote.amountYocto, invoice_id: quote.id }) } }] };
    } },
  });
  return { workflow, counts: () => ({ signed, broadcast, calls }), resolve: () => { unknown = false; } };
}
async function settled(workflow, id) {
  for (let i = 0; i < 100; i++) {
    const run = await workflow.load(id);
    if (['completed', 'blocked', 'needs_attention'].includes(run.state)) return run;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('test workflow did not settle');
}
test('repeated request and reopening a completed run never sign twice', async t => {
  const f = await fixture(t), id = randomUUID();
  await f.workflow.create(id, 'purchase'); await f.workflow.create(id, 'purchase');
  const run = await settled(f.workflow, id); assert.equal(run.state, 'completed');
  await f.workflow.resume(id);
  assert.deepEqual(f.counts(), { signed: 1, broadcast: 1, calls: 2 });
  assert.equal(f.workflow.public(run).payment, undefined);
});
test('changed recipient is blocked before signing', async t => {
  const f = await fixture(t, { invalidProposal: true }), id = randomUUID(); await f.workflow.create(id, 'injection');
  assert.equal((await settled(f.workflow, id)).error, 'RECIPIENT_NOT_APPROVED'); assert.equal(f.counts().signed, 0);
});
test('lost broadcast response survives restart and resolves by saved hash', async t => {
  const f = await fixture(t, { unknown: true }), id = randomUUID(); await f.workflow.create(id, 'purchase');
  assert.equal((await settled(f.workflow, id)).state, 'needs_attention');
  const restarted = new PurchaseWorkflow({ ...f.workflow });
  const second = randomUUID(); await restarted.create(second, 'purchase');
  assert.equal((await settled(restarted, second)).error, 'AN_EARLIER_PAYMENT_NEEDS_RECONCILIATION');
  f.resolve(); assert.equal((await restarted.resume(id)).state, 'completed');
  assert.equal(f.counts().signed, 1); assert.equal(f.counts().broadcast, 1);
});
test('summary failure preserves paid data and never repeats payment', async t => {
  const f = await fixture(t, { summaryFailure: true }), id = randomUUID(); await f.workflow.create(id, 'purchase');
  const run = await settled(f.workflow, id); assert.equal(run.state, 'completed'); assert.ok(run.proof); assert.match(run.summary, /No further payment/);
  await f.workflow.resume(id); assert.equal(f.counts().broadcast, 1);
});
