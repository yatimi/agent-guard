<!-- Author: Tommy -->
# One guarded support task

**User:** a NEAR application developer who also handles payment-support tickets. **Job:** investigate one transaction, explain the failed step and supported transfer outcomes, and prepare an evidence-based answer before another payment is considered. **Product:** AgentGuard lets that team's agent buy the diagnosis within an approved quote and spending policy, then retain or recover the original payment and result.

The requester reporting a problem does not connect a wallet. The team's testnet owner authorizes the diagnostic purchase. The investigated transaction and the diagnostic fee are different transactions and may belong to different networks; every implemented fee is testnet.

## What the implementation demonstrates

1. **Bounded tool use:** the model proposes one payment. The local validator checks the exact invoice; a restricted function-call key and Rust vault enforce their separate authority/recipient/budget boundaries. The contract does not enforce invoice identity or report delivery.
2. **Checkable task completion:** source receipts produce deterministic execution facts; the quote binds the target/report locally; FINAL fee settlement and a fresh source read precede delivery. Restart recovery checks the saved payment rather than making another one.

These are demonstrated capabilities, not a claim that no competitor offers them. The small fixed model evaluation measures observed resistance; deliberately altered proposals, testnet calls and Sandbox failures establish different enforcement boundaries.

## Why an agent, and why might someone pay?

The prototype deliberately limits agent autonomy: a human selects the target and confirms a quote; the model proposes the service call and drafts a human-review reply. Receipt interpretation and payment authorization checks do not depend on trusting its prose. It is not an unattended support department, general purchasing agent or automatic refund bot.

A team might value a consistent report/API, source references, a usable support handoff and recoverable service payment. Public data remains free. An engineer who can answer quickly using an explorer or existing script is a valid non-customer. The current supplier is our demonstration service, the price is testnet, and no external-user time saving or commercial demand has been measured.

## Adjacent options checked on 2026-11-03

| Option and primary documentation | Documented focus | Implication for this project |
| --- | --- | --- |
| [FastNEAR transaction API](https://docs.fastnear.com/tx/examples), [NEAR RPC](https://docs.near.org/api/rpc/transactions) and explorers | Transaction/receipt lookup and asynchronous execution analysis | The raw evidence and even diagnostic examples already exist. Our value must be in the completed support workflow and guarded spending, not exclusive access to data |
| [OutLayer](https://app.outlayer.ai/docs/getting-started) | Verifiable execution, agent custody and TEE-related tooling | Generic safe-agent payments are not a sufficient originality claim. We do not claim equivalent attestation or compare security without an audit |
| [Coinbase Agentic Wallet](https://docs.cdp.coinbase.com/agentic-wallet/welcome) | Agent wallet tools, guardrails and CLI/MCP service payments | Agent payment itself is not new. Our demonstrated focus is the NEAR receipt/support task and its recovery behavior |
| [NEAR Agent Market](https://docs.market.near.ai/) | Hiring agents with held payment and deliverable acceptance | AgentGuard is not an escrow or marketplace; its local report verification is not trustless delivery |
| [CodeMasterLabs/agentguard](https://github.com/CodeMasterLabs/agentguard) | Same-name NEAR spending firewall; public policy code implements token/recipient/amount/rate limits and owner-review decisions; the repository also presents MCP and a TEE risk oracle | Direct overlap in the guarded-spending premise. Its documented integration scope is broader than this prototype. Our focused support task is a distinction to demonstrate, not proof of superior security or exclusive functionality |

This is a focused documentation comparison. Features not evaluated are unknown, not absent.

The [official public security directory](https://nearhackathon.com/api/projects?track=security&page=1) reported 52 entries on 2026-11-03. We inspected its first eight titles and public demo links. They include Veto (an onchain spending firewall), Semilla1 Guard, Allowance, LeashPay, NEAR Agent Spend Guard, Veridom Pay, Throughput Treasury and an entry named AgentGuard. The directory exposes titles/tracks/demo URLs, not repository implementations; the linked X content could not be retrieved in this review. Similar titles establish overlap in positioning, not equivalent functionality, quality or verified security. No full entry audit or ranking is claimed.

Separately, we read the CodeMasterLabs repository README, [`contract/src/policy.rs`](https://github.com/CodeMasterLabs/agentguard/blob/main/contract/src/policy.rs) and [`mcp/src/index.ts`](https://github.com/CodeMasterLabs/agentguard/blob/main/mcp/src/index.ts). This confirms a similar public implementation exists; we did not run its tests, audit its contract, verify its deployment or establish a primary-source link between that repository and the directory's X post. Its TEE claims remain author-reported here. A support incident/report workflow was not demonstrated in those inspected files; that is not a claim that the project cannot provide one.

The name alone is therefore insufficient to identify this implementation. Its canonical repository is **yatimi/agent-guard**. Confirm the final submission identity/name before publishing the demo post. Our concrete distinction to demonstrate is the completed NEAR support task with explicit receipt outcomes and recovery of its constrained diagnostic payment; exclusivity remains unproven.

## Claims a judge can check

| Claim | Where to check | Boundary |
| --- | --- | --- |
| A successful overall return can coexist with a failed receipt | Default mainnet demo case and [source comparison](MAINNET-CASE.md) | Archived RPC observation; no token-balance/refund conclusion |
| A confirmed native transfer can survive callback failure | Sandbox callback case and [runtime evidence](RUNTIME-QA.md) | Deliberately gas-starved artifact, not an observed production incident |
| A constrained agent can complete a paid support task | [Recorded testnet purchase](live-incident-purchase.json) | Local trusted supplier/executor; no mainnet custody claim |
| Unresolved payment does not trigger a new fee | `npm run verify`, [failure matrix](FAILURE-QA.md) | Controlled fixtures/process recovery; no general repair/refund mechanism |
| Judges can inspect the project without our credentials | `npm run verify`, `npm run demo`, GitHub Actions | Recorded/local checks; live mode needs its own authorized setup |

Next evidence that would strengthen adoption claims is external feedback or observed usage. It is optional for submission, and its absence is stated. We do not turn test counts into a market-demand or prize-probability claim.
