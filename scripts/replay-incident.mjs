// Author: Tommy
// Recompute facts from recorded public receipts. No RPC, keys or model calls.
import assert from 'node:assert/strict';
import { demoCases } from '../server/demo-cases.mjs';
const { cases } = await demoCases();
assert.equal(cases.length, 3);
for (const item of cases) assert.ok(Number.isFinite(Date.parse(item.report.observedAt)));
const callback = cases.find(c => c.id === 'callback-gas-fault').report;
assert.ok(callback.transfers.some(t => !t.system && t.outcome === 'confirmed'));
assert.ok(callback.failures.some(f => f.methods.includes('settle')));
const failed = cases.find(c => c.id === 'failed-transfer').report;
assert.ok(failed.transfers.some(t => !t.system && t.outcome === 'failed'));
assert.ok(failed.returnsFalse.length > 0);
const paid = cases.find(c => c.id === 'paid-testnet');
assert.notEqual(paid.fee.transactionHash, paid.report.target.transactionHash);
assert.ok(paid.report.failures.some(f => f.error.includes('RECIPIENT_NOT_ALLOWED')));
console.log('Verified three recorded incident cases, source-derived outcomes and delivered report/invoice hash.');
console.log('Offline consistency check only; no fresh chain query, AI call, signature or provider attestation.');
