// Author: Tommy
// Re-check recorded public outputs without model, network, keys or signing.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkRecordedSource } from '../benchmarks/recorded-source.mjs';
import { purchasePrompt } from '../server/purchase-prompt.mjs';
import { deterministicControls, evaluateResponse, summarize } from '../benchmarks/payment-evaluation.mjs';
const root = new URL('../', import.meta.url);
const report = JSON.parse(await readFile(new URL('docs/security-benchmark.json', root), 'utf8'));
const suite = JSON.parse(await readFile(new URL('benchmarks/payment-cases.json', root), 'utf8'));
assert.equal(report.mode, 'live-model-proposals-only');
assert.equal(report.suiteVersion, suite.version);
assert.deepEqual(report.plannedCases, suite.cases);
const sources = ['benchmarks/payment-cases.json', 'benchmarks/payment-evaluation.mjs', 'benchmarks/run-cases.mjs',
  'scripts/benchmark-security.mjs', 'server/ai-client.mjs', 'server/purchase-prompt.mjs', 'server/payment-proposal.mjs'];
assert.deepEqual(Object.keys(report.sourceSha256).sort(), [...sources].sort());
for (const name of sources) {
  const revision = await checkRecordedSource(root, name, report.sourceSha256[name]);
  if (revision !== 'current') console.log(`Recorded source: ${name} uses ${revision}; new transport behavior is not established by this replay.`);
}
assert.equal(report.attempts.length, suite.cases.length);
assert.equal(report.state, 'completed');
for (const [index, attempt] of report.attempts.entries()) {
  const fixture = suite.cases[index];
  assert.equal(attempt.id, fixture.id); assert.equal(attempt.kind, fixture.kind);
  assert.equal(attempt.state, 'completed');
  assert.deepEqual(attempt.request, purchasePrompt(report.quote, fixture.supplierText));
  const observedAt = Date.parse(attempt.finishedAt);
  assert.ok(Number.isFinite(observedAt));
  assert.deepEqual(attempt.outcome, evaluateResponse(fixture, attempt.response, report.quote, observedAt));
}
assert.deepEqual(report.summary, summarize(suite.cases, report.attempts));
assert.deepEqual(report.deterministicControls, deterministicControls(suite.cases, report.quote, Date.parse(report.startedAt)));
console.log(`Verified ${report.attempts.length} recorded model outputs and ${report.deterministicControls.length} validator controls against exact source hashes.`);
console.log('New model calls: 0. Transactions: 0. This checks recorded-output consistency, not provider attestation or new model behavior.');
