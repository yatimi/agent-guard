<!-- Author: Tommy -->
# Reproduce AgentGuard without our keys

The default path needs Node.js 22.9+ and Git on macOS or Linux. It has no npm dependencies. It does not need an AI account, NEAR CLI, Keychain, Rust, a funded wallet or an environment file.

```sh
git clone https://github.com/yatimi/agent-guard.git
cd agent-guard
npm run verify
npm run demo
```

Open **http://127.0.0.1:4174**. Stop with Ctrl-C. `npm run dev` is an alias for this same recorded demo. If port 4174 is already occupied, stop your earlier demo or use that existing instance; the server does not silently pick another port.

## What to inspect

| Action | Expected observation | What it establishes |
| --- | --- | --- |
| Select **Transfer confirmed, callback failed** | A confirmed native transfer and separate failed `settle` receipt | Deterministic interpretation of recorded Sandbox fault receipts; not a production callback failure |
| Select **Transfer failed, callback returned false** | Failed native transfer survives the callback's successful return | Top-level success alone is insufficient to establish transfer success |
| Select **Completed testnet purchase** | Report with `RECIPIENT_NOT_ALLOWED`, distinct diagnostic-fee link, human-review draft | Replays a previously verified real purchase; does not make a new payment |
| Download a report | Source receipts/hash, report facts and recorded provenance | Inspectable consistency of local evidence; not independent RPC/provider attestation |
| Run **Recipient injection** in the lab | `RECIPIENT_NOT_ALLOWED`, unchanged simulated balance | Browser teaching model; actual enforcement is tested separately in Rust/Sandbox |
| Run **Valid purchase**, **Budget breach**, **Replay attack**, pause | Allowed payment or the relevant rejection | Local interactive policy examples, explicitly labeled simulation |

The two Sandbox cases are rebuilt from `docs/runtime-verification.json`; the callback fault used a separately hashed low-gas WASM. The recorded purchase is `docs/live-incident-purchase.json`. Sources and relevant limitations are visible on screen. AI prose is a past, untrusted draft; deterministic facts and source checks are separate.

## Verification layers

| Command | Requirements | Network / spending |
| --- | --- | --- |
| `npm run verify` | Node only | Local HTTP tests, no external network, credentials or payment |
| `npm run demo` | Node only | Loopback server; no external requests, credentials or payment |
| `npm run test:browser` | Node + installed Chrome/Chromium | Temporary browser profile and local HTTP only; no project model/key use |
| `cargo test --workspace --locked` | Pinned Rust 1.99.1 | First setup downloads crates/toolchain; no project credentials |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` | Same | Local compile/lint after setup |
| `npm run build:contract` | Rust 1.86.0 + wasm32 target | First setup downloads compiler/target; no deployment |
| `npm run test:runtime` | Isolated workspace setup below | Disposable local NEAR Sandbox; no public-chain payment or AI |
| `npm run inspect:transaction -- <network> <hash> <sender>` | Node, public RPC access | Explicit read-only public network lookup; no signing/AI |
| `npm run dev:live` | Your own authorized testnet setup and AI key | Explicit live executor on 4173; purchases can spend testnet NEAR and AI credits |

`npm run verify` runs all JS tests and recorded replays. Demo tests forbid outgoing HTTP clients and signing subprocesses, supply a dummy unused key and assert no local state is written. The browser check requires every page request in the recorded demo to be a same-origin GET. These checks are scoped to this implementation, not a general OS network sandbox.

Chrome is discovered at standard macOS/Linux paths; alternatively set `CHROME_BIN` to its executable path. The test runner uses a fresh debug port/profile and closes only its own process. Linux headless CI uses `--no-sandbox` inside the disposable runner; do not use the QA profile for browsing untrusted websites. Screenshots/logs are stored in OS temporary directories outside the repository and are not committed or uploaded by CI.

## Contract and local runtime setup

Rustup must be installed and Cargo must be on PATH. The project pins the host toolchain; the WASM compiler is pinned separately for NEAR runtime compatibility. Do not update the lockfiles as a setup step.

```sh
rustup toolchain install 1.99.1 --profile minimal --component rustfmt,clippy
rustup toolchain install 1.86.0 --profile minimal --target wasm32-unknown-unknown
cargo fmt --all -- --check
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
npm run build:contract
cargo +1.99.1 test --manifest-path runtime-tests/Cargo.toml --locked --no-run --target-dir target/runtime
npm run test:runtime
```

Runtime tooling is separately locked under `runtime-tests/`. Setup may download crates and the official NEAR Sandbox executable. The runner itself uses locked/offline Cargo after setup and creates fresh local accounts/state outside the checkout. The runtime checks `target/contract-build.json`: pinned compiler/command, reviewed source hashes and the exact fresh artifact. Rust embeds absolute source paths, so Linux and macOS byte hashes may differ for the same source. The record explicitly distinguishes the fresh runtime artifact from the historical deployed hash; the live executor deployment pin is unchanged. Modified sources, a missing build record or artifact changes after build fail. Do not update source pins just to silence a failure. This is a trusted local build record, not external attestation. See [runtime scope and injected-case limits](RUNTIME-QA.md) and [workspace instructions](../runtime-tests/README.md).

## GitHub Actions

[Judge verification](https://github.com/yatimi/agent-guard/actions/workflows/verify.yml) runs on main/codex branch pushes, pull requests and manual dispatch:

- Node 22, 24 and 26: offline tests and historical/incident replays.
- Chrome on Ubuntu 24.04: live-flow UI fixtures and recorded judge demo.
- Rust 1.99.1: format, unit tests and clippy; Rust 1.86.0: production WASM; five isolated Sandbox cases.

The workflow has `contents: read`, disables persisted checkout credentials, uses full commit pins for official checkout/setup-node actions and references no project secrets. It never runs `dev:live`, `*:send`, deploys a contract or posts a hackathon submission. Setup downloads and local Sandbox execution are separate from the offline Node path. Each job checks that the tracked/untracked checkout remains unchanged; build output is ignored. The Actions run for the relevant commit is the source of truth for Linux results, not a saved local pass count.

The existing 15-response model replay belongs to the historical snapshot prompt. It does not benchmark the new incident prompt. Runtime fixtures, live historical transactions and browser simulations stay distinct. A passing CI run does not establish market demand, independent security audit or universal accessibility.
