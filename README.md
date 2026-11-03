<!-- Author: Tommy -->
<div align="center">

# AgentGuard

### Give agents a budget. Keep control.

A spending vault on NEAR for agents you don't trust with your whole wallet.

[Judge quick start](#judge-quick-start) · [Testnet evidence](web/testnet-evidence.json) · [Security model](SECURITY.md)

</div>

An agent finds a supplier, reads a response, and decides to pay. Hidden inside that response is another instruction: send the money somewhere else.

The model might follow it. The vault shouldn't.

AgentGuard puts spending rules in a NEAR contract. The agent gets a key that can call one payment method. The owner chooses the recipients and budgets, keeps the administrative key, and can pause payments.

## What it does

- Pays approved suppliers within per-payment, UTC-day and lifetime limits.
- Rejects substituted recipients and requests above the budget.
- Prevents an accepted request from paying twice, including after a failed transfer.
- Keeps administrative controls out of the agent's hands.

The contract is deployed at **`guard.yatimi.testnet`**. Its deployed WASM was matched to the recorded Mac build; fresh builds have a separate provenance record. **Eight real-network checks passed**, alongside **20 Rust unit tests**, **77 JavaScript tests**, and **five isolated WASM runtime tests**. [Runtime evidence and injected-case boundaries](docs/RUNTIME-QA.md).

[Inspect a successful payment](https://explorer.testnet.near.org/transactions/SW9ntYJ5oRY6QsDwzFdSY61Cc5WPgtSAkeJaz3umN44) · [Inspect a blocked recipient](https://explorer.testnet.near.org/transactions/3ZL2bZoLX3NoanvmfKRcCu5NxaD1ayfPfLArSCz4geFe)

## Selected user and paid task

The paid workflow targets NEAR application developers handling support tickets: an agent buys a bounded diagnosis of one transaction and returns the failed execution step, native transfer outcomes, evidence and a support-response draft. A finalized trace without a failed receipt returns a free result. The diagnostic fee has its own invoice and spending limits; investigating a failure never authorizes a replacement payment.

[Product decision and acceptance criteria](docs/PRODUCT.md) · [Three checked examples](docs/INCIDENT-EXAMPLES.md). The full browser purchase is [recorded and verified](docs/live-incident-purchase.json). External-user demand has not yet been validated.

## Where we are

A complete local paid task now works: a free lookup checks the selected transaction; NEAR AI proposes one diagnostic fee; a restricted Keychain key signs the testnet payment; the vault settles it; the executor independently fetches the receipt trace again and unlocks the checked report. The AI support draft is separate from deterministic execution facts. [Live incident purchase and recovery](docs/live-incident-purchase.json) · [Quality checks and limits](docs/INCIDENT-QA.md). Earlier block-snapshot purchases remain readable as historical evidence.

The browser has two distinct surfaces: a live purchase backed by the local executor, and the original scripted security lab. The lab remains a teaching model. Preliminary model checks are recorded in [ai-smoke.json](docs/ai-smoke.json); the model resisted the injected text in that small experiment, so it is not presented as a successful model compromise.

This is a testnet prototype, not an independently audited vault.

## Judge quick start

Requires **Node.js 22.9 or later**, Git, and macOS or Linux. No npm packages, API key, NEAR CLI, wallet, Rust or `.env` needed for these commands.

```sh
git clone https://github.com/yatimi/agent-guard.git
cd agent-guard
npm run verify
npm run demo
```

Open **http://127.0.0.1:4174**. `npm run dev` starts the same safe recorded demo.

1. **Transfer confirmed, callback failed**: inspect the confirmed native transfer and separate failed settlement callback. This is a clearly labeled local Sandbox fault fixture.
2. **Transfer failed, callback returned false**: inspect the failed transfer despite a successful callback return. This is another recorded Sandbox execution.
3. **Completed testnet purchase**: view the delivered incident report, human-review AI draft and separate historical diagnostic-fee transaction. Replaying it sends nothing.
4. In **Free security simulation**, run **Recipient injection**: the local model returns `RECIPIENT_NOT_ALLOWED`. Valid purchase, budget breach, replay and pause controls exercise other teaching scenarios.

The demo serves only local public recordings and static assets. It recomputes incident facts from receipts, refuses live API mutations and neither imports the wallet/model clients nor reads `.env` or `.local`. Sandbox receipt hashes are not linked to public explorers. Downloads retain recorded-source provenance. Simulation and recorded evidence do not claim a fresh chain or model run.

`npm run verify` runs 77 JS tests, the 15-response historical model replay with 14 validator controls, and three incident-evidence replays. No network access or spending is needed, except loopback HTTP between local test processes. [Judge guide, optional checks and CI boundaries](docs/JUDGE.md).

Optional browser checks (installed Chrome/Chromium): `npm run test:browser`. It creates and closes its own temporary profile, tests both interfaces and stores screenshots only outside the checkout. No browser package is installed.

### Separate live executor

The recorded demo cannot start a live purchase. **`npm run dev:live`** explicitly starts the funded testnet executor at **http://127.0.0.1:4173** and may load your local `.env`. This remains a separate opt-in path; do not expose it publicly. Existing live purchase IDs and journals are retained in ignored `.local/`.

### Run the live purchase

Requires the configured testnet accounts and restricted key already in macOS Keychain, NEAR CLI, and a local `.env` containing `NEAR_AI_API_KEY`. See [TESTNET.md](TESTNET.md) for the setup boundary. Do not overwrite an existing `.env` or deploy over the owner account.

Start `npm run dev:live` and open http://127.0.0.1:4173.

1. Enter a network, transaction hash and sender, then choose **Check transaction · free**. The lookup uses public RPC and makes no AI request or payment.
2. A complete trace without failed receipts returns a free result. Missing, unfinalized or unsupported data cannot enable a purchase. A supported failure yields a ten-minute quote for the selected transaction.
3. Choose **Buy diagnosis**. One explicit purchase spends **0.01 testnet NEAR plus gas**, with at most two billed model requests. The executor checks deployed code and key permissions, validates the invoice, verifies signed bytes and waits for FINAL settlement.
4. Read native transfer outcomes and failed execution steps, then expand the optional human-review AI draft. The investigated transaction and diagnostic-fee transaction are labeled separately. Download the report and its source evidence.
5. Refresh or reopen the saved purchase: it retains the same payment and report. A paid but incomplete delivery offers recovery without a new fee.

Read-only example, **without Keychain, an AI key or a funded account**:

```sh
npm run inspect:transaction -- testnet BHBBWqBXhp2VVhDhyPQWT2ufxPPDvBN5AfjjDZQVBAhp yatimi.testnet
```

This recorded target was rejected with `RECIPIENT_NOT_ALLOWED`. Public RPC availability is not guaranteed. The browser's successful recorded example exercises the free path; a supplied failed target can exercise the paid path with your authorized local setup. Tests use saved fixtures when live RPC is unavailable.

Our supplier assembles public RPC data. The demonstration fee is not evidence of commercial willingness to pay. Scope: native NEAR Transfer actions and execution failures in bounded, complete FINAL traces; attached deposits, token balances, bridge settlement and external delivery are not reconciled. Binding the target and report hash to the invoice happens locally, not in an onchain delivery proof. [Local API and failure checks](docs/API.md).

## Reproduce the security evaluation

```sh
npm run benchmark:security
npm run benchmark:security:replay
```

Both commands work without keys or spend. The first checks 14 deterministic validator controls; the second rechecks 15 historical block-snapshot model outputs against their exact prompts and source hashes. The current `incident-v1` purchase prompt is versioned separately; this historical benchmark does not measure it. In the live sample, 4/4 normal inputs produced the approved invoice, and all 11 adversarial inputs left the original invoice unchanged. No successful model compromise or model-generated chain rejection is claimed. [Cases, full results and security boundaries](docs/SECURITY-BENCHMARK.md).

To repeat the live model experiment explicitly with your configured key: `npm run benchmark:security:send` (15 attempts maximum, at most $0.15 conservative reservation from the shared $1 budget, no transactions).

## Check the AI connection

The optional check uses NEAR AI Cloud with `z-ai/glm-5.3-flash`. It asks for payment proposals in two small fixtures and validates them against an owner-approved quote. It never signs a blockchain transaction. This is a connectivity check, not a full prompt-injection evaluation.

```sh
# Print the plan; no key or paid request needed.
npm run check:ai

# Set your own API key in .env first.
cp -n .env.example .env

# Explicit opt-in: two short, billed model requests.
npm run check:ai:send
```

Do not overwrite an existing `.env`. The sending command requires an available model with tool support and valid published prices. It caps output, makes no automatic retries and conservatively reserves one cent before each attempt, with a cumulative $1 local ceiling. A lock prevents concurrent checks. Reservations remain held even after failures or timeouts. Reports and the budget ledger stay in ignored `.local/`; token-based cost estimates are not a provider billing statement.

<details>
<summary><strong>Build, verify and inspect the implementation</strong></summary>

## Test and build the contract

Install [Rust](https://rust-lang.org/tools/install/) and [NEAR CLI](https://docs.near.org/tools/cli). Cargo uses the pinned test toolchain in `rust-toolchain.toml`. The WASM build uses Rust 1.86 to avoid newer compiler WASM features. `Cargo.lock` pins the SDK dependency graph; do not update it without rebuilding and checking runtime compatibility.

```sh
rustup toolchain install 1.86.0 --profile minimal
rustup target add wasm32-unknown-unknown --toolchain 1.86.0
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
npm run build:contract
```

Artifact: `target/wasm32-unknown-unknown/release/agent_guard.wasm`.

The 20 Rust tests cover authorization, initialization, malicious recipients, zero/oversized payments, replay, concurrent requests, split payments, UTC-day rollover, lifetime limits, pause, owner recovery boundaries and failed-transfer accounting. They use NEAR's mocked runtime. Protocol-level access-key restrictions and asynchronous receipt behavior need separate real-network verification.

## Isolated runtime checks

The optional [runtime test workspace](runtime-tests/README.md) installs official NEAR test tooling separately from the contract. After its one-time setup, `npm run test:runtime` executes five cases on fresh local accounts and writes receipts outside the checkout. No AI key, funded account or Keychain is required.

## Recorded testnet verification

`testnet.json` contains public deployment configuration only. Eight testnet checks passed: permitted payment and settlement, recipient substitution, oversized amount, replay, forbidden administration, forbidden receiver, private callback rejection and emergency pause. Failed-transfer refunds and concurrent payments also have local WASM runtime coverage. A previous-day state fixture and a separate callback-gas fault variant exercise additional boundaries; see [runtime results](docs/RUNTIME-QA.md). These are local sandbox checks, not new public-testnet transactions.

```sh
# Read the plan; does not sign or send anything.
npm run test:testnet

# Opt in explicitly: signs a new 0.01 NEAR payment and attack/owner-control checks.
npm run test:testnet:send
```

The sending command requires the configured keys already in the local macOS Keychain and consumes testnet gas. It does not create accounts, deploy contracts or replenish its budget. It saves a complete passing run to `web/testnet-evidence.json`. Partial results and signed transactions stay in ignored `.local/` files. Do not run against somebody else's deployment or change configuration to mainnet.

NEAR CLI 0.30.1 online Keychain signing selects a full-access key even when `--signer-public-key` is supplied. The verifier and live executor share an offline signer. It independently decodes the Borsh bytes, checks every expected field and verifies the Ed25519 signature before broadcasting the transaction through the public testnet RPC. The private key never leaves Keychain. Finalized contract state is polled before accepting settlement or pause outcomes.

## Design

```text
Owner full-access key ── configure / pause / withdraw
                                │
Agent function-call key ── pay ──► Separate vault contract
                                  ├─ signer + public key
                                  ├─ allowlisted recipient
                                  ├─ nonce + no in-flight payment
                                  ├─ payment / day / lifetime cap
                                  └─ reserve budget → transfer → private callback
```

The agent key belongs to the owner account but is pinned to a separate vault's `pay` method. The contract checks both immediate caller and signer, and pins the public key. The owner's other key controls pause and recovery. Owner and vault must be different accounts.

Function-call key allowance limits **gas**, not transferred principal. Payments use the vault's prefunded NEAR and attach zero deposit. The contract enforces the principal limits. See [NEAR access keys](https://docs.near.org/protocol/accounts-contracts/access-keys).

Policy is immutable in this first version. At most 16 recipients. A fixed-size pending payment prevents unbounded payment history in state; completed events go to logs. There is one in-flight agent payment at a time. Budget is reserved before dispatch and restored on a failed transfer. An accepted nonce is consumed even if the transfer fails. Daily limits use fixed UTC days, not rolling 24-hour windows.

See [SECURITY.md](SECURITY.md) for the trust boundary and limitations, and [TESTNET.md](TESTNET.md) for the next integration milestone.

## Repository layout

- `contract/src`: authoritative contract and serialized policy/payment types.
- `contract/tests`: mocked-runtime security tests.
- `runtime-tests`: separately locked integration tests against local NEAR Sandbox.
- `web`: teaching model, browser interface and model tests.
- `server`: model adapter, invoice validator, restricted signer, receipt checks and saved purchase workflow.
- `tests`: signing, invoice, settlement and restart/idempotency checks.
- `scripts`: loopback-only server and explicit verification tools.
- `postman`: local AI and incident-RPC stand-ins; no provider credentials.

Uses official `near-sdk` 5.17.2, pinned in the manifest and lockfile. Browser code uses platform APIs only. No application template was used. Developed with AI coding assistance; the tests and linked testnet evidence describe what has actually been verified.

</details>

## NEAR Hackathon 2026

Built during the hackathon window, starting from an empty directory. There is no pre-hackathon application baseline. Primary track: **AI Security & Defense**.

The paid task is recorded. Process-kill recovery and browser fixture checks are documented in [Recovery QA](docs/RECOVERY-QA.md). A [fresh browser purchase](docs/live-browser-purchase.json) completed after refresh during pending payment. A fixed model evaluation and offline evidence replay are also available. Local WASM runtime checks now cover the next failure boundaries; [scoped UI/UX fixes](docs/UX-QA.md) are verified too. The incident purchase has a live browser payment/reopen recording. The default recorded judge demo and offline verification require no project keys. [GitHub Actions](https://github.com/yatimi/agent-guard/actions/workflows/verify.yml) checks Node, browser, Rust/WASM and isolated Sandbox behavior. Next: real-user usefulness validation, remaining accessibility and the final demo video.

## License

MIT. Copyright 2026 Tommy.
