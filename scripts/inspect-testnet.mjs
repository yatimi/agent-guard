// Author: Tommy
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { query } from './testnet-rpc.mjs';
import { formatNear } from '../web/vault.mjs';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('testnet.json', root), 'utf8'));
if (config.network !== 'testnet') throw new Error('Only testnet is supported.');
const [code, owner, vault, supplier] = await Promise.all([
  query({ request_type: 'view_code', account_id: config.vault }),
  query({ request_type: 'view_account', account_id: config.owner }),
  query({ request_type: 'view_account', account_id: config.vault }),
  query({ request_type: 'view_account', account_id: config.supplier }),
]);
const deployedSha256 = createHash('sha256').update(Buffer.from(code.code_base64, 'base64')).digest('hex');
const localSha256 = createHash('sha256').update(await readFile(new URL('target/wasm32-unknown-unknown/release/agent_guard.wasm', root))).digest('hex');
if (deployedSha256 !== localSha256) throw new Error('Deployed bytecode differs from the local build.');
const verification = {
  checkedAt: new Date().toISOString(), codeBlockHash: code.block_hash, codeBlockHeight: code.block_height,
  wasmSha256: deployedSha256, matchesLocalBuild: true,
  balances: { owner: owner.amount, vault: vault.amount, supplier: supplier.amount },
  vaultStorageBytes: vault.storage_usage,
};
console.log('Deployed WASM matches local build:', deployedSha256);
console.log('NEAR balances:', { owner: formatNear(BigInt(owner.amount)), vault: formatNear(BigInt(vault.amount)), supplier: formatNear(BigInt(supplier.amount)) });
if (process.argv.includes('--record')) {
  const path = new URL('web/testnet-evidence.json', root);
  const report = JSON.parse(await readFile(path, 'utf8'));
  if (report.wasmSha256 !== deployedSha256) throw new Error('Recorded tests used a different artifact.');
  report.deploymentVerification = verification;
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  console.log('Recorded public bytecode and balance verification. No transactions signed.');
}
