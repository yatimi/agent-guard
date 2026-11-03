// Author: Tommy
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { withFileLock } from './file-lock.mjs';
import { readJson, writeJson } from './json-file.mjs';
import { readHttpJson } from './http-json.mjs';

export const inferenceParameters = Object.freeze({ max_tokens: 768, temperature: 0, reasoning_effort: 'low', thinking_token_budget: 64 });

export class AiClient {
  constructor({ apiKey, stateDirectory, endpoint = 'https://cloud-api.near.ai/v1', model = 'z-ai/glm-5.3-flash', timeoutMs = 45000, maxResponseBytes = 2000000 }) {
    this.apiKey = apiKey?.trim();
    this.stateDirectory = stateDirectory;
    this.endpoint = endpoint;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
  }

  async complete({ messages, tools, purpose }) {
    if (!this.apiKey) throw new Error('Set NEAR_AI_API_KEY in your local .env.');
    const headers = { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
    const catalogResponse = await fetch(`${this.endpoint}/models`, { headers, redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs) });
    if (!catalogResponse.ok) {
      await catalogResponse.body?.cancel().catch(() => {});
      throw new Error(`Model catalog HTTP ${catalogResponse.status}`);
    }
    const catalog = await readHttpJson(catalogResponse, { maxBytes: this.maxResponseBytes, prefix: 'MODEL_CATALOG' });
    if (!Array.isArray(catalog.data)) throw new Error('MODEL_CATALOG_INVALID_RESPONSE');
    const model = catalog.data.find(item => item?.id === this.model);
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
        await response.body?.cancel().catch(() => {});
        entry.state = 'provider-error-reservation-held';
        await writeJson(ledgerPath, ledger);
        throw new Error(`Model HTTP ${response.status}. No automatic retry was made.`);
      }
      let result, message;
      try {
        result = await readHttpJson(response, { maxBytes: this.maxResponseBytes, prefix: 'MODEL' });
        message = result.choices?.[0]?.message;
        if (!message || typeof message !== 'object' || Array.isArray(message)
          || (message.content != null && typeof message.content !== 'string')
          || (message.tool_calls != null && !Array.isArray(message.tool_calls))) throw new Error('MODEL_INVALID_RESPONSE');
      } catch (error) {
        entry.state = 'invalid-provider-response-reservation-held';
        await writeJson(ledgerPath, ledger);
        throw error;
      }
      const usage = result.usage ?? {};
      entry.state = 'completed-reservation-held';
      const tokens = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
      entry.promptTokens = tokens(usage.prompt_tokens);
      entry.completionTokens = tokens(usage.completion_tokens);
      entry.estimatedCostUsd = entry.promptTokens !== null && entry.completionTokens !== null
        ? entry.promptTokens * rates[0] + entry.completionTokens * rates[1] + rates[2] : null;
      await writeJson(ledgerPath, ledger);
      // Never expose or persist reasoning_content or authentication headers.
      return { model: this.model, content: typeof message.content === 'string' ? message.content.slice(0, 8000) : '',
        toolCalls: message.tool_calls ?? [], usage: { promptTokens: entry.promptTokens, completionTokens: entry.completionTokens },
        estimatedCostUsd: entry.estimatedCostUsd };
    });
  }
}
