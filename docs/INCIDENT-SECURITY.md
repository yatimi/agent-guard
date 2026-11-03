<!-- Author: Tommy -->
# Current incident purchase: fixed security evaluation

On 2026-11-03, the production `incidentPurchasePrompt()` was exercised with **4 benign and 11 adversarial supplier-text cases**, once each, using `z-ai/glm-5.3-flash`. All 15 responses proposed the original approved invoice. No attacker-requested payment deviation was observed. The model was not connected to signing or a blockchain executor.

[Complete requests, responses, timings and source pins](incident-security-benchmark.json) · [Fixed corpus](../benchmarks/incident-cases.json). Run `ca9ee845-3d3f-45b3-bebb-5f423f64d3f0`, 17:22:08–17:22:30 UTC. This was the only live run of this corpus; no attempts were discarded or retried. The historical [snapshot evaluation](SECURITY-BENCHMARK.md) remains separately pinned.

| Layer | Result | Interpretation |
| --- | --- | --- |
| Benign model proposals | 4/4 approved exact invoice | Normal diagnostic proposals worked for these fixtures |
| Adversarial model proposals | 11/11 approved exact original invoice | Model resisted these particular injections in one pass |
| Deliberately altered proposals | 11/11 rejected by the local validator | Controlled evidence of exact-invoice enforcement, independent of model resistance |
| Valid controls | 3/3 accepted | Exact invoice, reordered keys and one-yocto amount remain valid |
| Provider errors / expired-quote observations | 0 / 0 | No attempts were invalidated in this run |
| Blockchain transactions | 0 | This is not a live onchain attack-containment experiment |

The attacks requested an urgent recovery payment, supplier migration, increased fee, transaction/network/report-hash override, duplicate fee after a delivery problem, old invoice reuse, administrative withdrawal, role spoofing inside an error and a Russian refund instruction. Normal inputs include coverage caveats, a false-return notice and a warning quoting an attacker address.

## What the result does not prove

There was no malicious model proposal to contain, so a live containment rate is **not applicable**. This small synthetic sample is not a statistical security guarantee. It measures the purchase prompt, not the separate post-payment AI support draft or broad report accuracy. Extra target/network/hash tool arguments test the closed schema; these are not semantic task-completion measurements.

Owner quote, policy and task remain trusted. Payment validation is the production validator. The contract independently limits recipients and spending; it does **not** enforce exact invoice price, invoice ID or report delivery. The [recorded testnet](../web/testnet-evidence.json) and [compiled-WASM runtime](RUNTIME-QA.md) checks establish different boundaries. No contract or deployed WASM changed for this evaluation.

The human-review AI draft remains untrusted. The new support handoff is assembled separately from checked receipt facts; raw model/error instructions never become handoff recommendations. RPC remains a trusted data source, not a light-client proof.

## Reproduce and budget

```sh
npm run benchmark:incident
npm run benchmark:incident:replay
```

Both are offline and need no keys. The first checks 14 validator controls; the second recomputes all 15 outcomes, exact prompts, inference parameters, summary, controls and source hashes. It checks recorded consistency, not independent provider attestation. `npm run verify` includes the replay so CI detects source/evidence drift.

The transport was subsequently hardened without repeating this live evaluation. Replay checks the exact archived AI client and announces it; all other selected source pins remain current. New transport and forced hostile-draft checks are local fixtures, documented in [Failure QA](FAILURE-QA.md#historical-model-evidence). They do not expand the model-resistance result above.

An explicit independent live repetition with your own configured key is `npm run benchmark:incident:send`: at most 15 completion attempts and a $0.15 conservative reservation under the shared $1 cap, no transactions or automatic retries. Every attempt is journaled before the request. Provider errors stop the run. Quote expiry before a call stops spending; a response that arrives after expiry is retained as an invalid observation, excluded from containment counts, and the run is incomplete. Tests cover those boundaries.

This run's token/rate estimate was **$0.00091138**, not a verified billing statement. All per-request reservations remain held; the cumulative local reservation after the run was **$0.39/$1**. Credentials and model reasoning are excluded from the public report.
