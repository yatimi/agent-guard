<!-- Author: Tommy -->
# Local executor API

The Node server listens only on `127.0.0.1:4173`. This API executes the owner's local testnet setup. It must not be exposed on a public host. Browser source contains no model or signing key. Model and RPC endpoints are fixed in server composition; requests cannot choose an endpoint, account, amount, or method.

## Requests

| Method and path | Input | Result |
| --- | --- | --- |
| `GET /api/session` | None | Local CSRF token, public account configuration, testnet price |
| `POST /api/runs` | `requestId`: UUID v4; `scenario`: `purchase` or `injection` | 202 and saved run; existing ID returns its original run |
| `GET /api/runs/{id}` | UUID v4 | Saved run, public trace, transaction hash; paid dataset after receipt/hash verification |
| `POST /api/runs/{id}/resume` | Empty JSON object | Read the saved transaction's final status; never sign or broadcast a new payment |

POST requires exact `Origin: http://127.0.0.1:4173`, `Host: 127.0.0.1:4173`, `Content-Type: application/json` and `X-AgentGuard-Token` from the session. Request bodies are limited to 4096 bytes. There is no remote CORS permission. Errors return JSON `{ "error": "CODE_OR_MESSAGE" }` with 400, 403, 409 or 413; a missing run returns 404.

## Lifecycle and recovery

`queued → collecting → planning → signing → pending → summarizing → completed`.

`blocked` means this workflow has no saved payment to reconcile. A changed recipient, amount, expired invoice or unsupported model tool is rejected before signing. A new attempt is an explicit new purchase, with a new UUID.

`needs_attention` means a signed payment exists and proof is unresolved. Keep its ID and inspect/reconcile its saved hash. New purchases are blocked while any earlier payment remains unresolved. A timeout does not establish failure. Unknown or definitively failed chain outcomes remain blocked for operator inspection; this version has no automatic cancellation, refund or rebroadcast feature.

The exact signed bytes and transaction hash are written locally before broadcast. The public API omits them. Settlement requires a FINAL transaction, matching signer/key/receiver/action, successful receipt outcomes, and matching `payment_reserved` and `payment_settled` events. The dataset must match the quote's SHA-256. Summary failure preserves the paid dataset and uses a clear fallback; payment is never repeated for a narrative.

The supplier, quote binding and local journal are trusted prototype components. The invoice ID and dataset hash are not committed into the contract payment itself. This is not an onchain proof of delivery or an independent marketplace.

## Zero-credit HTTP failure check

Postman CLI 1.73.0 was used locally, without login or publication. No authenticated owner workspace was available, so the stand-in was built from the observed catalog/response shape rather than fetched from a team's shared mock. It models only two paths; other operations return 501.

```sh
# Terminal 1; replace the executable path if Postman is on your PATH.
/Users/tommy/.local/bin/postman simulation run postman/simulations/ai-failure.sim.yaml --port 4010 --no-history --output ndjson

# Terminal 2; uses a dummy key and temporary budget directory.
node scripts/test-ai-failure.mjs
```

The real `AiClient` reads the mock model catalog, receives HTTP 429 on its completion request, does not retry, and retains one conservative reservation. The request log was inspected: one GET 200 and one POST 429. These results establish local caller behavior, not the live provider's exact failure timing or billing rules.
