// Author: Tommy
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkRecordedSource } from '../benchmarks/recorded-source.mjs';
import { incidentPurchasePrompt } from '../server/incident-prompt.mjs';
import { inferenceParameters } from '../server/ai-client.mjs';
import { deterministicControls, evaluateResponse } from '../benchmarks/payment-evaluation.mjs';
import { incidentEvaluationSources, incidentEvaluationSummary } from '../benchmarks/incident-evaluation.mjs';
const root = new URL('../', import.meta.url);
const report = JSON.parse(await readFile(new URL('docs/incident-security-benchmark.json', root), 'utf8'));
const suite = JSON.parse(await readFile(new URL('benchmarks/incident-cases.json', root), 'utf8'));
assert.equal(report.mode, 'live-incident-proposals-only');
assert.equal(report.suiteVersion, suite.version);
assert.deepEqual(report.plannedCases, suite.cases);
assert.deepEqual(report.inferenceParameters, { ...inferenceParameters, tool_choice: 'auto' });
assert.equal(report.blockchainTransactionsSent, 0);
assert.deepEqual(Object.keys(report.sourceSha256).sort(), [...incidentEvaluationSources].sort());
for (const name of incidentEvaluationSources) {
  const revision = await checkRecordedSource(root, name, report.sourceSha256[name]);
  if (revision !== 'current') console.log(`Recorded source: ${name} uses ${revision}; new transport behavior is not established by this replay.`);
}
assert.equal(report.state, 'completed'); assert.equal(report.attempts.length, suite.cases.length);
for (const [index, attempt] of report.attempts.entries()) {
  const fixture = suite.cases[index];
  assert.equal(attempt.id, fixture.id); assert.equal(attempt.kind, fixture.kind); assert.equal(attempt.state, 'completed');
  assert.deepEqual(attempt.goal, fixture.goal || null);
  assert.deepEqual(attempt.request, incidentPurchasePrompt(report.quote, fixture.supplierText));
  const observedAt = Date.parse(attempt.finishedAt); assert.ok(Number.isFinite(observedAt));
  assert.ok(observedAt < Date.parse(report.quote.expiresAt), 'Expired quote is not a valid model-security observation');
  assert.deepEqual(attempt.outcome, evaluateResponse(fixture, attempt.response, report.quote, observedAt));
}
assert.deepEqual(report.summary, incidentEvaluationSummary(suite.cases, report.attempts));
assert.deepEqual(report.deterministicControls, deterministicControls(suite.cases, report.quote, Date.parse(report.startedAt)));
assert.ok(report.deterministicControls.every(item => item.passed));
assert.equal(report.summary.attacks.requestedDeviationAccepted, 0);
console.log(`Verified ${report.attempts.length} incident-v1 model outputs and ${report.deterministicControls.length} controls against exact source hashes. New AI calls: 0. Transactions: 0.`);
