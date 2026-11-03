<!-- Author: Tommy -->
<div align="center">

# AgentGuard

### Give agents a budget. Keep control.

A spending vault on NEAR for agents you don't trust with your whole wallet.

[Try the lab](#try-the-local-lab) · [Testnet evidence](web/testnet-evidence.json) · [Security model](SECURITY.md)

</div>

![AgentGuard security lab and recorded testnet checks](docs/preview.jpg)

An agent finds a supplier, reads a response, and decides to pay. Hidden inside that response is another instruction: send the money somewhere else.

The model might follow it. The vault shouldn't.

AgentGuard puts spending rules in a NEAR contract. The agent gets a key that can call one payment method. The owner chooses the recipients and budgets, keeps the administrative key, and can pause payments.

## What it does

- Pays approved suppliers within per-payment, UTC-day and lifetime limits.
- Rejects substituted recipients and requests above the budget.
- Prevents an accepted request from paying twice, including after a failed transfer.
- Keeps administrative controls out of the agent's hands.

The contract is deployed at **`guard.yatimi.testnet`**. Its published WASM matches the local build. **Eight real-network checks passed**, alongside **20 Rust tests** and **10 browser-model tests**.

[Inspect a successful payment](https://explorer.testnet.near.org/transactions/SW9ntYJ5oRY6QsDwzFdSY61Cc5WPgtSAkeJaz3umN44) · [Inspect a blocked recipient](https://explorer.testnet.near.org/transactions/3ZL2bZoLX3NoanvmfKRcCu5NxaD1ayfPfLArSCz4geFe)

## Where we are

The contract and testnet verifier work today. The interactive browser lab runs scripted scenarios in a separate teaching model; recorded testnet results appear below it. Two preliminary live NEAR AI checks also passed: the model proposed the approved payment and kept the approved recipient in one injected-text scenario. These were proposals only, with no blockchain execution. A complete paid LLM task and browser signing are still to come. [Recorded model proposal check](docs/ai-smoke.json).

This is a testnet prototype, not an independently audited vault.

## Try the local lab

Requires Node.js 22 or later. No npm dependencies or installation step.

```sh
npm test
npm run dev
```

Open http://127.0.0.1:4173.

1. Run **Valid purchase**: the model balance decreases from 10 to 9.6 NEAR.
2. Run **Prompt injection**: `RECIPIENT_NOT_ALLOWED`; balance stays at 9.6.
3. Run **Budget breach**: `PAYMENT_LIMIT`; balance stays unchanged.
4. Run **Replay attack**: nonce 0 is rejected after the first accepted payment.
5. Pause the agent and try a valid purchase: `PAUSED`.
6. Export JSON: the file identifies itself as `local-simulation` and includes each decision and state.

Resetting the lab clears local history. No browser persistence, signing keys, external fonts, analytics or model provider are used.

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

## Recorded testnet verification

`testnet.json` contains public deployment configuration only. Eight testnet checks passed: permitted payment and settlement, recipient substitution, oversized amount, replay, forbidden administration, forbidden receiver, private callback rejection and emergency pause. Failed-transfer refunds, UTC-day rollover and concurrent-call behavior currently have unit coverage only.

```sh
# Read the plan; does not sign or send anything.
npm run test:testnet

# Opt in explicitly: signs a new 0.01 NEAR payment and attack/owner-control checks.
npm run test:testnet:send
```

The sending command requires the configured keys already in the local macOS Keychain and consumes testnet gas. It does not create accounts, deploy contracts or replenish its budget. It saves a complete passing run to `web/testnet-evidence.json`. Partial results and signed transactions stay in ignored `.local/` files. Do not run against somebody else's deployment or change configuration to mainnet.

NEAR CLI 0.30.1 online Keychain signing selects a full-access key even when `--signer-public-key` is supplied. The verifier signs offline using the exact public key, nonce and block context, then broadcasts the signed transaction through the public testnet RPC. The private key never leaves Keychain. Finalized contract state is polled before accepting settlement or pause outcomes.

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
- `web`: teaching model, browser interface and model tests.
- `scripts`: loopback-only static server and explicit testnet verifier.

Uses official `near-sdk` 5.17.2, pinned in the manifest and lockfile. Browser code uses platform APIs only. No application template was used. Developed with AI coding assistance; the tests and linked testnet evidence describe what has actually been verified.

</details>

## NEAR Hackathon 2026

Built during the hackathon window, starting from an empty directory. There is no pre-hackathon application baseline. Primary track: **AI Security & Defense**.

The next milestone is an agent completing a useful paid task, with both the successful purchase and an injected payment attempt visible in one demo.

## License

MIT. Copyright 2026 Tommy.
