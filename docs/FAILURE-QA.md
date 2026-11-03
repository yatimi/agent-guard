<!-- Author: Tommy -->
# Upstream failures and safe recovery

Verified locally on 2026-11-03: `npm run verify` passes 98 JS tests and the two model-evidence/three incident replays. Chrome passes 28 live-flow fixtures and six recorded-demo groups. This milestone uses local HTTP servers, dummy credentials, temporary journals and controlled receipt fixtures. It sends no new model request or blockchain transaction. The production Rust contract, deployment pin and recorded live evidence are unchanged.

## Failure boundaries

| Controlled input | Observed behavior |
| --- | --- |
| AI catalog 401/503, malformed or oversized JSON | Stops before completion and before a budget reservation |
| AI completion 401/429/503 | One attempt, no retry, conservative reservation retained |
| Completion headers or body stall | Bounded timeout; reservation retained even though provider billing is unknown |
| Invalid JSON, message shape or oversized completion | Safe error code, no raw JSON parser diagnostic, no proposal reaches signing |
| Held-open non-success HTTP body | AI and RPC clients cancel the unused stream |
| RPC 503, unknown transaction, malformed/oversized/missing result, stalled body | Cannot become a successful payment result |
| Invalid vault view bytes/JSON or arbitrary RPC diagnostic | Sanitized error; invalid preflight cannot reach signing |
| Fee returns false, callback fails, a receipt fails, or settlement event is missing | No proof or unlocked report; original hash retained; repeated resume signs/broadcasts nothing; another purchase is blocked |
| Malicious runtime error and deliberately malicious support draft with tool calls | Draft has no tools; returned tool calls are ignored; checked report/handoff stay unchanged; Chrome renders inert text in a collapsed review section |

AI catalog/completion and RPC bodies each have a 2 MB limit. Production AI requests time out after 45 seconds; executor RPC requests after 20 seconds. Diagnostic source reads have their own ten-second bound. The per-request AI reservation remains $0.01 under the existing $1 cap; these values are accounting limits, not a billing quote. Invalid token usage produces no cost estimate. The clients do not automatically retry an inference or payment.

Tests live in `tests/upstream-failures.test.mjs`, `tests/workflow.test.mjs` and `scripts/check-browser.mjs`. Fee variants deliberately mutate fixture outcomes to exercise rejection paths; they are not fresh chain observations. Existing [WASM tests](RUNTIME-QA.md) and [process-kill checks](RECOVERY-QA.md) provide separate evidence. The malicious-draft test forces a hostile answer; it does not measure the live model's resistance to that prompt.

## Operator runbook

1. **Connection lost or outcome unknown:** retain the purchase ID, target and fee hash. Reopen the same page and use **Check saved purchase**. A timeout is not proof of failure or refund. Keep `.local` journals and the AI budget ledger in place; do not delete them to enable another fee.
2. **Stop the local executor:** use Ctrl-C in its terminal. This stops local work, not a transaction already broadcast. Restart the same checkout with `npm run dev:live`, then check the saved purchase. Recovery before a saved payment stops that run; recovery after signing checks the original hash. It does not sign or broadcast a replacement.
3. **Stopped before payment / AI failure:** review the service error and restore the provider before explicitly requesting a fresh inspection/purchase. Reopening the stopped run does not retry the AI call. A failed completion may still be billed; its reservation stays held.
4. **Fee receipt or settlement failure:** the vault owner must inspect the original FINAL receipts and current vault pending/budget state. A successful transfer can coexist with a failed callback. This prototype intentionally remains blocked; it has no automatic refund, journal-clear action or general repair transaction. Preserve evidence and investigate rather than repeating the fee.
5. **Paid, delivery incomplete:** restore access to the same source evidence, then use **Retry report delivery · no new fee**. Recovery verifies the saved report and source without another payment or model call. Unavailable archived receipts do not justify substituting a different transaction/report.
6. **AI draft unavailable or misleading:** use the checked report and support handoff for human review. The draft cannot establish refund, external credit or permission to pay again. Report downloads exclude AI prose; copied handoff facts are constructed independently.

For an orphaned file-lock guard, follow the inspection procedure in [API.md](API.md#preflight-and-local-locks). Do not reset the ledger, remove live locks or share private journals/signed bytes in a public bug report. These checks cover application recovery and cooperating local processes; they do not establish power-loss durability, universal provider behavior or an independent security audit.

## Historical model evidence

The two recorded evaluations used the earlier AI transport. Its exact source is retained as text in `benchmarks/recorded-sources/ai-client-v1.txt`, SHA-256 `ff4fdc64bbd7f90b020c193893ce4a4abdfff46e0405b7dbea2439500373ad98`. Replay permits only this named historical digest and explicitly announces the archived transport. Current prompts, validator, corpus and evaluation runner must still match their recorded hashes. Recorded responses and hashes were not rewritten.

Replays establish consistency of those past runs, not live evidence for the hardened transport. Current transport behavior is covered by the local HTTP tests above. Source manifests pin selected files, not the complete transitive dependency graph; include the new HTTP helper in a versioned manifest before claiming full transport provenance for a future evaluation.
