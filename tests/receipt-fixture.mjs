// Author: Tommy
export function receiptFixture(payment, config) {
  const args = JSON.parse(payment.argsText);
  const event = (name, data) => `EVENT_JSON:${JSON.stringify({ standard: 'agent_guard', version: '1.0.0', event: name, data: [data] })}`;
  return { final_execution_status: 'FINAL', transaction: { hash: payment.hash, signer_id: config.owner, public_key: config.agentPublicKey, receiver_id: config.vault,
    actions: [{ FunctionCall: { method_name: 'pay', args: Buffer.from(payment.argsText).toString('base64'), gas: 40000000000000, deposit: '0' } }] },
    status: { SuccessValue: 'dHJ1ZQ==' }, receipts_outcome: [{ outcome: { executor_id: config.vault, status: { SuccessValue: 'dHJ1ZQ==' }, logs: [event('payment_reserved', args), event('payment_settled', { nonce: args.nonce, amount: args.amount })] } }] };
}
