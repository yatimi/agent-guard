// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { inspectSignedCall, base58 } from '../server/signed-call.mjs';
import { validateProposal } from '../server/payment-proposal.mjs';
import { receiptFixture } from './receipt-fixture.mjs';
import { verifyPaymentReceipt } from '../server/payment-receipt.mjs';

const quote = { id: 'invoice-1', recipient: 'supplier.testnet', amountYocto: '10', expiresAt: '2030-01-01T00:00:00Z' };
const proposal = args => [{ type: 'function', function: { name: 'propose_payment', arguments: JSON.stringify(args) } }];
const args = { recipient: quote.recipient, amount_yocto: quote.amountYocto, invoice_id: quote.id };
test('only one exact, unexpired owner-approved invoice can reach signing', () => {
  assert.deepEqual(validateProposal(proposal(args), quote), args);
  for (const change of [{ recipient: 'attacker.testnet' }, { amount_yocto: '11' }, { invoice_id: 'other' }, { extra: true }]) assert.throws(() => validateProposal(proposal({ ...args, ...change }), quote));
  assert.throws(() => validateProposal([...proposal(args), ...proposal(args)], quote));
  assert.throws(() => validateProposal(proposal(args), { ...quote, expiresAt: 'invalid' }));
  assert.throws(() => validateProposal(proposal(args), quote, Date.parse(quote.expiresAt)));
});
function signedFixture() {
  const keys = generateKeyPairSync('ed25519');
  const publicBytes = keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const u32 = n => { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(n); return bytes; };
  const u64 = n => { const bytes = Buffer.alloc(8); bytes.writeBigUInt64LE(BigInt(n)); return bytes; };
  const string = value => Buffer.concat([u32(Buffer.byteLength(value)), Buffer.from(value)]);
  const fields = { signer: 'owner.testnet', publicKey: `ed25519:${base58(publicBytes)}`, accessNonce: '7', receiver: 'vault.testnet', blockHash: base58(Buffer.alloc(32, 5)), method: 'pay', argsText: '{"nonce":"2","recipient":"supplier.testnet","amount":"10"}', gas: '40000000000000', deposit: '0' };
  const unsigned = Buffer.concat([string(fields.signer), Buffer.of(0), publicBytes, u64(7), string(fields.receiver), Buffer.alloc(32, 5), u32(1), Buffer.of(2), string(fields.method), string(fields.argsText), u64(fields.gas), Buffer.alloc(16)]);
  const digest = createHash('sha256').update(unsigned).digest();
  const signed = Buffer.concat([unsigned, Buffer.of(0), sign(null, digest, keys.privateKey)]);
  return { signed, fields, digest };
}
test('signed bytes are checked before broadcast, including exact authority and action', () => {
  const fixture = signedFixture();
  assert.equal(inspectSignedCall(fixture.signed.toString('base64'), fixture.fields).hash, base58(fixture.digest));
  for (const field of Object.keys(fixture.fields)) assert.throws(() => inspectSignedCall(fixture.signed.toString('base64'), { ...fixture.fields, [field]: 'changed' }));
  const damaged = Buffer.from(fixture.signed); damaged[damaged.length - 1] ^= 1;
  assert.throws(() => inspectSignedCall(damaged.toString('base64'), fixture.fields), /SIGNATURE/);
  assert.throws(() => inspectSignedCall(Buffer.concat([fixture.signed, Buffer.of(0)]).toString('base64'), fixture.fields), /TRAILING/);
  assert.throws(() => inspectSignedCall(fixture.signed.subarray(0, 30).toString('base64'), fixture.fields));
});
test('top-level success alone is not payment proof', () => {
  const config = { owner: 'owner.testnet', agentPublicKey: 'agent', vault: 'vault.testnet' };
  const payment = { hash: 'hash', argsText: JSON.stringify({ nonce: '2', recipient: 'supplier.testnet', amount: '10' }) };
  const good = receiptFixture(payment, config);
  assert.equal(verifyPaymentReceipt(good, payment, config).nonce, '2');
  assert.throws(() => verifyPaymentReceipt({ ...good, receipts_outcome: [] }, payment, config));
  const failed = structuredClone(good); failed.receipts_outcome[0].outcome.status = { Failure: 'failed transfer' };
  assert.throws(() => verifyPaymentReceipt(failed, payment, config));
  assert.throws(() => verifyPaymentReceipt({ ...good, status: { SuccessValue: 'ZmFsc2U=' } }, payment, config));
});
