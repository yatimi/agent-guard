// Author: Tommy
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiClient } from '../server/ai-client.mjs';
import { readJson } from '../server/json-file.mjs';

// Point only this test at the local Postman stand-in. No real provider key.
const directory = await mkdtemp(join(tmpdir(), 'agentguard-ai-failure-'));
try {
  const client = new AiClient({ apiKey: 'simulation-key-not-a-secret', stateDirectory: directory, endpoint: 'http://127.0.0.1:4010/ai/v1' });
  await assert.rejects(client.complete({ purpose: 'simulated-429', messages: [{ role: 'user', content: 'Return a short test response.' }] }), /Model HTTP 429/);
  const ledger = await readJson(join(directory, 'near-ai-budget.json'));
  assert.equal(ledger.requests.length, 1);
  assert.equal(ledger.reservedNanos, 10000000);
  assert.equal(ledger.requests[0].state, 'provider-error-reservation-held');
  console.log('PASS: real AiClient handled HTTP 429, made no inference retry, and retained its one-cent reservation. No provider credits used.');
} finally { await rm(directory, { recursive: true, force: true }); }
