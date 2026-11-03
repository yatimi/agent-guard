<!-- Author: Tommy -->
# Evidence examples for the transaction diagnosis task

The examples below distinguish public mainnet observations, controlled Sandbox cases and historical testnet purchases. They illustrate the [paid support task](PRODUCT.md); they do not establish customer demand or time saved.

## Mainnet: successful result with a failed step

Transaction `2KhhB1uDScGCFQfVchep7DiZTGTxMcgfUYHNzwf5e6uL` returned `SuccessValue`, but `ft_on_transfer` on `v2.ref-finance.near` failed with `E51: contract paused`. The `ft_resolve_transfer` receipt on `wrap.near` returned successfully. Two reads of the public archival RPC on 2026-11-03 matched; the unchanged AgentGuard parser verified all six receipts.

**Support conclusion:** a successful overall return is not proof that the requested operation completed. Preserve the failed receipt and ask the application owner to reconcile the order and token state. This report does not establish a token refund or token balance.

[Exact fields, reproduction and limits](MAINNET-CASE.md) · [Recorded RPC evidence](mainnet-incident-evidence.json). No model or diagnostic payment was used to capture this example. The following original examples retain their earlier provenance: [original product evidence](incident-product-evidence.json).

## Transfer succeeded and callback failed

In the recorded local callback-gas test, the vault transferred **0.01 NEAR** to `merchant.test.near`. Receipt `9LEPiSGVBg9ffNWuyRjWn2F1Qmh1Zr3kCCyAYMC5g5C6` contains that native transfer and a successful execution outcome. The subsequent `settle` receipt `EHLKbPTSqnXG7qspSsNRpNaA4ScVBxLfkcoxBqFNeX6Z` failed with `Exceeded the prepaid gas.` The top-level transaction status is a failure, while the recorded vault state retains the expense and pending payment.

**Support conclusion:** The recipient received the transfer before settlement failed. Preserve the payment record and have the owner reconcile settlement. A failure badge does not authorize another payment or restoration of the spending budget.

This was a controlled local sandbox experiment using a separately hashed gas-starved artifact. It is not a customer incident or a failure observed in the production WASM. [Runtime scope](RUNTIME-QA.md).

## Callback returned successfully and transfer failed

In the recorded missing-recipient test, receipt `4qbF7tK3RdM7etDxMbfPQmc137sWMrehUFzSp5hGKa6C` failed with `AccountDoesNotExist` for `missing.test.near`. System receipt `4ubArczLanx9dw79PGrwRV5d8Dk3g7VwCvNHASQkizQ7` transferred **0.01 NEAR** back to the vault. The callback returned `false`; the recorded daily/lifetime spending returned to zero and nonce 0 remained consumed.

**Support conclusion:** This transfer did not pay the requested recipient. Check the intended address and policy with the owner before considering another request. A callback returning a value is not proof of a successful payment.

This local sandbox case used the unchanged production WASM. Receipt outcomes and the test's recorded state support the explanation; no new transaction was sent for this product check.

## Straightforward payment can stay free

A fresh read-only request for the existing browser-purchase transaction [`BeXdyg4jBTzqHtaKs3Xm5LEsxUHqZXeGqR1wRTFB8i6T`](https://testnet.nearblocks.io/txns/BeXdyg4jBTzqHtaKs3Xm5LEsxUHqZXeGqR1wRTFB8i6T) returned HTTP 200, `FINAL`, six receipts and six execution outcomes. The native transfer from `guard.yatimi.testnet` to `supplier.yatimi.testnet` succeeded for **0.01 testnet NEAR**, and the transaction returned `true`.

**Product behavior to implement:** If the user's question is simply whether this native transfer succeeded, return the confirmed result without charging for a deeper diagnostic report. This observation does not establish any exchange credit or external fulfillment.

The retrieval used no API key, signing key or model. It made no payment. Access to this one recent transaction does not establish archival availability for arbitrary older incidents.
