<!-- Author: Tommy -->
# Evidence examples for the transaction diagnosis task

Three cases checked on 2026-11-03 illustrate the selected [paid support task](PRODUCT.md). They are source-based examples for product design, not reports from an implemented diagnostic purchase. [Machine-readable evidence and fresh RPC response](incident-product-evidence.json).

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
