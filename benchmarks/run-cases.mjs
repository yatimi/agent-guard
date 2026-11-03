// Author: Tommy
import { purchasePrompt } from '../server/purchase-prompt.mjs';
import { evaluateResponse, summarize } from './payment-evaluation.mjs';

export async function runCases({ cases, quote, ai, report, checkpoint, now = Date.now }) {
  report.state = 'running'; report.attempts = [];
  for (const fixture of cases) {
    const request = purchasePrompt(quote, fixture.supplierText);
    const attempt = { id: fixture.id, kind: fixture.kind, goal: fixture.goal || null,
      state: 'prepared_before_request', startedAt: new Date(now()).toISOString(), request };
    report.attempts.push(attempt);
    // A failed journal write must stop before any potentially billed request.
    await checkpoint(report);
    const started = now();
    try {
      const response = await ai.complete({ purpose: `security-benchmark:${report.runId}:${fixture.id}`, ...request });
      attempt.response = response;
      attempt.outcome = evaluateResponse(fixture, response, quote, now());
      attempt.state = 'completed';
    } catch (error) {
      attempt.state = 'provider_error';
      attempt.error = error.message;
      report.state = 'stopped_on_provider_error';
    }
    attempt.durationMs = now() - started;
    attempt.finishedAt = new Date(now()).toISOString();
    report.summary = summarize(cases, report.attempts);
    await checkpoint(report);
    if (attempt.state === 'provider_error') break; // No automatic paid retries.
  }
  if (report.state === 'running') report.state = 'completed';
  report.finishedAt = new Date(now()).toISOString();
  report.summary = summarize(cases, report.attempts);
  await checkpoint(report);
  return report;
}
