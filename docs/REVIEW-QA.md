<!-- Author: Tommy -->
# Reviewed recovery and budget boundaries

Verified 2026-11-03 with Node 26.3.0. Four read-only agent roles reviewed the Rust/NEAR contract, workflow/browser behavior, security boundaries and reliability. Findings were reproduced or checked against source, then fixed in a separate implementation phase and re-reviewed. This is not a professional independent security audit.

| Finding | Change | Verification |
| --- | --- | --- |
| Two reclaimers can delete a new owner's lock and enter concurrently | All acquisitions share an exclusive guard; stale ownership is re-read only under it | Deterministic child-process contention; eight workers preserve eight ledger reservations |
| Death during lock creation leaves partial metadata at the shared path | Write a unique candidate, then atomically publish complete metadata via hard link | SIGKILL during candidate write; injected write failure; no partial shared lock |
| Exhausted daily budget or liquid balance passes preflight | Check current-day allowance and storage/reserve-adjusted balance both before model work and before signing | Exhaustion at either checkpoint, zero signing on rejection, exact-capacity success |
| A second Ready tab overwrites the recovery pointer | Separate durable intent keys, journal recovery references, explicit link to the blocking purchase | Two-tab conflict and reload, lost pointer, blocked reference, storage failure |

Repeat checks without credentials or paid providers:

```sh
npm test
npm run benchmark:security:replay
```

Results: **43 tests passed**. Of the 16 new tests, six use actual child processes and temporary files for locks, five execute the actual frontend module with DOM/API fixtures, and five verify preflight boundaries. Existing HTTP/SIGKILL scenarios continue to pass. The replay verifies 15 historical model outputs and 14 deterministic validator controls against their original source hashes; it makes no new model request.

The same sixteen Chrome fixture checks in [RECOVERY-QA.md](RECOVERY-QA.md) passed again, including 320/390/768/1440 widths, text scaling and recovery. Desktop/mobile images were inspected and stored only in an OS temporary directory outside the repository.

A second review found an additional lock interleaving in the first proposed fix and a two-journal UI recovery loop. Both were corrected before application, with regression tests. The final focused source rechecks reported no further concrete defects; that is not an assurance that none exist.

## Boundaries and next evidence

- Rust code and deployed WASM are unchanged; no new runtime execution, contract audit, deployment or live payment is claimed here. Existing 20 Rust tests are a previously verified baseline.
- A crashed acquisition guard deliberately requires operator inspection. Stop all writers and preserve payment journals and budget reservations; see [the recovery procedure](API.md#preflight-and-local-locks).
- Process-kill checks do not establish machine/power-loss durability. Journal writes do not use fsync.
- Preflight is a snapshot. The contract must enforce limits if state changes before execution.
- Failed-transfer callbacks and concurrent calls through the actual NEAR runtime remain next. Comprehensive UI/UX, accessibility and usefulness review remain separate work.
- No paid model call, signing or blockchain transaction occurred in this review/fix phase. No dependency was added.
