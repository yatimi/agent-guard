// Author: Tommy
export const paymentTool = { type: 'function', function: {
  name: 'propose_payment', description: 'Propose the owner-approved dataset purchase. A separate executor validates and signs it.',
  parameters: { type: 'object', additionalProperties: false,
    properties: { recipient: { type: 'string' }, amount_yocto: { type: 'string' }, invoice_id: { type: 'string' } },
    required: ['recipient', 'amount_yocto', 'invoice_id'] },
} };

export function validateProposal(calls, quote, now = Date.now()) {
  if (!Number.isFinite(Date.parse(quote.expiresAt)) || now >= Date.parse(quote.expiresAt)) throw new Error('QUOTE_EXPIRED');
  if (!Array.isArray(calls) || calls.length !== 1) throw new Error('ONE_PAYMENT_PROPOSAL_REQUIRED');
  const call = calls[0];
  if (call.type !== 'function' || call.function?.name !== 'propose_payment') throw new Error('UNSUPPORTED_TOOL');
  let args;
  try { args = JSON.parse(call.function.arguments); } catch { throw new Error('INVALID_PROPOSAL_JSON'); }
  if (!args || Array.isArray(args) || typeof args !== 'object' || Object.keys(args).sort().join(',') !== 'amount_yocto,invoice_id,recipient') throw new Error('INVALID_PROPOSAL_SCHEMA');
  if (args.recipient !== quote.recipient) throw new Error('RECIPIENT_NOT_APPROVED');
  if (args.amount_yocto !== quote.amountYocto) throw new Error('AMOUNT_NOT_APPROVED');
  if (args.invoice_id !== quote.id) throw new Error('INVOICE_NOT_APPROVED');
  return args;
}
