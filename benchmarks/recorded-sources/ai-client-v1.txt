// Author: Tommy
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { withFileLock } from './file-lock.mjs';
import { readJson, writeJson } from './json-file.mjs';

export const inferenceParameters = Object.freeze({ max_tokens: 768, temperature: 0, reasoning_effort: 'low', thinking_token_budget: 64 });

export class AiClient {
  constructor({ apiKey, stateDirectory, endpoint = 'https://cloud-api.near.ai/v1', model = 'z-ai/glm-5.3-flash', timeoutMs = 45000 }) {
    this.apiKey = apiKey?.trim();
    this.stateDirectory = stateDirectory;
    this.endpoint = endpoint;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async complete({ messages, tools, purpose }) {
    if (!this.apiKey) throw new Error('Set NEAR_AI_API_KEY in your local .env.');
    const headers = { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
    const catalogResponse = await fetch(`${this.endpoint}/models`, { headers, redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs) });
    if (!catalogResponse.ok) throw new Error(`Model catalog HTTP ${catalogResponse.status}`);
    const model = (await catalogResponse.json()).data?.find(item => item.id === this.model);
    if (!model || model.is_ready !== true || (tools && !model.supported_features?.includes('tools'))) throw new Error('Configured model is not ready for this operation.');
    const prices = [model.pricing?.prompt, model.pricing?.completion, model.pricing?.request];
    if (prices.some(value => typeof value !== 'string' || !value.trim())) throw new Error('Model pricing is unavailable.');
    const rates = prices.map(Number);
    if (rates.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Model pricing is unavailable.');
    const payload = { model: this.model, messages, ...inferenceParameters, ...(tools ? { tools, tool_choice: 'auto' } : {}) };
    const body = JSON.stringify(payload);
    if (Buffer.byteLength(body) > 18000) throw new Error('Model input is too large.');
    const upperBound = ((Buffer.byteLength(body) + 4096) * rates[0] + inferenceParameters.max_tokens * rates[1] + rates[2]) * 1e9;
    if (upperBound > 10000000) throw new Error('Model request exceeds the per-attempt budget.');
    await mkdir(this.stateDirectory, { recursive: true, mode: 0o700 });
    // The same ledger is used by the CLI smoke check. Hold reservations after errors.
    return withFileLock(join(this.stateDirectory, 'near-ai-budget.lockfile'), async () => {
      const ledgerPath = join(this.stateDirectory, 'near-ai-budget.json');
      const ledger = await readJson(ledgerPath, { authorizedLimitUsd: 1, reservedNanos: 0, requests: [] });
      if (ledger.authorizedLimitUsd !== 1 || !Number.isSafeInteger(ledger.reservedNanos) || ledger.reservedNanos < 0 || !Array.isArray(ledger.requests)) throw new Error('Invalid AI budget ledger.');
      if (ledger.reservedNanos + 10000000 > 1000000000) throw new Error('Authorized $1 AI budget is exhausted.');
      const entry = { purpose, model: this.model, reservedNanos: 10000000, at: new Date().toISOString(), state: 'reserved-before-send' };
      ledger.requests.push(entry);
      ledger.reservedNanos += entry.reservedNanos;
      await writeJson(ledgerPath, ledger);
      let response;
      try {
        response = await fetch(`${this.endpoint}/chat/completions`, { method: 'POST', headers, body,
          redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs) });
      } catch {
        entry.state = 'unknown-provider-outcome-reservation-held';
        await writeJson(ledgerPath, ledger);
        throw new Error('Model request timed out or could not connect. No automatic retry was made.');
      }
      entry.httpStatus = response.status;
      if (!response.ok) {
        entry.state = 'provider-error-reservation-held';
        await writeJson(ledgerPath, ledger);
        throw new Error(`Model HTTP ${response.status}. No automatic retry was made.`);
      }
      const result = await response.json();
      const message = result.choices?.[0]?.message;
      if (!message) throw new Error('Model returned no message.');
      const usage = result.usage ?? {};
      entry.state = 'completed-reservation-held';
      entry.promptTokens = usage.prompt_tokens ?? null;
      entry.completionTokens = usage.completion_tokens ?? null;
      entry.estimatedCostUsd = Number.isSafeInteger(usage.prompt_tokens) && Number.isSafeInteger(usage.completion_tokens)
        ? usage.prompt_tokens * rates[0] + usage.completion_tokens * rates[1] + rates[2] : null;
      await writeJson(ledgerPath, ledger);
      // Never expose or persist reasoning_content or authentication headers.
      return { model: this.model, content: typeof message.content === 'string' ? message.content.slice(0, 8000) : '',
        toolCalls: message.tool_calls ?? [], usage: { promptTokens: entry.promptTokens, completionTokens: entry.completionTokens },
        estimatedCostUsd: entry.estimatedCostUsd };
    });
  }
}
