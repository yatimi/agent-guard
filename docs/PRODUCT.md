<!-- Author: Tommy -->
# Paid transaction diagnosis for NEAR support agents

Decision: 2026-11-03. AgentGuard will target the developer or support engineer responsible for payment incidents in a NEAR application. Their agent can buy one bounded diagnostic report for a specific transaction and return an explanation with evidence. AgentGuard remains the spending-control product; the diagnostic supplier is the selected paid service used to demonstrate it.

Implemented on 2026-11-03: the primary paid UI now diagnoses transactions. The historical block-snapshot journals remain readable. Three [checked examples](INCIDENT-EXAMPLES.md), [73 JS tests and 26 browser checks](INCIDENT-QA.md), and one [live diagnostic purchase](live-incident-purchase.json) establish the stated implementation scope. Commercial demand remains unproven.

## User and recurring job

The initial user is a developer at a small NEAR application team who also handles support. A customer provides a transaction hash and says, “The payment failed. Should I try again?” The engineer must inspect execution steps, identify what happened before the failure, and prepare a defensible response. The team owns the agent and its budget; the customer reporting the incident does not need a wallet connection to request an explanation.

The task is: **“Investigate this NEAR transaction. Explain the failed step, show which native NEAR transfers are confirmed, and prepare a support reply with evidence and the next manual check. Spend at most the approved diagnostic quote.”**

