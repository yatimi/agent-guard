// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
async function server(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'agentguard-demo-test-'));
  const child = fork(new URL('./fixtures/demo-server.mjs', import.meta.url), [], { cwd, env: { NEAR_AI_API_KEY: 'dummy-must-never-be-used' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let errors = ''; child.stderr.on('data', b => { errors += b; });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; } await rm(cwd, { recursive: true, force: true }); });
  const port = await new Promise((resolve, reject) => {
    child.on('message', m => { if (m.port) resolve(m.port); }); child.once('error', reject);
    child.once('exit', () => reject(new Error(`Demo exited: ${errors}`)));
  });
  return { cwd, base: `http://127.0.0.1:${port}` };
}
test('judge demo recomputes all recorded cases with network/signing disabled and no local state', { timeout: 10000 }, async t => {
  const s = await server(t);
  const response = await fetch(s.base + '/api/demo'); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.mode, 'recorded'); assert.equal(data.newModelCalls, 0); assert.equal(data.newTransactions, 0);
  assert.equal(data.cases.length, 4);
  const legacy = data.cases.filter(c => c.id !== 'mainnet-nested-failure');
  assert.ok(legacy[0].report.transfers.some(t => !t.system && t.outcome === 'confirmed'));
  assert.ok(legacy[0].report.failures.some(f => f.methods.includes('settle')));
  assert.ok(legacy[1].report.transfers.some(t => !t.system && t.outcome === 'failed'));
  assert.ok(legacy[1].report.returnsFalse.length);
  assert.ok(legacy[2].fee); assert.notEqual(legacy[2].fee.transactionHash, legacy[2].report.target.transactionHash);
  for (const c of data.cases) assert.ok(Number.isFinite(Date.parse(c.report.observedAt)));
  assert.deepEqual(await readdir(s.cwd), []);
});
test('judge demo refuses every live API mutation and never serves the live task at either index URL', { timeout: 10000 }, async t => {
  const s = await server(t);
  for (const path of ['/api/runs', '/api/inspections', '/api/runs/11111111-1111-4111-8111-111111111111/resume', '/api/demo']) {
    const response = await fetch(s.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 405); assert.equal((await response.json()).error, 'RECORDED_DEMO_ONLY');
  }
  for (const path of ['/', '/index.html']) {
    const response = await fetch(s.base + path); const html = await response.text();
    assert.equal(response.status, 200); assert.match(html, /RECORDED EVIDENCE/); assert.match(html, /judge-demo.mjs/);
    assert.doesNotMatch(html, /live-purchase.mjs|id="live-purchase"|REAL MODEL/);
    assert.match(response.headers.get('content-security-policy'), /connect|default-src 'self'/);
  }
  for (const path of ['/Index.html', '/INDEX.HTML']) {
    const response = await fetch(s.base + path);
    assert.ok([200, 404].includes(response.status));
    if (response.status === 200) { const html = await response.text(); assert.match(html, /RECORDED EVIDENCE/); assert.doesNotMatch(html, /live-purchase.mjs|id="live-purchase"/); }
  }
  for (const path of ['/.env', '/.local/near-ai-budget.json', '/%2e%2e%2f.env', '/api/session']) assert.notEqual((await fetch(s.base + path)).status, 200);
  assert.deepEqual(await readdir(s.cwd), []);
});
