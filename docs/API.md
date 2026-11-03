<!-- Author: Tommy -->
# Local executor API

The explicit `npm run dev:live` server listens only on `127.0.0.1:4173`. Default `npm run dev` / `npm run demo` instead starts the separate recorded demo on port 4174; it refuses every live API operation. This API executes the owner's local testnet setup and must not be exposed on a public host. Browser source contains no model or signing key. Payment accounts, amount, method and provider endpoints are fixed in server composition. The caller can select only the diagnostic target's network, hash and sender.

## Requests

| Method and path | Input | Result |
| --- | --- | --- |
| `GET /api/session` | None | Local CSRF token, public account configuration, testnet price, recoverable purchase references |
| `POST /api/inspections` | `{target: {network, transactionHash, sender}}` | Free RPC inspection; immutable target, expiry, eligibility, preview; full report for free results |
| `POST /api/runs` | `{requestId, scenario, inspectionId}` | 202 and saved run; existing exact intent returns its original run |
| `GET /api/runs/{id}` | UUID v4 | Saved public trace, target, service-payment hash; report after verified delivery |
| `POST /api/runs/{id}/resume` | `{}` | Reconcile the original payment or retry paid delivery; never sign/broadcast another payment |

IDs must be primitive UUID v4 strings. `scenario` is `purchase` or `injection`. `network` is `testnet` or `mainnet` for read-only diagnosis; diagnostic fees are always testnet. Sender/hash are validated primitive strings. Extra fields are rejected. There is no arbitrary URL input.

POST requires exact `Origin: http://127.0.0.1:4173`, `Host: 127.0.0.1:4173`, `Content-Type: application/json` and session `X-AgentGuard-Token`. Bodies are limited to 4096 bytes. No remote CORS permission. Errors are JSON `{error}` with 400, 403, 409 or 413; missing run is 404. A conflict may include `recovery: {id, scenario, inspectionId}`; legacy references lack inspectionId. Pre-journal quote expiry, missing inspection or a free result returns `noPurchaseCreated: true`, allowing a fresh free check rather than an endless missing-run recovery loop.

## Inspection and task binding

A single diagnostic read is active per executor. The bounded collector requires a FINAL trace, matching transaction/sender, supported Transfer/FunctionCall actions, complete body/outcome coverage, a connected receipt creation graph and consistent returned-status chains. It rejects unsupported/unavailable/malformed traces before a quote. RPC bodies are capped at 2 MB, traces at 128 receipts, action batches at 32, diagnostic reads at ten seconds. Metadata/order differences do not alter the normalized source hash.

A complete trace with no failed receipt is free and cannot be purchased. A supported failure gets a ten-minute, single-use inspection. The report and normalized source are saved in ignored `.local/inspections/`. Quote binding includes `task: {version: "incident-v1", target}`, recipient, exact price, expiry and `reportSha256`. The executor verifies the saved report and re-fetches source evidence both before proposing payment and before delivery. Inspection reuse with a new UUID returns `INSPECTION_ALREADY_USED` and the original reference.

Native Transfer actions and their outcomes are facts; system transfers are separate. Attached deposits, token balances, bridge settlement and business fulfillment are not reconciled. RPC is trusted; this is not light-client verification. The fee and investigated transaction have separate hashes.

## Lifecycle and recovery

`queued → collecting → planning → signing → pending → summarizing → completed`.

- `blocked`: no saved payment to reconcile; review the reason before another explicit purchase.
- `needs_attention`: saved signed payment, unresolved proof. Keep its ID and reconcile the original hash. New purchases remain blocked.
- `paid_incomplete`: fee proof saved, delivery verification failed. Keep both target and fee visible; explicit resume retries delivery without another payment or AI request.
- `summarizing`: payment and report already verified. An interrupted or failed AI draft does not remove the report or authorize another fee.

