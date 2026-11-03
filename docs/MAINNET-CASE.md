<!-- Author: Tommy -->
# A successful result with a failed execution step

A support engineer receives the transaction hash and must decide what to tell a customer whose operation did not complete. AgentGuard exposes the distinction between the overall return and each receipt outcome, then provides a conservative handoff for human review.

This is a **real recorded mainnet transaction**, discovered in [FastNEAR's transaction examples](https://docs.fastnear.com/tx/examples). We fetched the complete FINAL trace twice from `https://archival-rpc.mainnet.near.org` on 2026-11-03. Both result objects and normalized source hashes matched. [Public explorer](https://nearblocks.io/txns/2KhhB1uDScGCFQfVchep7DiZTGTxMcgfUYHNzwf5e6uL) · [Bundled raw result and capture metadata](mainnet-incident-evidence.json).

## Source evidence and support meaning

| Source field | Observed value | What AgentGuard can establish |
| --- | --- | --- |
| `result.status` | `{"SuccessValue":"IjAi"}`; return bytes decode to the JSON string `"0"` | The final return succeeded. Its application meaning is not inferred from the encoding |
| Receipt `CxvDaRanH6cWxAvBAdFC1APYUcFdT5tehf4jgMpeqNii` | `ft_on_transfer` on `v2.ref-finance.near`; `E51: contract paused` | A nested execution step failed despite the successful overall return |
| Receipt `9sLHQpaGz3NnMNMn8zGrDUSyktR1q6ts2otr9mHkfD1w` | `ft_resolve_transfer` on `wrap.near`; `SuccessValue` | The resolver executed successfully; this report does not reconcile token balances or assert a refund |
| Native `Transfer` actions | Three system-origin transfers; no non-system native transfer | These are not presented as customer payment delivery or proof of a principal refund |
| Coverage | FINAL; six receipt bodies and six outcomes | The unchanged parser verified identity, coverage, creation graph and returned-status consistency |

Suggested support conclusion: **“A nested step failed because the receiving contract was paused. The overall return does not establish that the requested operation completed. Preserve the transaction and failed receipt, and ask the application owner to reconcile the order and token state before deciding whether to retry.”**

## How this compares with using an explorer or RPC

The underlying evidence is public. An explorer or a developer's script can expose the same facts; we have not established that those tools omit them or that AgentGuard is faster. Our output packages the execution checks, explicit scope, copyable support handoff and source evidence into one result. In the paid agent workflow, it also binds one quote and recovers the original diagnostic payment.

The new screen places the overall result beside the failed-receipt count. **Compare with source receipt fields** shows each non-system execution receipt and its exact ID. The table is ordered by ID, not a timeline. The handoff remains separate from AI prose. Nothing here establishes willingness to pay; the 0.01 testnet NEAR quote is a demonstration fee.

## Reproduce

```sh
npm run verify
npm run demo
```

Choose **Mainnet: successful result, failed step** at `http://127.0.0.1:4174`. Default replay needs no key or network. Downloaded evidence retains the mainnet recording label and source hash. No mainnet fee, inference call or new transaction was sent to obtain this record.

For an explicit public archival read, send `EXPERIMENTAL_tx_status` with the `params` stored in the evidence JSON to its recorded endpoint. The default `inspect:transaction` command uses a different free RPC; it timed out after 15 seconds for this historical target during collection. We did not change production endpoints or silently substitute fabricated data. Archive availability is not guaranteed.

Replay recomputes the bundled canonical result hash and normalized source hash `b61a2f8d3a7f7eb6a69e5027b5280e4295177af05cfb5d77910a95cb3cdb9928`. Capture times and two reads are local observations of one RPC provider, not independent cryptographic attestations. This is an execution-failure example involving token-contract calls; the stronger **native transfer confirmed / callback failed** example remains a separately labeled Sandbox fault case.
