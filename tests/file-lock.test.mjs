// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withFileLock } from '../server/file-lock.mjs';
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'agentguard-lock-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'ledger.json'), '{"reservations":0}');
  return directory;
}
function worker(t, directory, mode) {
  const child = fork(new URL('./fixtures/lock-worker.mjs', import.meta.url), [directory, mode], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: {} });
  const messages = []; child.on('message', message => messages.push(message));
  const stop = async () => { if (child.exitCode === null && child.signalCode === null) { const ended = once(child, 'exit'); child.kill('SIGKILL'); await ended; } };
  t.after(stop);
  const stage = async (...names) => {
    for (let i = 0; i < 300; i++) {
      const message = messages.find(item => names.includes(item.stage)); if (message) return message;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error(`Missing ${names}; messages: ${JSON.stringify(messages)}`);
  };
  return { child, stop, stage, send: message => child.send(message) };
}
async function staleLock(t, directory) {
  // Use a genuinely exited PID, not a guessed process number.
  const child = fork(new URL('./fixtures/lock-worker.mjs', import.meta.url), [directory, 'before-publish'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: {} });
  await once(child, 'message'); const ended = once(child, 'exit'); child.kill('SIGKILL'); await ended;
  await writeFile(join(directory, 'operation.lock'), JSON.stringify({ pid: child.pid, token: 'old-owner' }));
}
test('two stale-lock contenders cannot both enter or overwrite budget reservations', { timeout: 10000 }, async t => {
  const directory = await fixture(t); await staleLock(t, directory);
  const first = worker(t, directory, 'barrier'); await first.stage('ready'); first.send('start'); await first.stage('read');
  const second = worker(t, directory, 'barrier'); await second.stage('ready'); second.send('start');
  // Old implementation reaches read; fixed implementation refuses the guard.
  const competing = await second.stage('read', 'failed');
  first.send('read'); await first.stage('entered');
  if (competing.stage === 'read') second.send('read');
  const outcome = await second.stage('failed', 'entered');
  assert.equal(outcome.stage, 'failed'); assert.match(outcome.error, /LOCK_RECOVERY/);
  first.send('release');
  await first.stage('done');
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'ledger.json'), 'utf8')), { reservations: 1 });
});
test('eight processes preserve all reservations under stale-lock contention', { timeout: 10000 }, async t => {
  const directory = await fixture(t); await staleLock(t, directory);
  const workers = Array.from({ length: 8 }, () => worker(t, directory, 'stress'));
  await Promise.all(workers.map(item => item.stage('ready'))); workers.forEach(item => item.send('start'));
  const results = await Promise.all(workers.map(item => item.stage('done', 'failed')));
  assert.ok(results.every(result => result.stage === 'done'), JSON.stringify(results));
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'ledger.json'), 'utf8')), { reservations: 8 });
});
test('crashed stale-lock reclaimer stays closed until operator inspection', { timeout: 10000 }, async t => {
  const directory = await fixture(t); await staleLock(t, directory);
  const owner = worker(t, directory, 'barrier'); await owner.stage('ready'); owner.send('start'); await owner.stage('read'); await owner.stop();
  let called = false;
  await assert.rejects(withFileLock(join(directory, 'operation.lock'), () => { called = true; }), /LOCK_RECOVERY_REQUIRES_INSPECTION/);
  assert.equal(called, false);
});
test('death during candidate write never publishes partial lock metadata', { timeout: 10000 }, async t => {
  const directory = await fixture(t), owner = worker(t, directory, 'before-publish');
  await owner.stage('ready'); owner.send('start'); await owner.stage('candidate'); await owner.stop();
  await assert.rejects(readFile(join(directory, 'operation.lock')), { code: 'ENOENT' });
  let calls = 0; await withFileLock(join(directory, 'operation.lock'), () => { calls++; }); assert.equal(calls, 1);
});
test('metadata write failure removes only its own candidate and runs no action', { timeout: 10000 }, async t => {
  const directory = await fixture(t), owner = worker(t, directory, 'write-failure');
  await owner.stage('ready'); owner.send('start'); assert.match((await owner.stage('failed')).error, /INJECTED_WRITE_FAILURE/);
  assert.deepEqual(await readdir(directory), ['ledger.json']);
});

test('normal publication is serialized while a live owner releases and exits', { timeout: 10000 }, async t => {
  const directory = await fixture(t);
  const owner = worker(t, directory, 'hold'); await owner.stage('ready'); owner.send('start'); await owner.stage('entered');
  const normal = worker(t, directory, 'pause-publication'); await normal.stage('ready'); normal.send('start');
  const attempted = await normal.stage('failed', 'publishing');
  if (attempted.stage === 'failed') {
    // Fixed implementation probes the live owner under the universal guard.
    assert.match(attempted.error, /Another operation/);
    owner.send('release'); await owner.stage('done'); return;
  }
  // The previous proposed fix allowed an acquirer past its guard pre-check.
  const reclaimer = worker(t, directory, 'barrier'); await reclaimer.stage('ready'); reclaimer.send('start'); await reclaimer.stage('read');
  const ended = once(owner.child, 'exit'); owner.send('release'); await owner.stage('done'); await ended;
  normal.send('publish'); await normal.stage('entered'); reclaimer.send('read');
  const result = await reclaimer.stage('entered', 'failed');
  assert.equal(result.stage, 'failed');
  assert.match(result.error, /Another operation|LOCK_RECOVERY/, 'must not reach the independent critical-section overlap probe');
});