A nonterminal run read by an idle executor has `recoveryRequired: true`. GET never starts work. Session recovery also includes paid-but-incomplete runs. Resume refreshes the session token after restart and re-reads the journal under the execution lock. A run interrupted before a saved payment is safely stopped. A completed run returns its existing proof without model use. A run with saved proof but unverified delivery must pass source verification before being marked complete.

The browser saves `{id, scenario, inspectionId}` before POST, with a per-ID record and last-viewed pointer. Lost responses keep Buy disabled; reconnect checks the same ID, and an explicit retry of an absent journal reuses that intent. Competing tabs reopen the saved purchase. Retain the local journal across restarts. Single-use inspections also prevent a new request ID from paying for the same quote twice.

Signed bytes/hash are persisted before broadcast and excluded from the public API. FINAL settlement verifies signer/key/receiver/action, successful receipt outcomes and matching reservation/settlement events. The report stays hidden until delivery is verified. Exact model proposals are visible as text; AI draft prose is separate from deterministic facts and requires human review. New runs retain a timestamped vault preflight observation, not a live balance feed.

Legacy snapshot journals remain readable/recoverable, but production admission requires a new incident inspection. The supplier, quote and journal remain trusted local components; the contract does not commit the report hash or attest delivery. [Incident QA](INCIDENT-QA.md) and [earlier recovery checks](RECOVERY-QA.md) distinguish live, simulated and historical evidence.

## Zero-credit HTTP failure check

Postman CLI 1.73.0 was used locally, without login or publication. No authenticated owner workspace was available, so the stand-in was built from the observed catalog/response shape rather than fetched from a team's shared mock. It models only two paths; other operations return 501.

```sh
# Terminal 1; replace the executable path if Postman is on your PATH.
/Users/tommy/.local/bin/postman simulation run postman/simulations/ai-failure.sim.yaml --port 4010 --no-history --output ndjson

# Terminal 2; uses a dummy key and temporary budget directory.
node scripts/test-ai-failure.mjs
```

The real `AiClient` reads the mock model catalog, receives HTTP 429 on its completion request, does not retry, and retains one conservative reservation. The request log was inspected: one GET 200 and one POST 429. These results establish local caller behavior, not the live provider's exact failure timing or billing rules.

## Preflight and local locks

Both preflight checks verify per-payment, current UTC-day and lifetime capacity, plus liquid vault balance after storage and the 0.05 NEAR reserve. Storage cost mirrors the pinned near-sdk 5.17.2 WASM. This prevents known-doomed payments before AI work or signing; the contract remains authoritative if chain state changes after preflight.

Local locks publish complete PID/token metadata via a hard link and serialize every acquisition through a short `.reclaim` guard. An ordinary dead owner is recoverable. A persistent `LOCK_RECOVERY_REQUIRES_INSPECTION` can mean the acquisition process died while holding that guard. Stop all AgentGuard writers, inspect the guard/main-lock owners and saved journals, and preserve all payment records and AI reservations before explicitly removing an orphaned guard. Never delete a live lock or reset the budget ledger to clear an error. A PID that has been reused can conservatively block automatic recovery.

These guarantees apply to cooperating processes on a local filesystem. SIGKILL tests do not establish durability under OS/power loss; journal writes use rename without fsync. Remote/shared filesystems and hostile local writers are outside scope.

## Zero-credit incident RPC check

```sh
# Terminal 1; local stand-in only, no Postman account needed.
/Users/tommy/.local/bin/postman simulation run postman/simulations/incident-rpc.sim.yaml --port 4011 --no-history --output ndjson

# Terminal 2; actual RpcClient and IncidentService, no AI or wallet imports.
node scripts/test-incident-http.mjs
```

Checks a recorded FINAL trace and independent source re-read, missing receipt, HTTP 429, timeout and response-size rejection. Six requests were observed in the local simulation; no automatic retry. The test endpoint is constructor-injected only by this explicit harness; production endpoints stay fixed. [Assumptions and evidence](../postman/simulations/incident-rpc.context.yaml). The initial stand-in run failed because Postman had already parsed the request body; the mock was corrected before the passing run. No live provider quota or timeout was forced.
