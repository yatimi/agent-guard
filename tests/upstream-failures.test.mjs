// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AiClient } from '../server/ai-client.mjs';
import { RpcClient } from '../server/rpc-client.mjs';

const catalog = { data: [{ id: 'fixture-model', is_ready: true, supported_features: ['tools'], pricing: { prompt: '0.0000001', completion: '0.0000001', request: '0' } }] };
const request = { purpose: 'isolated-failure', messages: [{ role: 'user', content: 'Fixture request.' }] };
async function fixture(t, handle, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'agentguard-upstream-'));
  const requests = [];
  const server = createServer(async (req, res) => {
    requests.push(req.url);
    for await (const chunk of req) { /* consume body, do not persist credentials */ }
    handle(req, res);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const ai = new AiClient({ apiKey: 'fixture-key-not-a-secret', stateDirectory: directory, model: 'fixture-model', endpoint, ...options });
  const ledger = async () => JSON.parse(await readFile(join(directory, 'near-ai-budget.json'), 'utf8'));
  return { ai, ledger, requests, endpoint, directory };
}
const json = (res, data) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };

test('catalog auth/server failure makes no completion request or budget reservation', async t => {
  for (const status of [401, 503]) {
    const f = await fixture(t, (req, res) => { res.writeHead(status); res.end('upstream private diagnostic'); });
    await assert.rejects(f.ai.complete(request), new RegExp(`Model catalog HTTP ${status}`));
    assert.deepEqual(f.requests, ['/models']); await assert.rejects(f.ledger(), { code: 'ENOENT' });
  }
});
test('completion auth/rate/server errors retain one reservation with no automatic retry', async t => {
  for (const status of [401, 429, 503]) {
    const f = await fixture(t, (req, res) => {
      if (req.url === '/models') return json(res, catalog);
      res.writeHead(status); res.end('private completion diagnostic');
    });
    await assert.rejects(f.ai.complete(request), new RegExp(`Model HTTP ${status}`));
    const ledger = await f.ledger(); assert.equal(ledger.reservedNanos, 10000000);
    assert.equal(ledger.requests.length, 1); assert.equal(ledger.requests[0].state, 'provider-error-reservation-held');
    assert.deepEqual(f.requests, ['/models', '/chat/completions']);
    assert.ok(!JSON.stringify(ledger).includes('private completion'));
  }
});
test('malformed and oversized AI bodies are bounded and never leak raw JSON diagnostics', async t => {
  const marker = 'PRIVATE_UPSTREAM_MARKER';
  for (const body of [marker, 'null', '[]', '{}', JSON.stringify({ choices: [{ message: { content: {}, tool_calls: [] } }] }), JSON.stringify({ choices: [{ message: { content: 'x'.repeat(4096) } }] })]) {
    const f = await fixture(t, (req, res) => req.url === '/models' ? json(res, catalog) : res.end(body), { maxResponseBytes: 1024 });
    await assert.rejects(f.ai.complete(request), error => /^MODEL_(INVALID_JSON|INVALID_RESPONSE|RESPONSE_TOO_LARGE)$/.test(error.message) && !error.message.includes(marker));
    const ledger = await f.ledger(); assert.equal(ledger.reservedNanos, 10000000);
    assert.equal(ledger.requests[0].state, 'invalid-provider-response-reservation-held');
    assert.ok(!JSON.stringify(ledger).includes(marker));
    assert.deepEqual(f.requests, ['/models', '/chat/completions']);
  }
});
test('catalog malformed/oversized responses stop before any billed completion', async t => {
  for (const body of ['secret-upstream-bytes', 'null', JSON.stringify({ data: {} }), JSON.stringify({ data: [], padding: 'x'.repeat(4096) })]) {
    const f = await fixture(t, (req, res) => res.end(body), { maxResponseBytes: 1024 });
    await assert.rejects(f.ai.complete(request), /MODEL_CATALOG_(INVALID_JSON|INVALID_RESPONSE|RESPONSE_TOO_LARGE)/);
    assert.deepEqual(f.requests, ['/models']); await assert.rejects(f.ledger(), { code: 'ENOENT' });
  }
});
test('AI timeout during headers or response body keeps reservation and permits a later independent call', async t => {
  for (const phase of ['headers', 'body']) {
    let fail = true;
    const f = await fixture(t, (req, res) => {
      if (req.url === '/models') return json(res, catalog);
      if (!fail) return json(res, { choices: [{ message: { content: 'Ready.', reasoning_content: 'do-not-store' } }], usage: { prompt_tokens: -1, completion_tokens: 2 } });
      if (phase === 'body') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); }
    }, { timeoutMs: 1000 });
    await assert.rejects(f.ai.complete(request), /timed out|MODEL_RESPONSE_TIMEOUT/);
    assert.equal((await f.ledger()).reservedNanos, 10000000);
    assert.deepEqual(f.requests, ['/models', '/chat/completions']);
    fail = false;
    const answer = await f.ai.complete({ ...request, purpose: 'separate-explicit-request' });
    assert.equal(answer.content, 'Ready.'); assert.equal(answer.usage.promptTokens, null); assert.equal(answer.estimatedCostUsd, null);
    assert.equal((await f.ledger()).reservedNanos, 20000000);
    assert.ok(!JSON.stringify(answer).includes('do-not-store'));
    assert.ok(!JSON.stringify(await f.ledger()).includes('do-not-store'));
  }
});
test('RPC malformed, oversized, missing, stalled and error results never become a success', async t => {
  for (const mode of ['malformed', 'null', 'oversized', 'missing', 'stalled', 'unavailable', 'unknown']) {
    const f = await fixture(t, (req, res) => {
      if (mode === 'stalled') { res.writeHead(200); res.write('{'); return; }
      if (mode === 'unavailable') { res.writeHead(503); res.end(); return; }
      if (mode === 'unknown') return json(res, { error: { cause: { name: 'UNKNOWN_TRANSACTION' } } });
      res.end({ malformed: 'SECRET_RPC_TEXT', null: 'null', oversized: JSON.stringify({ result: 'x'.repeat(4096) }), missing: '{}' }[mode]);
    });
    const rpc = new RpcClient(f.endpoint, { timeoutMs: 1000, maxResponseBytes: 1024 });
    await assert.rejects(rpc.call('tx', {}), error => !error.message.includes('SECRET_RPC_TEXT'));
    assert.equal(f.requests.length, 1);
  }
});