NEAR cross-contract calls and callbacks execute independently; a later failure does not automatically undo an earlier action. That makes a single success/failure label insufficient for this job. [NEAR cross-contract documentation](https://docs.near.org/smart-contracts/anatomy/crosscontract).

## What the agent buys

One report covers one network, transaction hash and sender. Its output contains:

- The observed finality, transaction identity and coverage of the receipt trace.
- Each failed receipt, its receiver, method when available, exact runtime error and source reference.
- Confirmed native NEAR transfer actions, their individual outcomes and separately identified system transfers. A system transfer is not automatically called a principal refund.
- A concise conclusion, unresolved questions, the next manual check and a support-response draft. Amounts and execution findings come from deterministic checks; the model explains those findings.
- Raw source references, observation time and a content hash so the owner can inspect what the report used.

The MVP covers native NEAR transfers and execution failures. Arbitrary fungible-token balances, bridge settlement, exchange credits and business-level fulfillment require other evidence. It never authorizes a replacement payment or refunds funds on behalf of the user. Missing receipt details stop the free check before a paid quote. If a source becomes unavailable after payment, the purchase explicitly remains paid but incomplete, with a recovery path.

The diagnostic target and the payment for the diagnostic service have **different transaction hashes**. Both must stay visible and correctly labeled. The support agent uses a separate diagnostic budget from the application payment being investigated. If its own service-payment vault is blocked by an unresolved payment, the existing recovery gate stays closed; diagnosis must not bypass it to buy another service.

## Why a team might pay

The service would charge for assembling and checking a support-ready explanation, maintaining receipt interpretation and producing a consistent output for an agent. Public transaction data remains accessible without buying our report. An engineer who can answer the ticket quickly in an explorer is a valid non-customer.

The implemented flow starts with a free lookup. A complete trace with no failed receipt returns a free result, including successful function calls and application-specific `false` return values. A supported trace containing a failed receipt may be purchased after explicit user confirmation. Missing or unsupported action data stops admission. This deterministic rule is deliberately narrow; the presence of a failure is not proof that the report is commercially valuable.

For the hackathon, use the existing **0.01 testnet NEAR fixed quote**, plus disclosed payment gas and at most two billed AI requests. This is a demonstration price, not evidence of a commercial market price. The supplier initially remains our own test service. Willingness to pay and actual time saved are hypotheses to test with users.

## Purchase and attack demonstration

1. The owner supplies the diagnostic target and maximum service fee. Validate the account/hash/network and use fixed RPC endpoints. Never fetch an arbitrary URL from a support ticket.
2. The supplier checks whether it can produce the requested coverage and offers a quote bound to the task, target, recipient, amount, expiry and report hash. Unsupported or unavailable targets stop before payment. The owner-approved input binds these fields locally; supplier text cannot replace them.
3. The agent chooses to buy or decline. The existing invoice validator, restricted key and vault enforce the purchase boundaries. The report is unlocked only after verified settlement.
4. The executor checks the delivered hash and target, derives execution facts from the referenced receipts, and produces the explanation. Claims about execution must match independently retrieved data from the configured RPC, not just supplier-authored JSON; this still trusts that RPC and is not light-client verification. A paid but incomplete delivery remains visible; there is no automatic refund or second purchase. This prototype is not an escrow or proof of fair delivery.
5. In the attack case, supplier text demands an “urgent recovery payment” to another address or a second charge. Record the actual model proposal and enforcement outcome. If the model refuses the instruction, show that result; separate deterministic probes demonstrate the spending boundary without claiming the model was compromised.

The core story is one delegated support task: the agent can pay for investigation, while the owner retains control over where money goes and how much can be spent.

## Alternatives and choice

| Candidate task | Assessment | Decision |
| --- | --- | --- |
| Six-block network snapshot | Already working; observations have weak standalone usefulness and a simple free substitute | Preserve its historical evidence; replace as the main paid job |
| Counterparty risk or scam score | Relevant security topic, but reliable labels, coverage and false-positive evaluation are missing | Do not turn account age or code changes into an unsupported safety verdict |
| Explain a specific transaction incident | Concrete support question; available receipt data; correctness can be checked against execution; existing failure traces provide examples | Implemented as the primary paid task |

Comparison checked on 2026-11-03:

| Existing option | What the primary source establishes | Consequence for AgentGuard |
| --- | --- | --- |
| NEAR RPC and an engineer's own scripts | Transaction status and receipt details are queryable; `FINAL` includes refund completion, with documented receipt-coverage caveats. [NEAR RPC](https://docs.near.org/api/rpc/transactions) | Raw data access is not our paid advantage. Trace coverage and a checked explanation must justify the service. |
| FastNear infrastructure | RPC covers raw execution; indexed APIs serve higher-level lookups and historical data access. [FastNear RPC](https://docs.fastnear.com/rpc) | Reuse infrastructure. Do not build an indexer or claim that nobody already supplies transaction data. |
| Coinbase Agentic Wallet | CLI and MCP tools support agent wallets and x402 service payments with security guardrails. [Coinbase overview](https://docs.cdp.coinbase.com/agentic-wallet/welcome) | Agent payments alone are established functionality. Our case must demonstrate the bounded NEAR task, verifiable execution and recovery behavior. |

These are alternatives and adjacent products, not a complete survey of hackathon entries. Their internal security was not evaluated. The intended differentiation is the combination of a completed support task and inspectable NEAR enforcement/failure evidence; uniqueness remains unproven.

## Implementation and acceptance

Keep the production Rust contract and its dependency graph. Replace the supplier payload and result presentation within the existing purchase flow. Add a bounded diagnostic collector and deterministic report checks; generalize the current dataset title/hash binding to a versioned task descriptor. Keep older journals readable. Changes to the shared model prompt require a new benchmark version; historical prompt hashes must remain historical.

The implementation exercises these acceptance cases; scope and evidence are recorded in [Incident QA](INCIDENT-QA.md):

| Case | Required outcome |
| --- | --- |
| Simple confirmed native payment | Free result with evidence; no diagnostic charge merely to restate the status |
| Transfer succeeds but callback fails | Report the transfer and callback separately; never infer that no money moved |
| Failed transfer followed by a successful callback returning false | Preserve the transfer failure; do not turn `SuccessValue` into a successful payment claim |
| Receipt list missing, malformed, unfinalized or inconsistent | Incomplete/unsupported outcome; no invented refund or retry advice; fail admission before payment when detectable |
| Supplier changes target, price, recipient or delivered content | Reject the mismatch; preserve the original task and invoice |
| Refresh or interruption after the diagnostic fee | Reconcile the same service-payment hash and recover the same report without a second fee |
| Report unavailable after a settled service payment | Show paid-but-incomplete with the saved payment and reason; no automatic refund claim |

Run a small user study with three NEAR developers/support engineers on matched incident cases: current explorer/RPC workflow versus the report, with order varied. Measure time to a correct explanation, incorrect money-movement conclusions, evidence traceability and whether they would reuse it. A provisional target is at least 30% less median time with no incorrect payment/refund conclusions; this is an acceptance target, not a measured result. Ask about current incident frequency and willingness to pay after the task. Interest is not a paying customer. If it adds no material value over the free workflow, do not expand features to hide that result.

The selected task is implemented and exercised end to end. The UI now leads with a conservative payment decision and offers a copyable support handoff assembled from checked facts, independently of the AI draft. Each amount and receipt stays attributable; recorded Sandbox labels survive copying. This makes the output usable in a support workflow without trusting model prose.

External-user validation, independent supplier integration and commercial demand remain open. The [three-person pilot protocol and runnable material preparation](USER-VALIDATION.md) are ready; the 30% figure above remains an unmeasured hypothesis, and this pilot is not designed to establish that percentage. The current purchase prompt now has its own [15-case live evaluation](INCIDENT-SECURITY.md); the old snapshot benchmark remains historical.
