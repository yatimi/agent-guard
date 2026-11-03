// Author: Tommy
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectSignedCall } from './signed-call.mjs';

const execute = promisify(execFile);
export class TestnetWallet {
  constructor(config, rpc, directory) { this.config = config; this.rpc = rpc; this.directory = directory; }

  async sign(method, args, { publicKey = this.config.agentPublicKey, receiver = this.config.vault } = {}) {
    if (this.config.network !== 'testnet') throw new Error('TESTNET_ONLY');
    const access = await this.rpc.query({ request_type: 'view_access_key', account_id: this.config.owner, public_key: publicKey, finality: 'optimistic' });
    if (!Number.isSafeInteger(access.nonce) || !Number.isSafeInteger(access.block_height)) throw new Error('UNSAFE_RPC_NONCE');
    const argsText = JSON.stringify(args, Object.keys(args).sort()), accessNonce = (BigInt(access.nonce) + 1n).toString();
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const path = join(this.directory, `signed-${randomUUID()}.json`);
    // Online CLI 0.30.1 can choose FullAccess despite --signer-public-key.
    // Offline mode plus independent Borsh/signature validation prevents that fallback.
    try {
      await execute('near', ['--offline', 'contract', 'call-function', 'as-transaction', receiver, method,
        'json-args', argsText, 'prepaid-gas', '40 Tgas', 'attached-deposit', '0 NEAR', 'sign-as', this.config.owner,
        'network-config', 'testnet', 'sign-with-keychain', '--signer-public-key', publicKey,
        '--nonce', accessNonce, '--block-hash', access.block_hash, '--block-height', String(access.block_height), 'save-to-file', path],
      { timeout: 30000, maxBuffer: 2000000, env: { ...process.env, NO_COLOR: '1' } });
    } catch { throw new Error('KEYCHAIN_SIGNING_FAILED'); }
    await chmod(path, 0o600);
    const file = JSON.parse(await readFile(path, 'utf8'));
    const encoded = file.signed_transaction_as_base64;
    const transaction = inspectSignedCall(encoded, { signer: this.config.owner, publicKey, accessNonce, receiver,
      blockHash: access.block_hash, method, argsText, gas: '40000000000000', deposit: '0' });
    return { encoded, ...transaction };
  }
}
