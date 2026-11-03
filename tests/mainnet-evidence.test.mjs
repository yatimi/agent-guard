// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeIncident, buildIncidentReport, digest } from '../server/incident-report.mjs';
import { incidentHandoff } from '../web/incident-handoff.mjs';
test('recorded mainnet success preserves nested failure without inventing native delivery or refund', async () => {
  const saved = JSON.parse(await readFile(new URL('../docs/mainnet-incident-evidence.json', import.meta.url)));
  const source = normalizeIncident(saved.result, saved.target);
  assert.equal(saved.target.network, 'mainnet');
  assert.equal(saved.target.transactionHash, '2KhhB1uDScGCFQfVchep7DiZTGTxMcgfUYHNzwf5e6uL');
  assert.equal(source.status.SuccessValue, 'IjAi');
  assert.equal(saved.observations.length, 2);
  for (const observation of saved.observations) {
    assert.equal(digest(source), observation.normalizedSourceSha256);
    assert.equal(digest(saved.result), observation.resultSha256);
    assert.ok(Number.isFinite(Date.parse(observation.observedAt)));
  }
  const report = buildIncidentReport(source, saved.observations[0].observedAt, saved.endpoint);
  assert.equal(report.coverage.receipts, 6); assert.equal(report.failures.length, 1);
  assert.equal(report.failures[0].receiptId, 'CxvDaRanH6cWxAvBAdFC1APYUcFdT5tehf4jgMpeqNii');
  assert.match(report.failures[0].error, /E51: contract paused/);
  assert.ok(source.receipts.some(r => r.to === 'wrap.near' && r.actions.some(a => a.FunctionCall?.method_name === 'ft_resolve_transfer') && r.status.SuccessValue === 'IjAi'));
  assert.ok(report.transfers.length); assert.ok(report.transfers.every(t => t.system));
  const handoff = incidentHandoff(report, { mode: 'recorded', network: 'mainnet' });
  assert.match(handoff.headline, /not established/);
  assert.match(handoff.supportText, /Recorded evidence — mainnet/);
  assert.match(handoff.supportText, /No replacement payment or refund is authorized/);
});
