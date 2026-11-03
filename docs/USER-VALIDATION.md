<!-- Author: Tommy -->
# Does AgentGuard help a support engineer?

Status: protocol and materials prepared; **no external participants or results yet**. This is a formative usability pilot. It does not establish willingness to pay, market demand or a percentage speed improvement.

## Hypothesis and scope

A developer who also handles NEAR payment support can reach a correct, sourced explanation with less effort using the checked incident report and support handoff. The owner can delegate the diagnostic purchase while retaining control of its recipient and fee. The report must distinguish native transfers from callback status, system transfers from a proven principal refund, and the diagnostic fee from the investigated transaction.

The paid supplier remains our own demonstration service using public RPC data. A skilled engineer who prefers free RPC/explorer tools is a valid non-customer. Record that outcome instead of changing the scoring afterward.

## Prepare a 20–30 minute session

Recruit three actual NEAR developers or support engineers, with permission. Do not send invitations on the user's behalf. No wallet, API key, private ticket or real customer data is needed. Use anonymous IDs; keep notes outside the repository. Do not record audio/video without agreement.

```sh
npm run study:prepare
npm run demo
```

The first command creates three ticket cards, corresponding source traces, a facilitator-only answer key and an **empty** results template in an OS temporary folder. It reads only public recordings. A and B are actual local Sandbox executions; C is the recorded testnet target of a paid diagnostic purchase. A uses the documented callback-gas fault artifact. None is an unlabeled live customer incident.

For the source condition, give the participant the ticket and its JSON trace plus the [NEAR cross-contract](https://docs.near.org/smart-contracts/anatomy/crosscontract) and [transaction RPC](https://docs.near.org/api/rpc/transactions) documentation. Let them use their usual editor. For the AgentGuard condition, open the corresponding case in the offline demo and give the same ticket. Do not reveal the facilitator answer key.

This comparison is against inspection of the same recorded trace, **not a production explorer speed benchmark**. Sandbox hashes cannot be opened on public explorers. A later field trial should use the participant's normal workflow and appropriately shareable real incidents.

## Session order

Ask about their role, last relevant incident, current tools and incident frequency before demonstrating the product. Use this assignment to avoid showing one person the same solution twice:

| Participant | First task | Second task | Third task |
| --- | --- | --- | --- |
| P1 | A: source | B: AgentGuard | C: source |
| P2 | B: source | C: AgentGuard | A: AgentGuard |
| P3 | C: source | A: AgentGuard | B: AgentGuard |

For every task: start timing when the material is visible, ask the participant to think aloud, and stop when they give their answer or after five minutes. Record timeouts as such; do not omit them. Do not coach; note any assistance. Ask them to state:

1. Which native transfers are confirmed or failed, with amounts and receipt references?
2. Which execution step failed, and what does the overall status fail to establish?
3. What would they tell the customer, and what must be checked before any retry or refund?

After the AgentGuard tasks, ask them to find the original evidence and copy the support handoff. Check whether they confuse the diagnostic fee with the investigated transaction. Note unclear terms and any expectation the product does not meet.

## Predeclared scoring and decision

Score each task separately: correct native-transfer findings, correct failed-step reference, and a next check that does not assume refund/retry authorization. An incorrect money conclusion is a safety failure regardless of speed. A correct answer with no evidence reference is incomplete. Preserve incorrect answers and timeouts.

Compare time and accuracy **by case**, with raw observations, since the cases differ in difficulty. The pilot is too small and uneven for a credible percentage speed claim. Do not turn the earlier provisional 30% target into a result.

- Fix every product-induced unsafe conclusion before recording the submission demo.
- If at least two participants independently identify a recurring job and choose to reuse the report for a concrete reason, proceed with that narrow value claim and attribute it to the pilot.
- If they can answer equally well with their existing tools and do not want the handoff, reconsider the paid report's value. Do not add unrelated features to hide the result.

After tasks, ask: “What would you use next time, and why?”, “What would stop you using this?”, “Who would pay, if anyone?”, and “What would need to improve before it was worth paying for?” Reveal that 0.01 testnet NEAR is a demonstration price. Hypothetical interest, willingness to try, and actual payment are different observations.

## What can be claimed today

Implemented and tested: deterministic native-transfer interpretation, source references, a support handoff independent of model prose, restricted diagnostic payment, recovery and offline judge reproduction. Not yet established: time saved for external users, recurring demand, a commercial price or an independent supplier business.
