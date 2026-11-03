// Author: Tommy
// Explicit local-network tests. Never imports the live signer or model adapter.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, mkdir, copyFile, realpath, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyBuild } from '../runtime-tests/build-provenance.mjs';
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const temporaryRoot = await realpath(tmpdir());
if (temporaryRoot === root || temporaryRoot.startsWith(root + sep)) throw new Error('Runtime state must be outside the checkout.');
const output = await mkdtemp(join(temporaryRoot, 'agentguard-runtime-'));
const cargo = existsSync(join(homedir(), '.cargo/bin/cargo')) ? join(homedir(), '.cargo/bin/cargo') : 'cargo';
const target = process.env.AGENTGUARD_RUNTIME_TARGET || join(root, 'target/runtime');
const sha = data => createHash('sha256').update(data).digest('hex');
const baseline = resolve(root, 'target/wasm32-unknown-unknown/release/agent_guard.wasm');
const baselineHash = sha(await readFile(baseline));
const build = await verifyBuild(root, await readFile(baseline));
const extra = process.argv.slice(2);
if (extra.length > 1 || (extra[0] && !/^[a-z_]+$/.test(extra[0]))) throw new Error('Usage: node scripts/test-runtime.mjs [test_name_filter]');
const cases = {
  callback_gas_failure_keeps_spent_budget_and_blocks_future_payments: 'callback-gas-fault',
  concurrent_payments_cannot_cross_pending_reservation: 'concurrent-payments',
  failed_transfer_refunds_and_next_payment_settles: 'failed-transfer',
  previous_utc_day_resets_daily_budget_and_preserves_lifetime: 'previous-day-bucket',
  restricted_key_allowance_and_revocation_stop_before_contract: 'key-boundaries',
};
const expectedCases = Object.entries(cases).filter(([name]) => !extra[0] || name.includes(extra[0])).map(([, name]) => name).sort();
if (!expectedCases.length) throw new Error('Test filter matches no runtime cases.');
const log = join(output, 'test-output.log');
let activeChild, interruptedSignal = null;
function stopChild() {
  if (!activeChild) return;
  try {
    if (process.platform !== 'win32') process.kill(-activeChild.pid, 'SIGTERM');
    else activeChild.kill('SIGTERM');
  } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  interruptedSignal = signal; process.exitCode = 1; stopChild();
});
const run = (args, env = process.env) => new Promise((resolve, reject) => {
  if (interruptedSignal) return reject(new Error(`Interrupted by ${interruptedSignal}`));
  const child = spawn(cargo, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  activeChild = child;
  let text = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { text += data; process.stdout.write(data); });
  const timeout = setTimeout(stopChild, 180000);
  child.once('error', error => { clearTimeout(timeout); reject(error); });
  child.once('close', async (code, signal) => { clearTimeout(timeout); activeChild = null; await writeFile(log, text, { flag: 'a' }); resolve({ code, signal }); });
});
console.log(`Runtime logs and disposable state: ${output}`);
const fault = join(output, 'callback-fault');
await mkdir(join(fault, 'contract/src'), { recursive: true });
for (const name of ['Cargo.toml', 'Cargo.lock', 'contract/Cargo.toml', 'contract/src/lib.rs', 'contract/src/policy.rs', 'contract/src/pending_payment.rs']) {
  await copyFile(join(root, name), join(fault, name));
}
const source = await readFile(join(fault, 'contract/src/lib.rs'), 'utf8');
const marker = '.with_static_gas(Gas::from_tgas(10))';
if (source.split(marker).length !== 2) throw new Error('Unexpected callback source; review fault injection.');
await writeFile(join(fault, 'contract/src/lib.rs'), source.replace(marker, '.with_static_gas(Gas::from_gas(100_000_000_000)).with_unused_gas_weight(0)'));
const faultTarget = join(target, 'fault-wasm');
const built = await run(['+1.86.0', 'build', '--manifest-path', join(fault, 'Cargo.toml'), '-p', 'agent-guard', '--target', 'wasm32-unknown-unknown', '--release', '--locked', '--offline', '--target-dir', faultTarget]);
if (built.code !== 0) throw new Error(`Fault artifact build failed; ${log}`);
const faultWasm = join(faultTarget, 'wasm32-unknown-unknown/release/agent_guard.wasm');
const faultHash = sha(await readFile(faultWasm));
const sources = {};
for (const path of ['runtime-tests/Cargo.toml', 'runtime-tests/Cargo.lock', 'runtime-tests/tests/runtime.rs', 'runtime-tests/tests/support/mod.rs', 'scripts/test-runtime.mjs', 'runtime-tests/build-provenance.mjs', 'runtime-tests/production-source.json', 'scripts/build-contract.mjs', 'contract/src/lib.rs', 'Cargo.lock']) sources[path] = sha(await readFile(join(root, path)));
await mkdir(join(output, 'sandbox-state'));
await writeFile(join(output, 'run.json'), JSON.stringify({ state: 'started', startedAt: new Date().toISOString(), baselineHash, faultHash, build, filter: extra[0] || null, expectedCases, sources }, null, 2));
const outcome = await run(['+1.99.1', 'test', '--manifest-path', 'runtime-tests/Cargo.toml', '--locked', '--offline', '--target-dir', target, ...extra, '--', '--test-threads=1', '--nocapture'], {
  ...process.env, TMPDIR: join(output, 'sandbox-state'), AGENTGUARD_RUNTIME_WASM: baseline, AGENTGUARD_RUNTIME_SHA256: baselineHash,
  AGENTGUARD_RUNTIME_REPORT_DIR: join(output, 'cases'), AGENTGUARD_CALLBACK_WASM: faultWasm, AGENTGUARD_CALLBACK_SHA256: faultHash,
});
const manifest = JSON.parse(await readFile(join(output, 'run.json'), 'utf8'));
const recordedCases = (await readdir(join(output, 'cases')).catch(() => [])).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)).sort();
let evidenceValid = JSON.stringify(recordedCases) === JSON.stringify(expectedCases);
for (const name of recordedCases) {
  const item = JSON.parse(await readFile(join(output, 'cases', name + '.json'), 'utf8'));
  evidenceValid &&= item.passed === true && item.case === name && item.network === 'local-sandbox' && item.wasmSha256 === (name === 'callback-gas-fault' ? faultHash : baselineHash);
}
const passed = outcome.code === 0 && evidenceValid && !interruptedSignal;
await writeFile(join(output, 'run.json'), JSON.stringify({ ...manifest, state: passed ? 'passed' : 'failed', finishedAt: new Date().toISOString(), ...outcome, recordedCases, evidenceValid, interruptedSignal }, null, 2));
console.log(`Runtime result: ${passed ? 'PASS' : 'FAIL'}. Evidence: ${output}`);
process.exitCode = passed ? 0 : 1;
