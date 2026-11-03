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

The local browser model is intentionally not evidence of onchain enforcement. It omits cryptographic authorization, gas, storage accounting, day rollover and real asynchronous receipts. Its policy constants are example values. Recorded real-network results are a separate file and screen section. The teaching lab is not connected to Keychain or signing. The separate live purchase panel calls a loopback-only server; its restricted signer is described below.

## Trusted components

- Owner account and its full-access key. A malicious owner can withdraw principal and change account keys.
- Vault deployment key. A full-access key on the vault can replace its code. This version is not an immutable vault.
- NEAR protocol and execution environment.
- Official SDK and pinned build dependencies.

No agent receives either full-access key. Never put secrets in public code, browser code, logs or submissions.

## Explicit limits

- Testnet prototype, not an audit or production financial product.
- Payments: native testnet NEAR only; no arbitrary contract calls, FT payments, NEAR Intents, mainnet signing or trustless fulfillment. Diagnosis may read mainnet or testnet Transfer/FunctionCall traces, but does not reconcile token balances or attached deposits.
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

The isolated runtime verifies failed-transfer refunds and competing payments; see [scope and fault-injection limits](docs/RUNTIME-QA.md). Keep the existing paid-task trace distinct from recorded and simulated evidence. Review dependencies. Keep receipts distinct from local simulation exports. A recorded verification run does not constitute an independent security audit.

## References

- [Access keys](https://docs.near.org/protocol/accounts-contracts/access-keys)
- [Asynchronous calls and independent failures](https://docs.near.org/smart-contracts/anatomy/crosscontract)
- [Private callbacks](https://docs.near.org/smart-contracts/security/cross-contract-calls/callbacks)
- [Storage cost attacks](https://docs.near.org/smart-contracts/security/storage)

## Local live executor

The model proposes one exact invoice; it cannot select CLI arguments, RPC endpoints, methods, gas, nonce or signing keys. The shared signer decodes the offline transaction and verifies all fields and its Ed25519 signature before any broadcast. Signed bytes are journaled before sending. A process restart or HTTP retry must reconcile the original transaction hash rather than create another payment. An unresolved older payment blocks new purchases.

The server is loopback-only, requires an exact Host and Origin plus a random session token on POST, and exposes no raw CLI output, private keys or model reasoning. Browser rendering uses text nodes for model output. These controls do not protect against a malicious local process or an owner who changes server code.

Our supplier and local journal are trusted. Invoice IDs, selected transaction targets and report hashes are bound locally; the contract does not attest delivery or independently verify data quality. Diagnostic sources are fixed public mainnet/testnet RPCs, while every service payment is testnet. The report is deterministically reconstructed and the normalized FINAL source fetched again before signing and delivery. This trusts RPC, not a light-client proof. A failed AI draft leaves the verified report accessible. After settled payment, incomplete delivery preserves proof and blocks a new fee until reconciled. Unknown service-payment outcomes require operator inspection; there is no automatic rebroadcast, cancellation or refund path.

## Fixed model and executor evaluation

Current incident-v1 evidence: a separate fixed pass of 4 benign and 11 adversarial supplier inputs preserved the exact approved invoice in all 15 responses. Fourteen independent validator controls passed. No transactions were sent; no malicious model proposal was observed, so no live containment rate is claimed. [Current results, exact-source replay and limits](docs/INCIDENT-SECURITY.md). This covers purchase proposals only, not the optional AI support draft. The checked-fact support handoff does not include AI prose or raw error instructions.

The historical block-snapshot purchase and security benchmark share their original prompt builder. The current transaction-diagnosis flow uses a separate `incident-v1` prompt and the same exact-invoice validator/model parameters; the old benchmark does not establish behavior of this new prompt. One historical fixed pass over 4 benign and 11 malicious supplier responses kept the approved invoice in every case. The model did not produce an observed attacker-requested deviation, so this is not evidence of containing a successful live compromise. Separately forced proposals verify the validator boundary; recorded testnet calls verify the key and contract boundary. See [the full evaluation](docs/SECURITY-BENCHMARK.md) and its limitations.

The contract checks recipient and spending policy, not invoice identity or exact quoted price. An injected price increase that remains within all contract caps needs the trusted local invoice validator to stop it. Invoice IDs and dataset hashes are local bindings; they are not contract-enforced delivery proofs.

## Local concurrency review

Four agent reviewers covered Rust/NEAR contracts, workflow/browser regressions, end-to-end security, and reliability. Confirmed local defects were fixed and re-reviewed: stale-lock mutual exclusion, incomplete lock publication, missing daily/liquid preflight checks, and lost recovery references across browser tabs. This was an agent-assisted source review, not a professional independent audit or proof of the absence of vulnerabilities.

Six child-process lock tests cover competing stale owners, reservation conservation across eight processes, publication failure and crashes. All lock publications now use the same exclusive acquisition guard. A crash while holding that guard requires operator inspection with writers stopped; it is deliberately not automatically reclaimed. Existing journal durability tests cover process death, not machine/power failure. See [review evidence and limits](docs/REVIEW-QA.md).

## Isolated runtime and failure evidence

Five local sandbox tests now execute compiled WASM. Failed native transfers restore principal budgets while consuming nonce, and a competing payment reaches `PAYMENT_IN_FLIGHT`. Protocol tests cover method/receiver permission, allowance exhaustion and actual key revocation. A patched previous-day bucket checks accounting through unchanged WASM; a separately identified low-gas callback artifact checks the already-paid-but-unsettled boundary. The latter retains pending/budget and rejects another payment. Neither injection is claimed as an observed failure of the production artifact. [Full scope and receipts](docs/RUNTIME-QA.md).

## Incident-report boundary

The input accepts exactly network, sender and transaction hash; never a caller-controlled RPC URL. Admission validates primitive string identifiers/amounts, complete receipt-body/outcome coverage, rooted creation graph and returned-status chains. Limits include 128 receipts, 32 actions per receipt, a 2 MB RPC response and ten-second diagnostic fetches. Unsupported actions fail closed. Native Transfer outcomes stay separate from system transfers, attached deposits and token/bridge meaning; a later receipt failure does not undo a locally successful transfer.

An inspection is single-use for payment, even if a caller changes the request UUID. Recoverable references carry the original inspection ID. A completed quote is not reused to start another charge. Hashes establish local consistency with the fetched source, not honesty of the RPC or supplier. AI prose remains untrusted, optional and labeled for human review; its requested word limit is not a deterministic guarantee. [Incident tests, review closure and live evidence](docs/INCIDENT-QA.md).
