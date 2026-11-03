// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { request } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'agentguard-process-'));
  t.after(() => rm(path, { recursive: true, force: true })); return path;
}
async function server(t, path, mode = 'complete') {
  const child = fork(new URL('./fixtures/recovery-server.mjs', import.meta.url), [path, mode], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: {} });
  const stages = new Set(); let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  child.on('message', message => { if (message.stage) stages.add(message.stage); });
  const stop = async () => { if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited; } };
  t.after(stop);
  const port = await new Promise((resolve, reject) => {
    child.on('message', message => { if (message.port) resolve(message.port); });
    child.once('exit', () => reject(new Error(`Fixture exited: ${stderr}`)));
    child.once('error', reject);
  });
  let token;
  const call = (route, body, headers = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: route, method: body === undefined ? 'GET' : 'POST', headers: {
      Host: '127.0.0.1:4173', Origin: 'http://127.0.0.1:4173', 'Content-Type': 'application/json', 'X-AgentGuard-Token': token || '', ...headers,
    } }, res => {
      let text = ''; res.on('data', chunk => { text += chunk; });
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(text) }); } catch (error) { reject(error); } });
    });
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  token = (await call('/api/session')).body.token;
  return { call, stop, stages, token };
}
async function until(fn) {
  for (let i = 0; i < 150; i++) { const result = await fn(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw new Error('Fixture did not reach the expected state');
}
async function counts(path) {
  const text = await readFile(join(path, 'calls.ndjson'), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  const result = { sign: 0, broadcast: 0, proposal: 0, summary: 0, receipt: 0 };
  for (const line of text.trim().split('\n').filter(Boolean)) result[JSON.parse(line).kind]++;
  return result;
}
test('SIGKILL during broadcast: restart reconciles saved hash without another signature or broadcast', { timeout: 10000 }, async t => {
  const path = await directory(t), first = await server(t, path, 'hang-broadcast'), id = randomUUID();
  assert.equal((await first.call('/api/runs', { requestId: id, scenario: 'purchase' })).status, 202);
  await until(() => first.stages.has('broadcast'));
  const saved = JSON.parse(await readFile(join(path, 'purchases', `${id}.json`), 'utf8'));
  assert.equal(saved.state, 'pending'); assert.ok(saved.payment.encoded);
  await first.stop();
  const restarted = await server(t, path);
  const reopened = (await restarted.call(`/api/runs/${id}`)).body;
  assert.equal(reopened.recoveryRequired, true); assert.equal(reopened.dataset, null); assert.equal(reopened.payment, undefined);
  assert.equal((await restarted.call(`/api/runs/${id}/resume`, {}, { 'X-AgentGuard-Token': first.token })).status, 403);
  const result = await restarted.call(`/api/runs/${id}/resume`, {});
  assert.equal(result.body.state, 'completed'); assert.equal(result.body.transactionHash, saved.payment.hash); assert.ok(result.body.dataset);
  await restarted.call('/api/runs', { requestId: id, scenario: 'purchase' });
  await restarted.call(`/api/runs/${id}/resume`, {});
  assert.deepEqual(await counts(path), { sign: 1, broadcast: 1, proposal: 1, summary: 1, receipt: 1 });
});
test('SIGKILL before signing: recovery stops safely and never resumes a paid model request', { timeout: 10000 }, async t => {
  const path = await directory(t), first = await server(t, path, 'hang-planning'), id = randomUUID();
  await first.call('/api/runs', { requestId: id, scenario: 'purchase' }); await until(() => first.stages.has('planning')); await first.stop();
  const restarted = await server(t, path), result = await restarted.call(`/api/runs/${id}/resume`, {});
  assert.equal(result.body.state, 'blocked'); assert.equal(result.body.error, 'INTERRUPTED_BEFORE_PAYMENT');
  assert.deepEqual(await counts(path), { sign: 0, broadcast: 0, proposal: 1, summary: 0, receipt: 0 });
});
test('SIGKILL after verified payment: recovery returns the dataset without repeating model work', { timeout: 10000 }, async t => {
  const path = await directory(t), first = await server(t, path, 'hang-summary'), id = randomUUID();
  await first.call('/api/runs', { requestId: id, scenario: 'purchase' }); await until(() => first.stages.has('summary')); await first.stop();
  const restarted = await server(t, path), result = await restarted.call(`/api/runs/${id}/resume`, {});
  assert.equal(result.body.state, 'completed'); assert.ok(result.body.dataset); assert.match(result.body.summary, /No further payment/);
  assert.deepEqual(await counts(path), { sign: 1, broadcast: 1, proposal: 1, summary: 1, receipt: 1 });
});
test('concurrent HTTP requests and a competing process preserve the one pending payment', { timeout: 10000 }, async t => {
  const path = await directory(t), first = await server(t, path, 'hang-broadcast'), id = randomUUID();
  const results = await Promise.all(Array.from({ length: 16 }, () => first.call('/api/runs', { requestId: id, scenario: 'purchase' })));
  assert.ok(results.some(result => result.status === 202)); assert.ok(results.every(result => [202, 409].includes(result.status)));
  await until(() => first.stages.has('broadcast'));
  assert.deepEqual((await first.call('/api/session')).body.recoverable, [{ id, scenario: 'purchase' }]);
  const conflict = await first.call('/api/runs', { requestId: randomUUID(), scenario: 'purchase' });
  assert.equal(conflict.status, 409); assert.deepEqual(conflict.body.recovery, { id, scenario: 'purchase' });
  const journalPath = join(path, 'purchases', `${id}.json`), before = await readFile(journalPath, 'utf8');
  const competitor = await server(t, path);
  assert.equal((await competitor.call(`/api/runs/${id}/resume`, {})).status, 409);
  assert.equal((await competitor.call('/api/runs', { requestId: randomUUID(), scenario: 'purchase' })).status, 409);
  assert.equal(await readFile(journalPath, 'utf8'), before);
  assert.equal((await first.call('/api/runs', { requestId: id, scenario: 'injection' })).status, 409);
  assert.equal((await first.call('/api/runs', { requestId: randomUUID(), scenario: 'purchase' }, { Origin: 'https://foreign.example' })).status, 403);
  await first.stop();
  const outcome = await competitor.call(`/api/runs/${id}/resume`, {}); assert.equal(outcome.body.state, 'completed');
  assert.deepEqual(await counts(path), { sign: 1, broadcast: 1, proposal: 1, summary: 1, receipt: 1 });
});

test('incident HTTP contract: authentication, immutable IDs and SIGKILL after paid report', { timeout: 10000 }, async t => {
  const path = await directory(t), first = await server(t, path, 'incident-hang-summary');
  const target = { network: 'testnet', transactionHash: '2CeRPmk84jQjZdb8anP64XkrEtxSkEfwsNwVZRNnjPtk', sender: 'owner.test.near' };
  assert.equal((await first.call('/api/inspections', { target }, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await first.call('/api/inspections', { target: { ...target, url: 'http://localhost' } })).status, 409);
  const inspected = await first.call('/api/inspections', { target }); assert.equal(inspected.status, 200); assert.equal(inspected.body.report, null);
  const inspectionId = inspected.body.id, requestId = randomUUID();
  assert.equal((await first.call('/api/runs', { requestId, scenario: 'purchase', inspectionId: [inspectionId] })).status, 409);
  const missing = await first.call('/api/runs', { requestId: randomUUID(), scenario: 'purchase', inspectionId: randomUUID() });
  assert.equal(missing.body.noPurchaseCreated, true);
  assert.equal((await first.call('/api/runs', { requestId, scenario: 'purchase', inspectionId })).status, 202);
  await until(() => first.stages.has('summary')); await first.stop();
  const restarted = await server(t, path, 'incident-complete');
  assert.deepEqual((await restarted.call('/api/session')).body.recoverable, [{ id: requestId, scenario: 'purchase', inspectionId }]);
  const result = await restarted.call(`/api/runs/${requestId}/resume`, {});
  assert.equal(result.body.state, 'completed'); assert.ok(result.body.report); assert.deepEqual(result.body.target, target); assert.match(result.body.summary, /No further payment/);
  const duplicate = await restarted.call('/api/runs', { requestId: randomUUID(), scenario: 'purchase', inspectionId }); assert.equal(duplicate.status, 409); assert.equal(duplicate.body.recovery.id, requestId);
  assert.deepEqual(await counts(path), { sign: 1, broadcast: 1, proposal: 1, summary: 1, receipt: 1 });
});
