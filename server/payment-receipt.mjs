// Author: Tommy
export function verifyPaymentReceipt(result, payment, config) {
  const tx = result?.transaction;
  if (tx?.hash !== payment.hash || tx.signer_id !== config.owner || tx.public_key !== config.agentPublicKey || tx.receiver_id !== config.vault) throw new Error('RECEIPT_TRANSACTION_MISMATCH');
  const actions = tx.actions;
  const call = actions?.[0]?.FunctionCall;
  if (actions?.length !== 1 || call?.method_name !== 'pay' || call.deposit !== '0' || String(call.gas) !== '40000000000000' || Buffer.from(call.args, 'base64').toString() !== payment.argsText) throw new Error('RECEIPT_ACTION_MISMATCH');
  if (!result.status || !('SuccessValue' in result.status) || result.status.SuccessValue !== 'dHJ1ZQ==') throw new Error('PAYMENT_NOT_SETTLED');
  if (!Array.isArray(result.receipts_outcome) || result.receipts_outcome.some(receipt => receipt.outcome?.status?.Failure)) throw new Error('PAYMENT_RECEIPT_FAILED');
  const events = result.receipts_outcome.filter(receipt => receipt.outcome.executor_id === config.vault)
    .flatMap(receipt => receipt.outcome.logs ?? []).filter(log => log.startsWith('EVENT_JSON:')).map(log => JSON.parse(log.slice(11)))
    .filter(event => event.standard === 'agent_guard' && event.version === '1.0.0');
  const args = JSON.parse(payment.argsText);
  const reserved = events.find(event => event.event === 'payment_reserved')?.data?.[0];
  const settled = events.find(event => event.event === 'payment_settled')?.data?.[0];
  if (reserved?.nonce !== args.nonce || reserved.recipient !== args.recipient || reserved.amount !== args.amount || settled?.nonce !== args.nonce || settled.amount !== args.amount) throw new Error('SETTLEMENT_EVENT_MISMATCH');
  return { transactionHash: payment.hash, nonce: args.nonce, recipient: args.recipient, amountYocto: args.amount,
    verifiedAt: new Date().toISOString(), receiptCount: result.receipts_outcome.length };
}
