<!-- Author: Tommy -->
# Transaction diagnosis: implementation and quality evidence

Verified 2026-11-03. The primary paid workflow now diagnoses one NEAR transaction. It retains the restricted-key payment vault and historical snapshot journals. No production Rust, Cargo dependency, signer or WASM change was required.

## What actually ran

| Layer | Result | Evidence / command |
| --- | --- | --- |
| Node and browser-logic tests | 73 passed, 0 failed | `npm test`; includes real child-process HTTP/SIGKILL checks with fake providers |
| Chrome UI fixtures | 26 passed | `node scripts/check-browser.mjs` against a dedicated Chrome debugging port 9229; [machine-readable scope](incident-qa.json) |
| Real HTTP RPC stand-in | FINAL report and re-read, missing receipt, 429, timeout, oversized response passed | `node scripts/test-incident-http.mjs`; [Postman setup](API.md#zero-credit-incident-rpc-check) |
| Historical security replay | 15 recorded responses and 14 deterministic controls passed | `npm run benchmark:security:replay`; original prompt/source pins unchanged |
| Actual browser purchase | Completed, source reverified; refresh/reopen/resume retained the original fee and report | [Full public run](live-incident-purchase.json) |
| Production contract | Unchanged local artifact; matching deployed code checked in live preflight | SHA-256 `976f990b5f8a1a6e39de6e742cea4cadb515c5e6de17169a4f4325fd184d345e` |

The 20 Rust unit tests and five local WASM runtime cases are earlier verified baselines, not rerun or relabeled as new tests here. Existing runtime receipts are inputs to diagnostic regressions; see [runtime scope](RUNTIME-QA.md).

## Live result and cost

The investigated target was an existing rejected testnet call:
`BHBBWqBXhp2VVhDhyPQWT2ufxPPDvBN5AfjjDZQVBAhp`, sender `yatimi.testnet`.
The delivered report identifies the `pay` receipt failure `RECIPIENT_NOT_ALLOWED`, shows system transfers separately and confirms no ordinary native Transfer action in that trace. It does not call a system transfer a principal refund.

A separate diagnostic fee settled in transaction [5jSdKFt2QDH3kmqrXAfxNPzP14Aeop3tLQ1xTQvVJkNQ](https://testnet.nearblocks.io/txns/5jSdKFt2QDH3kmqrXAfxNPzP14Aeop3tLQ1xTQvVJkNQ), purchase `3931955b-9d6c-40bc-8324-567988dc91fd`. The browser saved the intent, refreshed before completion, received the verified report and reopened it. Explicit completed-run resume returned the same proof. The supplier balance increased by exactly **0.01 testnet NEAR**, with one vault nonce consumed. Owner gas spending was approximately 0.000435795 NEAR; its balance remained above the authorized floor. No mainnet transaction occurred.

Exactly two live AI calls ran: invoice proposal and support draft. Shared conservative reservation moved from $0.22 to **$0.24 of $1**. Combined token-derived estimate is $0.00026796; neither value is independently verified provider billing. Free successful inspection made no model request. There was no paid retry or discarded alternative live purchase.

The live model draft exceeded the requested 100 words. Its full original output is retained, labeled human review and never used as a payment or execution authority. A subsequent presentation-only fix puts it in a disclosure and preserves paragraph breaks; that final UI passed the 26 fixture checks. Live evidence hashes identify the earlier rendering source used during the paid run, while `incident-qa.json` identifies the final tested UI. No extra model request was made for editorial polish.

## Correctness and recovery cases

Recorded local sandbox inputs exercise the opposite misleading top-level outcomes: a confirmed native transfer with a failed callback, and a failed transfer followed by a successful callback returning false. The tests also cover locally successful Transfer actions in an execution outcome that forwards another receipt. Reports do not invent receipt chronology or reverse a transfer because of an independent failure.

Malformed, missing, duplicated, disconnected or cyclic receipt data is rejected. Forwarded return chains must terminate and match the overall status. Numeric coercion of identifiers or yocto amounts is rejected. Unsupported actions and successful token-only calls cannot become paid diagnostic work. The report states its attached-deposit/token/bridge limits.

Task/target/hash changes, stale quote, duplicate inspection with another request ID, injected recipient changes and unavailable sources cannot silently create a new fee. Fee proof is saved before delivery; paid-but-incomplete survives a session restart and retries source verification without signing or additional AI use. Tests cover a crash in the proof-saved/delivery-unverified window. HTTP tests kill real processes with fake payment/model providers; they are not live-chain process-kill experiments.

## Review and UI scope

Four read-only agent roles reviewed incident correctness/NEAR semantics, security, reliability and UI recovery. Confirmed findings were fixed and re-reviewed: coercible UUIDs/amounts, quote reuse, forwarded transfer interpretation, unsupported non-failure billing, expired-admission recovery loops, missing target/recovery inspection identity and paid-delivery crash handling. This is agent-assisted source review, not an independent professional audit.

Chrome 156.0.8078.80 checks cover quote gating, lost responses, saved IDs, restart recovery, separate target/fee identity, paid-incomplete recovery, legacy journal display, free/incomplete results, literal model text, 320/390/768/1440px reflow, root-font and text-spacing overrides, keyboard focus, reduced motion and draft disclosure. The ready screen's 130 measured opaque-text samples passed their AA contrast thresholds. Desktop/mobile screenshots were inspected and stored only in OS temporary directories outside the repository.

This is not a full accessibility certification: actual screen-reader operation, real text-only 200% scaling, exhaustive focus/target checks and broad browser coverage remain open. Mainnet diagnosis shares the collector but this milestone's fresh public and paid observations were testnet. Arbitrary archive availability is not guaranteed. RPC and local supplier/journal remain trusted.

The current incident prompt has one normal live purchase observation and deterministic malicious-proposal tests. The prior 15-response model benchmark belongs to its original snapshot prompt; it is not a new-prompt attack-resistance score. Three real-user usefulness sessions, commercial demand, clean-checkout CI and the final judge demo remain separate next steps.
