<!-- Author: Tommy -->
# NEAR runtime verification

On 2026-11-03, all **five integration tests passed** through a local NEAR 2.14.0 sandbox using official near-workspaces 0.24.0. This is actual compiled WASM and asynchronous receipt execution on disposable local accounts. No funded testnet/mainnet account, AI provider or Keychain entry was used.

[Full receipts, states, artifact identities and source hashes](runtime-verification.json). [Setup and commands](../runtime-tests/README.md).

| Scenario | Observed result | Evidence boundary |
| --- | --- | --- |
| Transfer to a nonexistent allowlisted account | Failed transfer receipt; callback returns false; daily/lifetime budgets restored; nonce consumed; principal returns; next valid payment settles | Unchanged production WASM; explicit FINAL before baseline and refund measurement |
| Two submitted payments before awaiting settlement | First settles; second reaches `PAYMENT_IN_FLIGHT`; supplier receives exactly one amount; one nonce consumed | Unchanged production WASM; actual competing transactions, not HTTP fixtures |
| Restricted key boundaries | Wrong method, wrong receiver and exhausted allowance fail at the protocol; revoked key produces `AccessKeyNotFound`; contract state unchanged | Disposable local owner/agent key, with same permission shape as production |
| Previous UTC-day bucket | Current-day spend reads zero; next payment starts the new daily count while preserving lifetime spend | Unchanged WASM, but persisted day is explicitly patched to yesterday; no claim of wall-clock rollover |
| Callback runs out of gas after a successful transfer | Supplier receives principal; callback fails; pending and consumed budget remain; next payment and forged external callback are rejected | Separately hashed test-only artifact: static callback gas 0.1 Tgas, unused-gas weight 0 |

Production WASM SHA-256: `976f990b5f8a1a6e39de6e742cea4cadb515c5e6de17169a4f4325fd184d345e`.

Fault-injected WASM SHA-256: `2adf225da57f95876b722af9662ff0c6b8f20947654aa359c1b87f3e0c98b602`.

The fault case demonstrates why an unresolved callback must not simply restore spending budget: the supplier may already have been paid. The current production policy deliberately blocks instead of offering an unverified manual refund. This does not establish that the normal 10-Tgas callback allocation fails.

## Reproducibility and review

The dedicated Cargo workspace keeps its 380 dependencies (381 locked packages including the harness) separate from the contract's lockfile. Rust host toolchain is 1.99.1; both production and temporary fault WASM use 1.86.0. The runner retains each started test run, command output and case evidence outside the checkout, verifies the expected case set and hashes, and refuses a filter matching no tests. It does not repeat failed tests automatically.

Source review found and closed three test-harness gaps: accepting any error as key revocation, allowing zero selected tests to report success, and failing to forward interruption to detached children. The final focused source review reported no remaining actionable findings. Runtime clippy passed with warnings denied. This is agent-assisted review, not a professional independent audit.

Development experiments exposed harness assumptions rather than a newly found contract bypass: deployment refunds can arrive after the SDK's initial transaction result; height fast-forward did not establish the intended day change; and unused gas can augment a callback's static allocation. These are retained in the report's development notes. The final run passed five tests in approximately 30 seconds after compilation.

## Fresh judge builds

The artifact hashes above identify the historical recorded run. Current `npm run build:contract` writes a separate `target/contract-build.json`; the runtime runner verifies the fresh bytes against that record and the reviewed source manifest. Embedded compiler paths can change WASM bytes between macOS and Linux. New results record their actual artifact hash and whether it matches the deployed artifact; the existing public recording and live deployment pin are not relabeled. [Clean setup and CI](JUDGE.md).

## Key lifecycle

The owner can revoke the restricted key with a DeleteKey action on the owner account. Subsequent signing with that key is rejected by the protocol. Adding a different key does not update this vault's immutable pinned key. Replacement requires a deliberately reviewed new vault/policy or contract migration, with pending payments reconciled first. No rotation or revocation was performed on the user's actual keys.

## Remaining limits

This is a local single-validator runtime, not a new public-testnet deployment or production audit. It does not establish behavior under network partitions, hostile RPC responses, machine/power failure, or real-world service delivery. Previous-day patching and callback-gas injection remain explicitly separate from unchanged-artifact observations. The tests preserve and demonstrate callback blocking; they do not add recovery that could return an already-paid budget.
