<!-- Author: Tommy -->
# Submission demo: one guarded support task

Draft recording script; video and X post are not yet published. Target duration 90–120 seconds is our choice, not a contest-mandated length. Record only the safe offline demo and clearly label historical evidence and simulations. Store every capture/video outside the repository. Do not expose a terminal containing `.env`, Keychain output or private journals.

## Story and shots

| Time | Screen/action | Narration |
| --- | --- | --- |
| 0–15s | AgentGuard, recorded callback-failure example | “A NEAR support engineer receives a payment error. Should the customer pay again? A failed callback alone cannot answer that.” |
| 15–40s | Confirmed transfer, failed step, next check, copy handoff | “This recorded Sandbox case confirms the transfer even though its callback failed. AgentGuard separates the receipt outcomes and prepares a source-backed handoff for review. It does not authorize a replacement payment.” |
| 40–65s | Completed testnet purchase; target and diagnostic-fee links | “The agent can buy one diagnosis within an approved quote. This is a recorded real testnet purchase: the fee and the investigated transaction have different hashes. The owner keeps the administrative key.” |
| 65–85s | Free lab: recipient injection and decision | “If a proposed payment changes the destination, the guard rejects it. This interactive view is a teaching simulation. Real key and contract enforcement is checked separately in testnet and compiled-WASM tests.” |
| 85–105s | Current evaluation summary and verification command | “In our fixed current-prompt test, all eleven malicious inputs left the invoice unchanged. Separately forced proposals were rejected. Anyone can replay the evidence and run the checks without our keys.” |
| 105–120s | Project/repository and one limitation | “One support task, a bounded payment, and evidence you can inspect. External-user time savings and willingness to pay are still being tested.” |

Do not call the lab a real model jailbreak, the Sandbox fault a production incident, or the recorded purchase a newly executed payment. Do not claim a marketplace, audited production security or validated demand. Show the handoff and real evidence before optional architecture detail.

## X draft for the project owner

> Built AgentGuard at NEAR HACKATHON: a NEAR support agent can buy a transaction diagnosis while a restricted key and vault limit its spending. Checked receipt outcomes, a support handoff, and reproducible tests without our keys. Testnet prototype. @NEARProtocol #NEARHackathon
>
> https://github.com/yatimi/agent-guard

Attach the finished video and confirm the final text before the owner publishes it. Then use the actual public post URL in the submission. No submission or contact consent is implied by this draft.

## Private pilot invitation draft

“We're testing AgentGuard, a prototype for investigating NEAR payment incidents. Could you spend 20–30 minutes on three recorded support tickets? No wallet, keys or payment needed. We want to learn whether it improves on your current tools, including when it does not help. The session is not recorded unless you agree.”

The owner chooses recipients and sends invitations. Preparation is available in [USER-VALIDATION.md](USER-VALIDATION.md); no participants have been contacted by the project scripts.
