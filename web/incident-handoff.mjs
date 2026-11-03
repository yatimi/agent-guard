// Author: Tommy
import { formatNear } from './vault.mjs';

// Presentation derived only from checked report fields, never the AI narrative.
// This does not infer wallet balances, application fulfillment or permission to retry.
export function incidentHandoff(report, provenance = null) {
  const transfers = report.transfers.filter(item => !item.system);
  const confirmed = transfers.filter(item => item.outcome === 'confirmed' && BigInt(item.amountYocto) > 0n);
  const failed = transfers.filter(item => item.outcome === 'failed');
  const headline = confirmed.length ? 'A native transfer is confirmed. Avoid a duplicate payment.'
    : failed.length ? 'A native transfer failed. Reconcile before retrying.'
    : 'Native payment delivery is not established by this report.';
  const nextCheck = confirmed.length
    ? 'Ask the application owner to match the confirmed transfer receipts to the order and reconcile any failed steps before considering another payment.'
    : 'Ask the application owner to reconcile the order, failed steps and any attached deposits or token transfers before deciding whether to retry.';
  const scope = 'This report covers native NEAR Transfer actions. It does not establish the complete wallet balance, token delivery or order fulfillment. System transfers alone do not prove a principal refund.';
  const label = provenance?.network === 'local-sandbox' ? 'local NEAR Sandbox (recorded example, not a public-chain transaction)' : report.target.network;
  const lines = [
    `${provenance?.mode === 'recorded' ? 'Recorded evidence — ' : ''}${label} transaction ${report.target.transactionHash}`,
    `Sender: ${report.target.sender}. Observed: ${report.observedAt}.`,
    headline,
    ...transfers.map(item => `${formatNear(BigInt(item.amountYocto))} native NEAR: ${item.from} → ${item.to}; ${item.outcome}. Receipt: ${item.receiptId}.`),
    ...report.failures.map(item => `Failed execution at ${item.receiver}. Receipt: ${item.receiptId}.`),
    ...(report.returnsFalse.length ? ['A contract returned false; its application meaning requires an owner check.'] : []),
    nextCheck,
    'No replacement payment or refund is authorized by this report.',
    scope,
    `Report SHA-256: ${report.sha256}`,
  ];
  return { headline, nextCheck, scope, supportText: lines.join('\n\n') };
}
