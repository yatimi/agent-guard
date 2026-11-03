// Author: Tommy
export const UNIT = 10n ** 24n;

export function parseNear(value) {
  if (!/^(0|[1-9]\d*)(\.\d{1,24})?$/.test(value)) throw new Error('Enter a positive NEAR amount with up to 24 decimals.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * UNIT + BigInt(fraction.padEnd(24, '0'));
}

export function formatNear(value) {
  const fraction = (value % UNIT).toString().padStart(24, '0').replace(/0+$/, '');
  return `${value / UNIT}${fraction ? `.${fraction}` : ''}`;
}

/** Browser teaching model. The Rust contract remains the security authority. */
export class DemoVault {
  constructor() {
    this.balance = 10n * UNIT;
    this.dailySpent = 0n;
    this.totalSpent = 0n;
    this.nextNonce = 0n;
    this.paused = false;
    this.pending = null;
    this.recipients = new Set(['data-provider.testnet']);
    this.perPayment = UNIT;
    this.perDay = 2n * UNIT;
    this.lifetime = 5n * UNIT;
    this.reserve = UNIT / 20n;
  }

  request({ recipient, amount, nonce, role = 'agent' }) {
    const deny = (reason) => ({ allowed: false, reason });
    if (role !== 'agent') return deny('UNAUTHORIZED_AGENT');
    if (this.paused) return deny('PAUSED');
    if (this.pending) return deny('PAYMENT_IN_FLIGHT');
    if (nonce !== this.nextNonce) return deny('INVALID_NONCE');
    if (!this.recipients.has(recipient)) return deny('RECIPIENT_NOT_ALLOWED');
    if (amount <= 0n || amount > this.perPayment) return deny('PAYMENT_LIMIT');
    if (this.dailySpent + amount > this.perDay) return deny('DAILY_LIMIT');
    if (this.totalSpent + amount > this.lifetime) return deny('LIFETIME_LIMIT');
    if (amount > this.balance - this.reserve) return deny('INSUFFICIENT_VAULT_BALANCE');
    this.dailySpent += amount;
    this.totalSpent += amount;
    this.nextNonce += 1n;
    this.pending = { recipient, amount, nonce };
    return { allowed: true, reason: 'PAYMENT_RESERVED' };
  }

  settle(success) {
    if (!this.pending) throw new Error('NO_PENDING_PAYMENT');
    const { amount } = this.pending;
    if (success) this.balance -= amount;
    else { this.dailySpent -= amount; this.totalSpent -= amount; }
    this.pending = null;
  }

  snapshot() {
    return {
      balance: formatNear(this.balance), dailySpent: formatNear(this.dailySpent),
      totalSpent: formatNear(this.totalSpent), nextNonce: this.nextNonce.toString(),
      paused: this.paused, pending: this.pending !== null,
    };
  }
}