test('RPC view and error diagnostics never expose arbitrary upstream text', async t => {
  for (const body of [
    { result: { result: [...Buffer.from('private upstream text')] } },
    { result: { result: [...Buffer.from('null')] } },
    { result: { result: [-1, 256] } },
    { error: { cause: { name: 'private upstream text' } } },
  ]) {
    const f = await fixture(t, (req, res) => json(res, body));
    await assert.rejects(new RpcClient(f.endpoint).view('fixture.testnet', 'status'), /^(Error: )?RPC_(INVALID_VIEW_RESULT)$|^(Error: )?RPC ERROR$/);
  }
});

test('non-success HTTP bodies are cancelled without waiting for their end', async t => {
  for (const phase of ['catalog', 'completion', 'rpc']) {
    let closed;
    const didClose = new Promise(resolve => { closed = resolve; });
    const f = await fixture(t, (req, res) => {
      if (phase === 'completion' && req.url === '/models') return json(res, catalog);
      res.on('close', closed); res.writeHead(503); res.write('private streaming error');
    }, { timeoutMs: 10000 });
    const operation = phase === 'rpc' ? new RpcClient(f.endpoint).call('tx', {}) : f.ai.complete(request);
    await assert.rejects(operation, /HTTP 503/);
    let timer;
    try {
      await Promise.race([didClose, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('error body was not cancelled')), 2000); })]);
    } finally { clearTimeout(timer); }
  }
});
