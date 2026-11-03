// Author: Tommy
import { createHash, createPublicKey, verify } from 'node:crypto';

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58(bytes) {
  let number = BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`), result = '';
  while (number) { result = alphabet[Number(number % 58n)] + result; number /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; result = '1' + result; }
  return result;
}

// Accept exactly the V0 Ed25519 function-call shape used by this application.
// NEAR hashes the unsigned Borsh transaction and signs that SHA-256 digest.
export function inspectSignedCall(encoded, expected) {
  if (typeof encoded !== 'string' || encoded.length > 16000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('INVALID_SIGNED_TRANSACTION');
  const bytes = Buffer.from(encoded, 'base64');
  let offset = 0;
  const take = size => {
    if (!Number.isSafeInteger(size) || size < 0 || offset + size > bytes.length) throw new Error('TRUNCATED_TRANSACTION');
    const part = bytes.subarray(offset, offset + size); offset += size; return part;
  };
  const u32 = () => take(4).readUInt32LE();
  const vector = () => take(u32());
  const string = () => new TextDecoder('utf-8', { fatal: true }).decode(vector());
  const signer = string();
  if (take(1)[0] !== 0) throw new Error('ONLY_ED25519_SUPPORTED');
  const keyBytes = take(32), publicKey = `ed25519:${base58(keyBytes)}`;
  const accessNonce = take(8).readBigUInt64LE().toString();
  const receiver = string(), blockHash = base58(take(32));
  if (u32() !== 1 || take(1)[0] !== 2) throw new Error('ONE_FUNCTION_CALL_REQUIRED');
  const method = string(), argsText = string();
  const gas = take(8).readBigUInt64LE().toString();
  const depositBytes = take(16);
  const deposit = (depositBytes.readBigUInt64LE() + (depositBytes.readBigUInt64LE(8) << 64n)).toString();
  const unsigned = bytes.subarray(0, offset);
  if (take(1)[0] !== 0) throw new Error('ONLY_ED25519_SUPPORTED');
  const signature = take(64);
  if (offset !== bytes.length) throw new Error('TRAILING_TRANSACTION_BYTES');
  const decoded = { signer, publicKey, accessNonce, receiver, blockHash, method, argsText, gas, deposit };
  for (const [field, value] of Object.entries(expected)) {
    if (decoded[field] !== value) throw new Error(`SIGNED_FIELD_MISMATCH:${field}`);
  }
  const digest = createHash('sha256').update(unsigned).digest();
  const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), keyBytes]), format: 'der', type: 'spki' });
  if (!verify(null, digest, key, signature)) throw new Error('INVALID_TRANSACTION_SIGNATURE');
  return { ...decoded, hash: base58(digest) };
}
