<!-- Author: Tommy -->
# Submission demo: one guarded support task

Draft recording script; video and X post are not yet published. Target duration 90–120 seconds is our choice, not a contest-mandated length. Record only the safe offline demo and clearly label historical evidence and simulations. Store every capture/video outside the repository. Do not expose a terminal containing `.env`, Keychain output or private journals.

## Story and shots

| Time | Screen/action | Narration |
| --- | --- | --- |
| 0–15s | Default recorded mainnet case: overall return + failed count | “A customer asks whether to pay again. This real NEAR transaction returned successfully, but one execution step failed.” |
| 15–35s | Expand source comparison; show failed call and resolver; support handoff | “The receiving contract was paused. The resolver ran. AgentGuard makes these receipt outcomes explicit and prepares a handoff, without claiming a token refund.” |
| 35–50s | Recorded Sandbox callback-failure case | “The reverse can happen too: this labeled fault test confirms a native transfer before the callback fails. An overall error alone cannot authorize another payment.” |
| 50–75s | Completed testnet purchase; separate target and diagnostic-fee links | “The support agent can buy one diagnosis. The exact invoice is checked locally; the restricted key and vault constrain its payment. This is a recorded real testnet purchase.” |
| 75–95s | Recipient-injection lab; separate testnet enforcement evidence | “This simulation rejects a changed destination. The repository separately includes real key/contract checks and compiled-WASM failure tests. We do not claim the model was compromised.” |
| 95–110s | Verification command and recovery evidence link | “Judges can replay every example without our keys. Interrupted purchases reconcile the original fee; they do not create another one.” |
| 110–120s | Repository and scope | “One support task, bounded agent spending, and inspectable evidence. Testnet prototype; external-user time savings and willingness to pay remain unvalidated.” |

Do not call the lab a real model jailbreak, the Sandbox fault a production incident, or the recorded purchase a newly executed payment. Do not claim a marketplace, audited production security or validated demand. Show the handoff and real evidence before optional architecture detail.

## X draft for the project owner

> Built AgentGuard at NEAR HACKATHON: a NEAR support agent can buy a transaction diagnosis while a restricted key and vault limit its spending. Checked receipt outcomes, a support handoff, and reproducible tests without our keys. Testnet prototype. @NEARProtocol #NEARHackathon
>
> https://github.com/yatimi/agent-guard

Attach the finished video and confirm the final text before the owner publishes it. Then use the actual public post URL in the submission. No submission or contact consent is implied by this draft.

## Private pilot invitation draft

“We're testing AgentGuard, a prototype for investigating NEAR payment incidents. Could you spend 20–30 minutes on three recorded support tickets? No wallet, keys or payment needed. We want to learn whether it improves on your current tools, including when it does not help. The session is not recorded unless you agree.”

External testing is optional and does not block submission. If the owner chooses to recruit, the owner selects recipients and sends invitations. Preparation is available in [USER-VALIDATION.md](USER-VALIDATION.md); no participants have been contacted by the project scripts.
