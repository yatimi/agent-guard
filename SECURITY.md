<!-- Author: Tommy -->
# Security model

## Protecting a vault from a compromised agent

Assume every model response, tool result and requested payment can be malicious. The agent's server-side checks and browser UI are not security boundaries. A compromised agent must still be constrained by the NEAR function-call key and contract.

| Attack | Contract boundary | Verification in this version |
| --- | --- | --- |
| Recipient substitution | Immutable recipient allowlist | Rust unit test |
| Oversized or split payment | Per-payment and UTC-day caps | Rust unit tests |
| Repeat an accepted request | Monotonically increasing nonce | Rust unit test |
| Concurrent payment race | Reserve budget before dispatch; one in-flight transfer | Rust unit test |
| Spend again after failed transfer | Restore budget, consume accepted nonce | Rust unit test |
| Withdraw or disable pause with agent key | Owner identity and agent key exclusion | Rust unit tests |
| Invoke another method/contract using agent key | Protocol function-call restriction | Real testnet protocol rejections |
| Forge a settlement callback | SDK `#[private]` wrapper | Real testnet receipt failure |
| Exhaust storage through payment history | Single bounded pending record; no persistent history | Code inspection |

The local browser model is intentionally not evidence of onchain enforcement. It omits cryptographic authorization, gas, storage accounting, day rollover and real asynchronous receipts. Its policy constants are example values. Recorded real-network results are a separate file and screen section. The interactive lab is not connected to Keychain or signing.

## Trusted components

- Owner account and its full-access key. A malicious owner can withdraw principal and change account keys.
- Vault deployment key. A full-access key on the vault can replace its code. This version is not an immutable vault.
- NEAR protocol and execution environment.
- Official SDK and pinned build dependencies.

No agent receives either full-access key. Never put secrets in public code, browser code, logs or submissions.

## Explicit limits

- Testnet prototype, not an audit or production financial product.
- Native NEAR transfers only. No arbitrary contract calls, FT tokens, NEAR Intents, automatic purchase fulfillment or mainnet transactions.
- A permitted supplier can still provide bad data. Allowlisting is not proof of service quality or fraud detection.
- The agent can intentionally use its allowed budget and gas. Configure a gas allowance as well as principal caps.
- UTC-day caps allow up to two daily budgets close to midnight. Lifetime budget remains in force.
- Only one pending agent payment. A callback failure leaves the vault blocked. Do not add an owner-controlled budget refund without independently verifying transfer outcome; that could allow a double spend.
- Owner withdrawals are not included in agent spending limits. They retain storage cost plus 0.05 NEAR operating reserve.
- `status` daily spending reports the current day; pending transfers may belong to the previous day.
- Denied calls panic and emit no successful receipt event. A production trace must retain failed transaction outcomes, not infer blocks from successful-event logs alone.
- Mocked-runtime tests call Rust methods directly. They do not execute generated WASM wrappers, access-key permissions or real cross-receipt refunds.

## Verified on testnet

The deployed vault has one successful recorded verification run in `web/testnet-evidence.json`. A permitted request signed by the restricted key settled. Invalid recipient, excessive amount and replay were rejected in receipts. Calls to an unapproved method and receiver were rejected by the protocol. The owner's attempt to forge a private callback failed. Pause stopped the agent; the verifier restored the vault to unpaused state. Earlier development payment and signing attempts are not concealed; total recorded final spending includes the earlier successful 0.01 NEAR payment as well as the verification payment.

Keychain signing uses the offline CLI path deliberately. Version 0.30.1's online path selects a full-access key regardless of the requested public key. The verifier uses fresh RPC nonce/block context, signs the exact Keychain entry offline, broadcasts the signed bytes, and checks the public key returned in the accepted transaction.

## Before a public demo

Verify failed-transfer refunds and concurrent-payment behavior through the runtime. Add real agent task execution and trace ingestion. Review dependencies. Keep receipts distinct from local simulation exports. A recorded verification run does not constitute an independent security audit.

## References

- [Access keys](https://docs.near.org/protocol/accounts-contracts/access-keys)
- [Asynchronous calls and independent failures](https://docs.near.org/smart-contracts/anatomy/crosscontract)
- [Private callbacks](https://docs.near.org/smart-contracts/security/cross-contract-calls/callbacks)
- [Storage cost attacks](https://docs.near.org/smart-contracts/security/storage)
