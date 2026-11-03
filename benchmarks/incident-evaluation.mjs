// Author: Tommy
import { incidentPurchasePrompt } from '../server/incident-prompt.mjs';
import { evaluateResponse, summarize } from './payment-evaluation.mjs';

export const incidentEvaluationSources = [
  'benchmarks/incident-cases.json', 'benchmarks/incident-evaluation.mjs', 'benchmarks/payment-evaluation.mjs',
  'scripts/benchmark-incident.mjs', 'server/incident-prompt.mjs', 'server/payment-proposal.mjs', 'server/ai-client.mjs',
];
export function incidentEvaluationSummary(cases, attempts) {
  return { ...summarize(cases, attempts), quoteExpiredAttempts: attempts.filter(item => item.state === 'quote_expired').map(item => item.id) };
}
// Kept separate from the source-pinned historical snapshot runner.
export async function runIncidentCases({ cases, quote, ai, report, checkpoint, now = Date.now }) {
  const expiresAt = Date.parse(quote.expiresAt);
  if (!Number.isFinite(expiresAt)) throw new Error('INVALID_QUOTE_EXPIRY');
  report.state = 'running'; report.attempts = [];
  for (const fixture of cases) {
    if (now() >= expiresAt) { report.state = 'stopped_on_quote_expiry'; report.stoppedBeforeCaseId = fixture.id; break; }
    const request = incidentPurchasePrompt(quote, fixture.supplierText);
    const attempt = { id: fixture.id, kind: fixture.kind, goal: fixture.goal || null,
      state: 'prepared_before_request', startedAt: new Date(now()).toISOString(), request };
    report.attempts.push(attempt);
    await checkpoint(report); // Must persist before a potentially billed call.
    const started = now();
    if (started >= expiresAt) {
      attempt.state = 'quote_expired'; attempt.requestSent = false;
      attempt.finishedAt = new Date(started).toISOString();
      report.state = 'stopped_on_quote_expiry'; break;
    }
    try {
      const response = await ai.complete({ purpose: `incident-benchmark:${report.runId}:${fixture.id}`, ...request });
      attempt.response = response;
      const receivedAt = now();
      if (receivedAt >= expiresAt) { attempt.state = 'quote_expired'; report.state = 'stopped_on_quote_expiry'; }
      else { attempt.outcome = evaluateResponse(fixture, response, quote, receivedAt); attempt.state = 'completed'; }
    } catch (error) {
      attempt.state = 'provider_error'; attempt.error = error.message;
      report.state = 'stopped_on_provider_error';
    }
    attempt.durationMs = now() - started;
    attempt.finishedAt = new Date(now()).toISOString();
    report.summary = incidentEvaluationSummary(cases, report.attempts);
    await checkpoint(report);
    if (attempt.state !== 'completed') break;
  }
  if (report.state === 'running') report.state = 'completed';
  report.finishedAt = new Date(now()).toISOString();
  report.summary = incidentEvaluationSummary(cases, report.attempts);
  await checkpoint(report);
  return report;
}
