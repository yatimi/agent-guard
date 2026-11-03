// Author: Tommy
import { formatNear } from './vault.mjs';
import { incidentHandoff } from './incident-handoff.mjs';
const node = (tag, text) => { const e = document.createElement(tag); e.textContent = text; return e; };
export function renderIncident(container, report, summary, fee, options = {}) {
  container.append(node('h3', options.heading || (fee ? 'Your transaction diagnosis' : 'Free transaction result')), node('p', report.diagnosis));
  const handoff = incidentHandoff(report, options.provenance);
  const decision = node('section', ''); decision.className = 'incident-decision'; decision.setAttribute('aria-label', 'Payment decision');
  decision.append(node('h4', 'Should the customer pay again?'), node('strong', handoff.headline), node('p', handoff.nextCheck));
  container.append(decision);
  const explorer = report.target.network === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';
  const target = node(options.explorer === false ? 'p' : 'a', `Investigated transaction · ${options.networkLabel || report.target.network}${options.explorer === false ? ` · ${report.target.transactionHash}` : ' ↗'}`);
  if (options.explorer !== false) { target.href = `${explorer}/txns/${report.target.transactionHash}`; target.target = '_blank'; target.rel = 'noreferrer'; }
  container.append(target);
  container.append(node('p', `Observed ${new Date(report.observedAt).toLocaleString()} · FINAL · ${report.coverage.receipts} receipts checked`));
  const transfers = node('ul', '');
  for (const transfer of report.transfers.filter(t => !t.system)) transfers.append(node('li', `${formatNear(BigInt(transfer.amountYocto))} native NEAR · ${transfer.from} → ${transfer.to} · ${transfer.outcome} · Receipt ${transfer.receiptId}`));
  container.append(node('h4', 'Native transfer outcomes'), transfers.children.length ? transfers : node('p', 'No native transfer actions confirmed in this report.'));
  for (const failure of report.failures) {
    const detail = node('details', ''); detail.append(node('summary', `Failed step · ${failure.receiver} · ${failure.methods.join(', ') || 'native action'}`), node('p', `Receipt ${failure.receiptId}`), node('pre', failure.error)); container.append(detail);
  }
  container.append(node('h4', 'Next manual check'), node('p', report.nextStep));
  const response = node('details', ''); response.className = 'incident-handoff';
  response.append(node('summary', 'Support handoff · checked facts, review before sending'));
  const label = node('label', 'Support handoff text');
  const text = node('textarea', ''); text.readOnly = true; text.rows = 10; text.value = handoff.supportText;
  label.append(text); response.append(label);
  const copy = node('button', 'Copy support handoff'); copy.type = 'button'; copy.className = 'text-button';
  const copied = node('p', ''); copied.setAttribute('role', 'status'); copied.setAttribute('aria-live', 'polite');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(handoff.supportText); copied.textContent = 'Support handoff copied. Review before sending.'; }
    catch { response.open = true; text.focus(); text.select(); copied.textContent = 'Copy unavailable. The handoff text is selected; use your device’s copy command.'; }
  });
  container.append(response, copy, copied);
  if (summary) {
    const draft = node('details', ''); draft.className = 'incident-draft';
    draft.append(node('summary', 'AI support draft · review before sending'), node('p', summary)); container.append(draft);
  }
  const details = node('details', ''); details.append(node('summary', 'Scope, system transfers and source evidence'));
  for (const limitation of report.limitations) details.append(node('p', limitation));
  for (const t of report.transfers.filter(t => t.system)) details.append(node('p', `System transfer: ${formatNear(BigInt(t.amountYocto))} NEAR → ${t.to} · ${t.outcome} · ${t.receiptId}`));
  details.append(node('p', `Report SHA-256: ${report.sha256}`), node('p', `Source SHA-256: ${report.sourceSha256}`)); container.append(details);
  const download = node('button', 'Download report + evidence ↓'); download.className = 'text-button';
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...(options.provenance ? { provenance: options.provenance } : {}), report, diagnosticFee: fee || null }, null, 2)], { type: 'application/json' }));
    const a = node('a', ''); a.href = url; a.download = `agentguard-incident-${report.target.transactionHash}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }); container.append(download);
}
