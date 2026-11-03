// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoVault, UNIT, parseNear, formatNear } from './vault.mjs';

const request = (vault, fields = {}) => vault.request({ recipient: 'data-provider.testnet', amount: UNIT, nonce: vault.nextNonce, ...fields });

test('exact decimal conversion never uses floating point', () => {
  for (const value of ['0', '0.000000000000000000000001', '1.123456789012345678901234', '1000000']) {
    assert.equal(formatNear(parseNear(value)), value);
  }
  for (const value of ['-1', '1e3', '', 'NaN', '0.0000000000000000000000001', '01', '.5']) {
    assert.throws(() => parseNear(value));
  }
});
test('successful settlement debits vault once', () => {
  const vault = new DemoVault(); assert.equal(request(vault).allowed, true);
  assert.equal(vault.balance, 10n * UNIT); vault.settle(true);
  assert.equal(vault.balance, 9n * UNIT); assert.throws(() => vault.settle(true));
});
test('injected recipient leaves all state unchanged', () => {
  const vault = new DemoVault(); const before = vault.snapshot();
  assert.equal(request(vault, { recipient: 'attacker.testnet' }).reason, 'RECIPIENT_NOT_ALLOWED');
  assert.deepEqual(vault.snapshot(), before);
});
test('a reserved payment blocks concurrent requests', () => {
  const vault = new DemoVault(); request(vault);
  assert.equal(request(vault).reason, 'PAYMENT_IN_FLIGHT');
});
test('failed transfer restores budgets but burns nonce', () => {
  const vault = new DemoVault(); request(vault); vault.settle(false);
  assert.equal(vault.dailySpent, 0n); assert.equal(vault.totalSpent, 0n);
  assert.equal(vault.nextNonce, 1n); assert.equal(vault.balance, 10n * UNIT);
  assert.equal(request(vault, { nonce: 0n }).reason, 'INVALID_NONCE');
});
test('splitting payments cannot bypass daily cap', () => {
  const vault = new DemoVault();
  for (let i = 0; i < 2; i++) { request(vault); vault.settle(true); }
  assert.equal(request(vault, { amount: 1n }).reason, 'DAILY_LIMIT');
});
test('per-payment limit rejects zero and oversized amounts', () => {
  const vault = new DemoVault();
  assert.equal(request(vault, { amount: 0n }).reason, 'PAYMENT_LIMIT');
  assert.equal(request(vault, { amount: UNIT + 1n }).reason, 'PAYMENT_LIMIT');
});
test('paused vault denies agent', () => {
  const vault = new DemoVault(); vault.paused = true;
  assert.equal(request(vault).reason, 'PAUSED');
});
test('wrong identity is rejected', () => {
  assert.equal(request(new DemoVault(), { role: 'stranger' }).reason, 'UNAUTHORIZED_AGENT');
});
test('lifetime budget and liquid reserve are independent limits', () => {
  const vault = new DemoVault(); vault.totalSpent = vault.lifetime;
  assert.equal(request(vault).reason, 'LIFETIME_LIMIT');
  vault.totalSpent = 0n; vault.balance = UNIT;
  assert.equal(request(vault).reason, 'INSUFFICIENT_VAULT_BALANCE');
});
