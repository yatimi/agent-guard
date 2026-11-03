// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { runIncidentCases } from '../benchmarks/incident-evaluation.mjs';
import { approvedCalls, forcedCalls, deterministicControls, evaluateResponse } from '../benchmarks/payment-evaluation.mjs';
import { incidentPurchasePrompt } from '../server/incident-prompt.mjs';
const { cases } = JSON.parse(await readFile(new URL('../benchmarks/incident-cases.json', import.meta.url)));
const now = Date.parse('2026-11-03T12:00:00Z');
const quote = { id: 'incident', recipient: 'supplier.testnet', amountYocto: '10000000000000000000000', expiresAt: new Date(now + 600000).toISOString(), task: { version: 'incident-v1', target: { network: 'testnet', transactionHash: '22222222222222222222222222222222', sender: 'customer.testnet' } }, reportSha256: '0'.repeat(64) };
test('current incident corpus has 4 benign and 11 independently rejected payment deviations', () => {
  assert.equal(cases.filter(c => c.kind === 'benign').length, 4);
  assert.equal(cases.filter(c => c.kind === 'attack').length, 11);
  assert.equal(new Set(cases.map(c => c.id)).size, 15);
  const controls = deterministicControls(cases, quote, now);
  assert.equal(controls.length, 14); assert.ok(controls.every(c => c.passed));
  for (const fixture of cases.filter(c => c.kind === 'attack')) {
    const outcome = evaluateResponse(fixture, { toolCalls: forcedCalls(fixture.goal, quote) }, quote, now);
    assert.equal(outcome.attackGoalObserved, true, fixture.id); assert.equal(outcome.guard.accepted, false, fixture.id);
  }
});
test('current evaluation records the production incident prompt before each call and stops on error', async () => {
  let calls = 0; const checkpoints = [], report = { runId: 'test' };
  await runIncidentCases({ cases, quote, report, now: () => now, checkpoint: async value => checkpoints.push(structuredClone(value)),
    ai: { complete: async request => {
      const fixture = cases[calls++];
      assert.equal(checkpoints.at(-1).attempts.at(-1).state, 'prepared_before_request');
      assert.deepEqual(request.messages, incidentPurchasePrompt(quote, fixture.supplierText).messages);
      assert.deepEqual(request.tools, incidentPurchasePrompt(quote, fixture.supplierText).tools);
      if (calls === 2) throw new Error('Model HTTP 503');
      return { toolCalls: approvedCalls(quote), content: '' };
    } },
  });
  assert.equal(calls, 2); assert.equal(report.state, 'stopped_on_provider_error');
  assert.equal(report.summary.providerFailures, 1); assert.equal(report.summary.unattempted.length, 13);
  assert.equal(report.attempts[1].error, 'Model HTTP 503');
  let called = false;
  await assert.rejects(runIncidentCases({ cases, quote, report: {}, checkpoint: async () => { throw new Error('disk failed'); }, ai: { complete: async () => { called = true; } } }), /disk failed/);
  assert.equal(called, false);
});
test('current evaluation preserves rejected and absent proposals without inventing containment', async () => {
  const report = { runId: 'mixed' }; let i = 0;
  await runIncidentCases({ cases, quote, report, now: () => now, checkpoint: async () => {}, ai: { complete: async () => {
    const fixture = cases[i++];
    return { toolCalls: fixture.kind === 'attack' ? (fixture.id === 'urgent_recovery_payment' ? forcedCalls(fixture.goal, quote) : []) : approvedCalls(quote) };
  } } });
  assert.equal(report.summary.benign.approved, 4);
  assert.equal(report.summary.attacks.requestedDeviationObserved, 1);
  assert.equal(report.summary.attacks.requestedDeviationBlocked, 1);
  assert.equal(report.summary.attacks.noProposal, 10);
  assert.equal(report.summary.attacks.requestedDeviationAccepted, 0);
});
test('default incident benchmark works without environment, model or wallet', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [new URL('../scripts/benchmark-incident.mjs', import.meta.url).pathname], { env: {} });
  assert.match(stdout, /AI calls: 0/); assert.match(stdout, /14 deterministic validator controls passed/);
});
test('expiry before a request spends nothing; an in-flight expired attack is not counted as containment', async () => {
  let calls = 0, time = now + 600000;
  const report = { runId: 'expired' }, attack = cases.find(c => c.kind === 'attack');
  const ai = { complete: async () => { calls++; time += 600000; return { toolCalls: forcedCalls(attack.goal, quote) }; } };
  await runIncidentCases({ cases: [attack], quote, report, ai, now: () => time, checkpoint: async () => {} });
  assert.equal(calls, 0); assert.equal(report.state, 'stopped_on_quote_expiry');
  assert.equal(report.summary.completed, 0); assert.deepEqual(report.summary.unattempted, [attack.id]);
  time = now;
  await runIncidentCases({ cases: [attack, cases[0]], quote, report, ai, now: () => time, checkpoint: async () => {} });
  assert.equal(calls, 1); assert.equal(report.state, 'stopped_on_quote_expiry');
  assert.ok(report.attempts[0].response); assert.equal(report.attempts[0].outcome, undefined);
  assert.deepEqual(report.summary.quoteExpiredAttempts, [attack.id]);
  assert.equal(report.summary.attacks.requestedDeviationBlocked, 0);
  assert.equal(report.summary.attacks.containmentRateWhenDeviationObserved, null);
  time = now; calls = 0;
  await runIncidentCases({ cases: [attack], quote, report, ai, now: () => time, checkpoint: async () => { time = now + 600000; } });
  assert.equal(calls, 0); assert.equal(report.attempts[0].requestSent, false);
});
