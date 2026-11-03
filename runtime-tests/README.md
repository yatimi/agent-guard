<!-- Author: Tommy -->
# Isolated NEAR runtime tests

This is a separate Cargo workspace and lockfile. It does not change the application contract, near-sdk 5.17.2 or the production dependency graph. near-workspaces 0.24.0 launches official near-sandbox 0.4.0 / NEAR 2.14.0. Tokio 1.54.1 and the remaining graph are pinned in this directory's Cargo.lock. Direct near-primitives and near-jsonrpc-primitives entries expose already-required Workspaces types for explicit FINAL waits; the experimental Workspaces feature exposes that API.

From the repository root, with Rust installed and Cargo on PATH:

```sh
# One-time setup: downloads test dependencies and official sandbox executable.
cargo +1.99.1 test --manifest-path runtime-tests/Cargo.toml --locked --no-run --target-dir target/runtime
# Build the unchanged production artifact with the pinned WASM toolchain.
npm run build:contract
# Explicit local-network tests; no AI key or Keychain access.
npm run test:runtime
```

The runner requires `target/contract-build.json`, written by `npm run build:contract`. It verifies the artifact hash, pinned compiler/command and current sources against `production-source.json`. Absolute compiler source paths make fresh artifacts differ across hosts, so a clean Linux build is identified separately from the historical deployed WASM; the live executor still requires the original deployed code hash. A changed contract source requires review of runtime assumptions and the source manifest. The build record establishes trusted local build consistency, not external attestation. It creates fresh sandbox accounts/keys and writes logs, states, case receipts and source hashes to a unique OS temporary directory outside the checkout. Production accounts, .env and Keychain are unused. Compiled caches are ignored under target/runtime. After initial setup, Cargo runs locked/offline; the sandbox must already be downloaded. Supported runtime platforms follow the upstream sandbox (this run used macOS arm64).

A separately compiled temporary variant changes callback static gas to 0.1 Tgas and unused-gas weight to zero to force a callback failure. Its separate hash and injected settings are recorded. It is never deployed publicly. The prior-day test patches the persisted day field in sandbox only; it does not claim to advance wall-clock time.

Optional test-name substring: `npm run test:runtime -- callback_gas`. An unmatched filter fails instead of reporting zero tests as success. PASS requires all expected case evidence and correct artifact hashes. The runner forwards interrupts to its own child process group and has a three-minute per-command timeout. A canceled or failed run retains its log and cannot pass.

Detailed results and limits: [RUNTIME-QA.md](../docs/RUNTIME-QA.md).

Upstream sources: [near-workspaces 0.24.0](https://github.com/near/near-workspaces-rs/releases/tag/near-workspaces-v0.24.0), [near-sandbox](https://github.com/near/near-sandbox-rs).
