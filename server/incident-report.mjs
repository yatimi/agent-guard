// Author: Tommy
import { createHash } from 'node:crypto';
const account = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const hash = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const amount = /^(0|[1-9][0-9]{0,38})$/;
const isAccount = value => typeof value === 'string' && account.test(value);
const isHash = value => typeof value === 'string' && hash.test(value);
const isAmount = value => typeof value === 'string' && amount.test(value);
export const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
export function incidentTarget(input) {
  if (!input || Object.keys(input).sort().join(',') !== 'network,sender,transactionHash' || !['mainnet', 'testnet'].includes(input.network) || typeof input.sender !== 'string' || !isAccount(input.sender) || typeof input.transactionHash !== 'string' || !isHash(input.transactionHash)) throw new Error('INVALID_INCIDENT_TARGET');
  return { network: input.network, transactionHash: input.transactionHash, sender: input.sender };
}
const incomplete = () => { throw new Error('INCOMPLETE_RECEIPT_TRACE'); };
function execution(status) {
  if (!status || Object.keys(status).length !== 1) return incomplete();
  if (Object.hasOwn(status, 'SuccessValue') && typeof status.SuccessValue === 'string') return 'succeeded';
  if (isHash(status.SuccessReceiptId)) return 'forwarded';
  if (status.Failure && typeof status.Failure === 'object') return 'failed';
  return incomplete();
}
function actions(input) {
  if (!Array.isArray(input) || !input.length || input.length > 32) return incomplete();
  return input.map(action => {
    if (!action || Object.keys(action).length !== 1) return incomplete();
    if (action.Transfer && isAmount(action.Transfer.deposit)) return { Transfer: { deposit: action.Transfer.deposit } };
    const call = action.FunctionCall;
    if (call && typeof call.method_name === 'string' && call.method_name.length <= 256 && typeof call.args === 'string' && call.args.length <= 131072 && isAmount(call.deposit) && Number.isSafeInteger(call.gas) && call.gas >= 0) {
      return { FunctionCall: { method_name: call.method_name, args: call.args, deposit: call.deposit, gas: call.gas } };
    }
    throw new Error('UNSUPPORTED_INCIDENT_ACTION');
  });
}
// Normalizes only protocol fields used by the report. Metadata/proofs and RPC
// ordering may differ between reads of the same FINAL execution.
export function normalizeIncident(input, target) {
  target = incidentTarget(target);
  const tx = input?.transaction;
  if (input?.final_execution_status !== 'FINAL') throw new Error('INCIDENT_NOT_FINAL');
  if (tx?.hash !== target.transactionHash || tx.signer_id !== target.sender || !isAccount(tx.receiver_id)) throw new Error('INCIDENT_TRANSACTION_MISMATCH');
  const txActions = actions(tx.actions), txo = input.transaction_outcome;
  if (txo?.id !== tx.hash || txo.outcome?.executor_id !== tx.signer_id || !Array.isArray(txo.outcome.receipt_ids) || txo.outcome.receipt_ids.length !== 1) return incomplete();
  execution(txo.outcome.status); execution(input.status);
  const outcomes = input.receipts_outcome, bodies = input.receipts;
  if (!Array.isArray(outcomes) || !outcomes.length || outcomes.length > 128 || !Array.isArray(bodies) || bodies.length > 128) return incomplete();
  const byId = new Map(), bodyById = new Map();
  for (const r of outcomes) {
    if (!isHash(r.id) || byId.has(r.id) || !isHash(r.block_hash) || !isAccount(r.outcome?.executor_id) || !Array.isArray(r.outcome.receipt_ids) || r.outcome.receipt_ids.length > 128 || !r.outcome.receipt_ids.every(id => isHash(id))) return incomplete();
    execution(r.outcome.status); byId.set(r.id, r);
  }
  for (const b of bodies) {
    if (!byId.has(b.receipt_id) || bodyById.has(b.receipt_id) || !isAccount(b.predecessor_id) || b.receiver_id !== byId.get(b.receipt_id).outcome.executor_id || !b.receipt?.Action) return incomplete();
    bodyById.set(b.receipt_id, b);
  }
  const firstId = txo.outcome.receipt_ids[0];
  // nearcore omits the initial receipt body for signer == receiver.
  if (!bodyById.has(firstId) && tx.signer_id === tx.receiver_id && byId.get(firstId)?.outcome.executor_id === tx.receiver_id) bodyById.set(firstId, { predecessor_id: tx.signer_id, receiver_id: tx.receiver_id, receipt: { Action: { actions: txActions } } });
  if (bodyById.size !== byId.size) return incomplete();
  const visited = new Set(), visiting = new Set();
  function walk(id) {
    if (visiting.has(id) || !byId.has(id)) return incomplete();
    if (visited.has(id)) return;
    visiting.add(id); for (const next of byId.get(id).outcome.receipt_ids) walk(next);
    visiting.delete(id); visited.add(id);
  }
  walk(firstId); if (visited.size !== byId.size) return incomplete();
  if (txo.outcome.status.SuccessReceiptId !== firstId) return incomplete();
  function returned(id, stack = new Set()) {
    if (!byId.has(id) || stack.has(id)) return incomplete();
    stack.add(id); const status = byId.get(id).outcome.status;
    return status.SuccessReceiptId ? returned(status.SuccessReceiptId, stack) : status;
  }
  for (const id of byId.keys()) returned(id);
  if (digest(returned(firstId)) !== digest(input.status)) return incomplete();
  const root = bodyById.get(firstId);
  if (root.predecessor_id !== tx.signer_id || root.receiver_id !== tx.receiver_id || digest(actions(root.receipt.Action.actions)) !== digest(txActions)) return incomplete();
  const receipts = [...byId].sort(([a], [b]) => a.localeCompare(b)).map(([id, r]) => {
    const b = bodyById.get(id);
    return { id, blockHash: r.block_hash, from: b.predecessor_id, to: b.receiver_id, actions: actions(b.receipt.Action.actions), status: r.outcome.status, children: [...r.outcome.receipt_ids].sort() };
  });
  return { target, transaction: { hash: tx.hash, sender: tx.signer_id, receiver: tx.receiver_id, actions: txActions }, status: input.status, firstReceiptId: firstId, receipts };
}
export function buildIncidentReport(source, observedAt, endpoint) {
  const failed = source.receipts.filter(r => execution(r.status) === 'failed');
  const transfers = source.receipts.flatMap(r => r.actions.filter(a => a.Transfer).map(a => ({ receiptId: r.id, from: r.from, to: r.to, amountYocto: a.Transfer.deposit, system: r.from === 'system', outcome: execution(r.status) === 'failed' ? 'failed' : 'confirmed' })));
  const failures = failed.map(r => ({ receiptId: r.id, receiver: r.to, methods: r.actions.flatMap(a => a.FunctionCall ? [a.FunctionCall.method_name] : []), error: JSON.stringify(r.status.Failure).slice(0, 1000) }));
  const returnsFalse = source.receipts.filter(r => r.status.SuccessValue === 'ZmFsc2U=').map(r => r.id);
  const paidTransfers = transfers.filter(t => !t.system && t.outcome === 'confirmed');
  // A successful/ambiguous call without a diagnosed failure is not paid work.
  const free = failures.length === 0;
  const diagnosis = failures.length && paidTransfers.length ? 'The trace includes a confirmed native transfer and a failed execution step.'
    : failures.length ? 'The trace contains failed execution steps. Inspect each transfer outcome separately.'
    : returnsFalse.length ? 'A contract call returned false. Its business meaning depends on that application.'
    : paidTransfers.length ? 'Native NEAR transfers are confirmed in the finalized trace.' : 'The execution is finalized, but this trace does not confirm a native NEAR transfer.';
  const data = { version: 'incident-v1', title: 'NEAR transaction incident report', target: source.target, observedAt, endpoint,
    sourceSha256: digest(source), coverage: { finality: 'FINAL', receipts: source.receipts.length, complete: true },
    failures, transfers, returnsFalse, diagnosis, free,
    nextStep: failures.length || returnsFalse.length ? 'Preserve this transaction and ask the application owner to reconcile its failed steps. Do not send a replacement payment or restore a budget from the overall status alone.' : 'Use the confirmed execution evidence for the support reply. External delivery and exchange credit require separate checks.',
    limitations: ['Native NEAR transfer actions only; attached deposits and token/bridge settlement are not a wallet balance reconciliation.', 'System transfers are shown separately; a system transfer is not automatically labeled a principal refund.', 'Data is checked against a configured RPC, not a light-client proof. No automatic retry or refund is authorized.'],
    source };
  return { ...data, sha256: digest(data) };
}
export function verifyIncidentReport(report, target, expectedHash) {
  if (!report || report.version !== 'incident-v1' || digest(incidentTarget(target)) !== digest(report.target)) throw new Error('INCIDENT_TARGET_MISMATCH');
  const rebuilt = buildIncidentReport(report.source, report.observedAt, report.endpoint);
  if (digest(report.source.target) !== digest(target) || rebuilt.sha256 !== report.sha256 || report.sha256 !== expectedHash || digest(report) !== digest(rebuilt)) throw new Error('INCIDENT_REPORT_MISMATCH');
}
