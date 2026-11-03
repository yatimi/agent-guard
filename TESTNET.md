<!-- Author: Tommy -->
# Testnet deployment and verification

Owner: `yatimi.testnet`. Vault: `guard.yatimi.testnet`. Supplier: `supplier.yatimi.testnet`. Deployment and testnet-key setup were explicitly authorized by the owner, with an overall limit of 4 testnet NEAR. No private keys are stored in this repository. Keys remain in macOS Keychain.

The vault was funded with 3.4 NEAR, and the supplier was created with 0.1 NEAR. Much of the vault funding is reserved by NEAR for WASM/state storage, not transferred to a third party. The agent key has a 0.1 NEAR gas allowance, which caps gas rather than creating a separate funded account. Verification made two successful 0.01 NEAR payments while the signing/finality path was being validated. Eight checks passed in the complete recorded run.

Public configuration: `testnet.json`. Recorded report: `web/testnet-evidence.json`. Signing is opt-in via `npm run test:testnet:send`. This document is not authorization for further deployments, mainnet use or additional funding.

## Account separation

1. Owner: existing `yatimi.testnet` account, retain its full-access key locally.
2. Vault: separate `guard.yatimi.testnet` account with our WASM contract. Never deploy over the owner account.
3. Supplier: `supplier.yatimi.testnet`, used to prove permitted transfers.
4. Agent: a fresh key added to the owner with function-call access only to the vault's `pay` method and a finite gas allowance. Store it locally, not in browser code.

Create and verify the new public account names before building exact deployment commands. Initialize with the real agent public key and supplier account. Deploy and call `new` atomically. The `new` receipt must be signed by the vault account itself; outside callers cannot initialize it. Its `owner` argument names the separate owner account.

Example policy units (not a payload to submit):

- Per-payment: 0.1 NEAR.
- UTC-day: 0.2 NEAR.
- Lifetime: 0.5 NEAR.
- Operating reserve: 0.05 NEAR plus storage.

Amounts in the contract API are decimal strings of yoctoNEAR, where 1 NEAR = 10^24 yoctoNEAR. Nonces are decimal strings. These smaller limits deliberately differ from the browser teaching examples.

## Evidence to collect

- Read `status`, verify owner, agent key, recipients and policy.
- Valid payment signed by the restricted key: verify the recipient's balance change and successful settlement event.
- Malicious recipient: failed transaction with `RECIPIENT_NOT_ALLOWED`; balance unchanged apart from gas on signer.
- Oversized payment, split-payment daily cap and replay: expected failures.
- Call `withdraw` and `set_paused` using agent key: protocol must deny signing/execution.
- Call a different contract and attempt a native transfer using agent key: protocol must reject.
- Fake external callback: runtime must reject private `settle`.
- Owner pause: next valid agent payment fails; owner resume restores operation.
- Transfer to a nonexistent named account: failed transfer returns principal, callback restores budget and accepted nonce remains consumed.

Save public transaction hashes, receipt outcomes, before/after state and compiler/artifact hashes. Do not save private key material or personal submission details. Update the UI only after it can label live and simulated results accurately.
