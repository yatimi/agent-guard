// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeIncident, buildIncidentReport, incidentTarget, verifyIncidentReport, digest } from '../server/incident-report.mjs';
const evidence = JSON.parse(await readFile(new URL('../docs/runtime-verification.json', import.meta.url)));
const rawFor = name => structuredClone(evidence.cases.find(c => c.case === name).evidence.finalRpcReceipt);
const targetFor = raw => ({ network: 'testnet', transactionHash: raw.transaction.hash, sender: raw.transaction.signer_id });
const reportFor = raw => buildIncidentReport(normalizeIncident(raw, targetFor(raw)), '2026-11-03T00:00:00Z', 'recorded-local-sandbox');
test('failed overall status preserves the successful transfer before a callback gas failure', () => {
  const report = reportFor(rawFor('callback-gas-fault'));
  assert.equal(report.free, false); assert.equal(report.failures.length, 1);
  assert.equal(report.transfers.find(t => !t.system).outcome, 'confirmed');
  assert.match(report.diagnosis, /confirmed native transfer/); assert.match(report.nextStep, /Do not send/);
});
test('successful false return preserves failed transfer and separates system refunds', () => {
  const report = reportFor(rawFor('failed-transfer'));
  assert.equal(report.free, false); assert.equal(report.returnsFalse.length, 1);
  assert.equal(report.transfers.find(t => !t.system).outcome, 'failed');
  assert.ok(report.transfers.some(t => t.system && t.to === 'vault.test.near' && t.outcome === 'confirmed'));
});
test('confirmed public testnet purchase yields a free result', async () => {
  const raw = JSON.parse(await readFile(new URL('../docs/incident-product-evidence.json', import.meta.url))).publicRpcProbe.body.result;
  assert.equal(reportFor(raw).free, true);
});
for (const [name, mutate] of [
  ['nonfinal', r => { r.final_execution_status = 'EXECUTED'; }],
  ['missing body', r => { r.receipts.pop(); }],
  ['missing outcome', r => { r.receipts_outcome.pop(); }],
  ['duplicate body', r => r.receipts.push(r.receipts[0])],
  ['duplicate outcome', r => r.receipts_outcome.push(r.receipts_outcome[0])],
  ['wrong executor', r => { r.receipts_outcome[0].outcome.executor_id = 'other.test.near'; }],
  ['missing forwarded result', r => { r.receipts_outcome[0].outcome.status = { SuccessReceiptId: '11111111111111111111111111111111' }; }],
  ['cyclic forwarded result', r => { r.receipts_outcome[0].outcome.status = { SuccessReceiptId: r.receipts_outcome[0].id }; }],
  ['inconsistent overall status', r => { r.status = { SuccessValue: 'dHJ1ZQ==' }; }],
  ['unknown child', r => r.receipts_outcome[0].outcome.receipt_ids.push('11111111111111111111111111111111')],
  ['cycle', r => r.receipts_outcome[0].outcome.receipt_ids.push(r.receipts_outcome[0].id)],
  ['unknown action', r => { r.receipts[1].receipt.Action.actions = [{ DeleteAccount: { beneficiary_id: 'any.near' } }]; }],
]) test(`incomplete or unsupported trace fails before quoting: ${name}`, () => {
  const raw = rawFor('failed-transfer'); mutate(raw); assert.throws(() => reportFor(raw));
});
test('target and delivered report cannot be swapped or altered', () => {
  const raw = rawFor('failed-transfer'), target = targetFor(raw), report = reportFor(raw);
  assert.throws(() => normalizeIncident(raw, { ...target, sender: 'other.near' }), /MISMATCH/);
  assert.throws(() => verifyIncidentReport({ ...report, diagnosis: 'Refund everything' }, target, report.sha256), /MISMATCH/);
  assert.throws(() => incidentTarget({ ...target, url: 'http://localhost' }), /INVALID/);
  assert.throws(() => incidentTarget({ ...target, sender: undefined }), /INVALID/);
  verifyIncidentReport(report, target, report.sha256);
});
test('source hash is stable across metadata and receipt ordering differences', () => {
  const raw = rawFor('failed-transfer'), a = normalizeIncident(raw, targetFor(raw));
  raw.receipts.reverse(); raw.receipts_outcome.reverse(); raw.transaction_outcome.proof = [];
  assert.equal(digest(a), digest(normalizeIncident(raw, targetFor(raw))));
});

test('numeric yocto amounts are rejected before rounding can enter the report', () => {
  const raw = rawFor('failed-transfer'); raw.receipts[1].receipt.Action.actions[0].Transfer.deposit = 10000000000000000001;
  assert.throws(() => reportFor(raw), /UNSUPPORTED/);
});
test('a local receipt that returns a promise has committed its native transfer', () => {
  const raw = rawFor('callback-gas-fault'), root = raw.receipts[0];
  root.receipt.Action.actions.unshift({ Transfer: { deposit: '1' } }); raw.transaction.actions = structuredClone(root.receipt.Action.actions);
  const report = reportFor(raw), transfer = report.transfers.find(t => t.receiptId === root.receipt_id);
  assert.equal(transfer.outcome, 'confirmed'); assert.doesNotMatch(report.diagnosis, /before/);
});

test('successful token-only execution cannot become a paid native-NEAR diagnosis', async () => {
  const raw = structuredClone(JSON.parse(await readFile(new URL('../docs/incident-product-evidence.json', import.meta.url))).publicRpcProbe.body.result);
  const transfer = raw.receipts.find(r => r.predecessor_id === 'guard.yatimi.testnet' && r.receiver_id === 'supplier.yatimi.testnet');
  transfer.receipt.Action.actions = [{ FunctionCall: { method_name: 'ft_transfer', args: '', deposit: '1', gas: 1000000000000 } }];
  const report = reportFor(raw); assert.equal(report.free, true); assert.equal(report.transfers.filter(t => !t.system).length, 0);
  assert.match(report.diagnosis, /does not confirm/);
});
