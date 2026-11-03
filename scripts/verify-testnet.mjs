// Author: Tommy
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { query, rpc } from './testnet-rpc.mjs';

const execute = promisify(execFile);
const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('testnet.json', root), 'utf8'));
if (config.network !== 'testnet') throw new Error('Only testnet is supported.');
if (!process.argv.includes('--send')) {
  console.log('Read scripts/verify-testnet.mjs before running with --send.');
  console.log('Signs one 0.01 NEAR supplier payment, denied attack requests, owner pause and resume. Uses macOS Keychain; never exports keys.');
  process.exit(0);
}
const report = { network: 'testnet', mode: 'recorded-testnet-run', recordedAt: new Date().toISOString(),
  config, tests: [], statusBefore: null, statusAfter: null, wasmSha256: null };
const stripAnsi = (value) => value.replace(/\x1b\[[0-9;]*m/g, '');
let signedIndex = 0;
function base64Strings(value) {
  if (typeof value === 'string') return /^[A-Za-z0-9+/]{100,}={0,2}$/.test(value) ? [value] : [];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(base64Strings);
}
async function cli(args) {
  try {
    const signing = args.indexOf('sign-with-keychain');
    if (signing !== -1) {
      const publicKey = args[args.indexOf('--signer-public-key') + 1];
      const access = await query({ request_type: 'view_access_key', account_id: config.owner, public_key: publicKey, finality: 'optimistic' });
      if (!Number.isSafeInteger(access.nonce) || !Number.isSafeInteger(access.block_height)) throw new Error('Unsafe RPC nonce or block height');
      // CLI 0.30.1 online mode selects a full-access key even when a public key is supplied.
      // Offline signing selects the exact Keychain entry; fresh public RPC values supply its context.
      const signedFile = new URL(`.local/signed-${signedIndex++}.json`, root);
      args = ['--offline', ...args.slice(0, -1), '--nonce', String(access.nonce + 1),
        '--block-hash', access.block_hash, '--block-height', String(access.block_height), 'save-to-file', fileURLToPath(signedFile)];
      await execute('near', args, { timeout: 30_000, maxBuffer: 2_000_000, env: { ...process.env, NO_COLOR: '1' } });
      const signed = JSON.parse(await readFile(signedFile, 'utf8'));
      const candidates = base64Strings(signed);
      if (candidates.length !== 1) throw new Error(`Unexpected signed-file format: ${Object.keys(signed).join(',')}`);
      // Offline CLI selects the exact Keychain entry; broadcasting uses no private key.
      const response = await rpc('broadcast_tx_commit', [candidates[0]]);
      const result = response.result;
      if (result && result.transaction.public_key !== publicKey) throw new Error('RPC signed-key mismatch');
      const hash = result?.transaction?.hash;
      const succeeded = result?.status && ('SuccessValue' in result.status || 'SuccessReceiptId' in result.status);
      return { code: succeeded ? 0 : 1, stdout: '', output: `${hash ? `Transaction ID: ${hash}\n` : ''}${JSON.stringify(response, null, 2)}` };
    }
    const output = await execute('near', args, { timeout: 90_000, maxBuffer: 2_000_000, env: { ...process.env, NO_COLOR: '1' } });
    return { code: 0, stdout: stripAnsi(output.stdout), output: stripAnsi(output.stdout + output.stderr) };
  } catch (error) {
    return { code: error.code ?? 1, stdout: stripAnsi(error.stdout ?? ''), output: stripAnsi((error.stdout ?? '') + (error.stderr ?? '') + (error.killed ? '\nCLI_TIMEOUT' : '') + `\n${error.message}`) };
  }
}
async function status() {
  const result = await query({ request_type: 'call_function', account_id: config.vault, method_name: 'status', args_base64: 'e30=' });
  return JSON.parse(Buffer.from(result.result).toString('utf8'));
}
async function waitForStatus(predicate) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = await status();
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Finalized state did not reach the expected condition within 30 reads.');
}
function call(method, args, agent = true, receiver = config.vault) {
  return ['contract', 'call-function', 'as-transaction', receiver, method, 'json-args', JSON.stringify(args),
    'prepaid-gas', '40 Tgas', 'attached-deposit', '0 NEAR', 'sign-as', config.owner,
    'network-config', 'testnet', 'sign-with-keychain', '--signer-public-key',
    agent ? config.agentPublicKey : config.ownerPublicKey, 'send'];
}
async function check(name, args, expectedFailure) {
  const result = await cli(args);
  const hash = result.output.match(/Transaction ID:\s*([1-9A-HJ-NP-Za-km-z]{40,50})/)?.[1] ?? null;
  const passed = expectedFailure
    ? result.code !== 0 && expectedFailure.test(result.output)
    : result.code === 0 && /payment_settled/.test(result.output);
  report.tests.push({ name, passed, expected: expectedFailure?.source ?? 'payment_settled',
    transactionHash: hash, output: result.output });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${hash ? ` · ${hash}` : ''}`);
  if (!passed) throw new Error(`Unexpected result for ${name}: ${result.output}`);
}
await mkdir(new URL('.local/', root), { recursive: true });
report.wasmSha256 = createHash('sha256').update(await readFile(new URL('target/wasm32-unknown-unknown/release/agent_guard.wasm', root))).digest('hex');
let pauseAttempted = false;
try {
  report.statusBefore = await waitForStatus((state) => state.pending === null);
  const before = report.statusBefore;
  if (before.paused || before.pending || before.policy.agent_key !== config.agentPublicKey || before.owner !== config.owner || !before.policy.recipients.includes(config.supplier)) {
    throw new Error('Vault policy or state does not match the configured test run.');
  }
  const nonce = BigInt(before.next_nonce);
  const amount = '10000000000000000000000'; // 0.01 NEAR.
  await check('Allowed supplier payment', call('pay', { nonce: nonce.toString(), recipient: config.supplier, amount }));
  const after = await waitForStatus((state) => state.next_nonce === (nonce + 1n).toString() && state.pending === null);
  if (after.next_nonce !== (nonce + 1n).toString() || after.pending !== null || BigInt(after.total_spent) !== BigInt(before.total_spent) + BigInt(amount)) {
    throw new Error('Settlement state does not match the accepted payment.');
  }
  const next = (nonce + 1n).toString();
  await check('Prompt-injected recipient', call('pay', { nonce: next, recipient: 'attacker.testnet', amount }), /RECIPIENT_NOT_ALLOWED/);
  await check('Oversized payment', call('pay', { nonce: next, recipient: config.supplier, amount: '200000000000000000000000' }), /PAYMENT_LIMIT/);
  await check('Replay accepted nonce', call('pay', { nonce: nonce.toString(), recipient: config.supplier, amount }), /INVALID_NONCE/);
  await check('Agent cannot administer vault', call('set_paused', { paused: true }), /MethodNameMismatch|method name.*not allowed|does not have permission/i);
  await check('Agent cannot call another contract', call('pay', { nonce: next, recipient: config.supplier, amount }, true, config.supplier), /ReceiverMismatch|receiver.*does not match|does not have permission/i);
  await check('Owner cannot forge private callback', call('settle', { nonce: next }, false), /private/);
  pauseAttempted = true;
  const pause = await cli(call('set_paused', { paused: true }, false));
  if (pause.code !== 0) throw new Error(`Owner pause failed: ${pause.output}`);
  await waitForStatus((state) => state.paused);
  await check('Owner emergency pause blocks agent', call('pay', { nonce: next, recipient: config.supplier, amount }), /PAUSED/);
} finally {
  if (pauseAttempted) {
    const resume = await cli(call('set_paused', { paused: false }, false));
    if (resume.code !== 0) console.error(`IMPORTANT: owner resume failed. Inspect vault state. ${resume.output}`);
    else await waitForStatus((state) => !state.paused);
  }
  report.statusAfter = await status().catch(() => null);
  report.finishedAt = new Date().toISOString();
  await writeFile(new URL('.local/testnet-report.json', root), JSON.stringify(report, null, 2) + '\n');
  // Only publish a complete, passing run; never overwrite it with a partial failure.
  if (report.tests.length === 8 && report.tests.every((test) => test.passed) && report.statusAfter?.paused === false) {
    await writeFile(new URL('web/testnet-evidence.json', root), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`Full report: ${fileURLToPath(new URL('.local/testnet-report.json', root))}`);
}
