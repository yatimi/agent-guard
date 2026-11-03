// Author: Tommy
import { formatNear } from './vault.mjs';
import { renderIncident } from './incident-result.mjs';
const panel = document.querySelector('#live-purchase');
const status = panel.querySelector('[data-live-status]');
const message = panel.querySelector('[data-live-message]');
const trace = panel.querySelector('[data-live-events]');
const result = panel.querySelector('[data-live-result]');
const invoice = panel.querySelector('[data-live-invoice]');
const technical = panel.querySelector('[data-live-technical]');
const start = panel.querySelector('[data-live-start]');
const resume = panel.querySelector('[data-live-resume]');
const scenario = panel.querySelector('[data-live-scenario]');
const check = panel.querySelector('[data-incident-check]');
const form = panel.querySelector('[data-incident-form]');
const network = panel.querySelector('[data-incident-network]');
const txHash = panel.querySelector('[data-incident-hash]');
const sender = panel.querySelector('[data-incident-sender]');
const preview = panel.querySelector('[data-incident-preview]');
let inspection = null, canInspect = false;
const target = () => ({ network: network.value, transactionHash: txHash.value.trim(), sender: sender.value.trim() });
let token, saved, timer, retryMissing = false, recoveryTarget = null;
const terminal = new Set(['completed', 'blocked', 'needs_attention', 'paid_incomplete']);
const storageKey = 'agentguard-purchase-id';
const states = {
  queued: ['Purchase saved', 'You can refresh this page. The saved purchase ID stays the same.'],
  collecting: ['Checking the report evidence', 'Confirming the selected transaction and source receipts before the diagnostic fee.'],
  planning: ['Waiting for the agent’s proposal', 'Only the approved invoice can reach signing.'],
  signing: ['Validating the payment signature', 'The recipient, amount, key and contract call must all match.'],
  pending: ['Payment outcome not confirmed', 'A transaction hash is saved. Funds and delivery are confirmed only after FINAL receipts and settlement.'],
  summarizing: ['Service payment verified · result available', 'Preparing the AI support draft. Checked execution facts are already available below.'],
  completed: ['Purchase complete', 'Reopening uses the same diagnostic fee and result.'],
  paid_incomplete: ['Diagnosis paid · delivery needs attention', 'The service payment is confirmed, but report verification is incomplete. Retry delivery without another fee.'],
  blocked: ['Stopped before payment', 'This run has no saved payment to reconcile. Review the reason before starting a new purchase.'],
  needs_attention: ['Payment needs attention', 'The outcome is unresolved. Check the saved payment; this never signs or broadcasts another transfer.'],
};
const errors = {
  INTERRUPTED_BEFORE_PAYMENT: 'The server stopped before saving or broadcasting a payment. You may explicitly start a new purchase.',
  RECIPIENT_NOT_APPROVED: 'The proposed recipient differs from the approved invoice. Signing was blocked.',
  AMOUNT_NOT_APPROVED: 'The proposed amount differs from the approved invoice. Signing was blocked.',
  VAULT_NOT_READY: 'The vault is paused, has a pending payment, or its policy differs from this setup. The owner must check it.',
  INSUFFICIENT_VAULT_BALANCE: 'The vault has too little spendable NEAR after storage and its safety reserve. The owner must fund it before a new purchase.',
  VAULT_BUDGET_EXHAUSTED: 'The vault’s spending budget is exhausted. No new payment was signed.',
  AN_EARLIER_PAYMENT_NEEDS_RECONCILIATION: 'An earlier purchase has an unresolved payment. Reopen that purchase and check its original transaction.',
  TRANSACTION_NOT_FINAL_YET: 'The transaction is not final yet. Check it again later using the same purchase.',
};
function element(tag, text) { const item = document.createElement(tag); item.textContent = text; return item; }
function link(text, url) { const item = element('a', text); item.href = url; item.target = '_blank'; item.rel = 'noreferrer'; return item; }
function buying(enabled) { canInspect = enabled; check.disabled = !enabled; for (const e of [network, txHash, sender]) e.disabled = !enabled; start.disabled = !enabled || !inspection?.eligible || Date.now() >= Date.parse(inspection.expiresAt); scenario.disabled = !enabled; }
function recover(label = 'Check saved purchase · no new transfer') { buying(false); resume.hidden = false; resume.textContent = label; }
async function request(path, body) {
  const response = await fetch(path, { signal: AbortSignal.timeout(15000), ...(body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AgentGuard-Token': token }, body: JSON.stringify(body),
  }) });
  const value = await response.json();
  if (!response.ok) { const error = new Error(value.error || `HTTP ${response.status}`); error.status = response.status; error.recovery = value.recovery; error.noPurchaseCreated = value.noPurchaseCreated; throw error; }
  return value;
}
async function session() {
  const value = await request('/api/session'); token = value.token;
  return value.recoverable || [];
}
function remember(purchase) {
  // Each tab owns a separate durable intent; the legacy key is only a pointer.
  localStorage.setItem(`${storageKey}:${purchase.id}`, JSON.stringify(purchase));
  localStorage.setItem(storageKey, JSON.stringify(purchase)); saved = purchase;
}
async function reopen(purchase) { remember(purchase); recoveryTarget = null; await poll(); }
async function recoverConflict(error) {
  if (error.noPurchaseCreated === true) {
    const rejectedId = saved.id;
    const pointer = localStorage.getItem(storageKey);
    if (pointer && JSON.parse(pointer).id === rejectedId) localStorage.removeItem(storageKey);
    saved = null; inspection = null; retryMissing = false; recoveryTarget = null;
    buying(true); resume.hidden = true; status.textContent = 'Quote unavailable · no purchase created';
    message.textContent = 'No payment was started. Run the free check again to obtain a current quote.';
    technical.textContent = `Rejected request: ${rejectedId}\nReason: ${error.message}`; return;
  }
  if (error.recovery) return reopen(error.recovery);
  if (error.status === 409) {
    const recoverable = await session();
    if (recoverable.length) return reopen(recoverable[0]);
  }
  disconnected(error);
}
function disconnected(error) {
  clearTimeout(timer);
  status.textContent = 'Connection interrupted · purchase ID preserved';
  message.textContent = 'Reconnect to check this purchase before doing anything else. A lost response does not establish whether payment occurred.';
  technical.textContent = `Purchase ID: ${saved.id}\nConnection: ${error.message}`;
  recover();
}
function render(run) {
  clearTimeout(timer); retryMissing = false; recoveryTarget = run.recovery || null;
  const [title, guidance] = states[run.state] || ['Unknown purchase state', 'Keep the purchase ID and inspect the local journal.'];
  status.textContent = run.recoveryRequired ? 'Server restarted · saved purchase needs checking' : title;
  message.textContent = run.recoveryRequired
    ? 'Continue from the saved journal. Recovery checks the original payment or safely stops a run interrupted before payment.'
    : errors[run.error] || guidance;
  inspection = null; buying(['completed', 'blocked', 'paid_incomplete'].includes(run.state));
  resume.hidden = true;
  if (recoveryTarget) recover('Open earlier purchase · no new transfer');
  else if (run.state === 'paid_incomplete') { resume.hidden = false; resume.textContent = 'Retry report delivery · no new fee'; }
  else if (run.recoveryRequired || run.state === 'needs_attention') recover();
  trace.replaceChildren(...run.events.slice(-40).map(event => element('li', `${new Date(event.at).toLocaleTimeString()} · ${event.message}`)));
  technical.textContent = `Purchase ID: ${run.id}\nUpdated: ${run.updatedAt || run.createdAt}\nState: ${run.state}${run.error ? `\nReason: ${run.error}` : ''}`;
  if (run.model?.toolCalls) technical.textContent += `\nModel proposal: ${JSON.stringify(run.model.toolCalls, null, 2)}`;
  invoice.replaceChildren();
  if (run.target) {
    const explorer = run.target.network === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';
    invoice.append(element('h3', 'Investigated transaction'), link(`${run.target.network} · ${run.target.transactionHash} ↗`, `${explorer}/txns/${run.target.transactionHash}`), element('p', `Sender: ${run.target.sender}`));
  }
  if (run.quote) {
    invoice.append(element('h3', 'Approved invoice'), element('p', `${run.quote.title} · ${formatNear(BigInt(run.quote.amountYocto))} testnet NEAR → ${run.quote.recipient}`));
  }
  if (run.vault) {
    const policy = run.vault.policy;
    invoice.append(element('p', `Policy checked ${new Date(run.vault.observedAt).toLocaleString()}: ${formatNear(BigInt(policy.per_payment))} NEAR per payment · ${formatNear(BigInt(policy.per_day))} per UTC day · ${formatNear(BigInt(policy.lifetime_budget))} lifetime. This is a saved preflight observation.`));
  }
  result.replaceChildren();
  if (run.transactionHash) result.append(link(run.taskVersion ? 'Diagnostic fee transaction · testnet ↗' : 'Historical dataset payment · testnet ↗', `https://testnet.nearblocks.io/txns/${run.transactionHash}`));
  if (run.report) renderIncident(result, run.report, run.summary, run.proof);
  if (run.dataset && run.proof) {
    result.append(element('h3', 'Your paid network snapshot'));
    const metrics = run.dataset.metrics;
    const cards = element('dl', ''); cards.className = 'live-metrics';
    for (const [label, value] of [['Finalized blocks', metrics.blocks], ['Mean block interval', `${metrics.meanBlockIntervalMs} ms`], ['Included chunks', metrics.includedChunks], ['Sampled chunk gas', `${metrics.sampledChunkGasUsedTgas} Tgas`]]) {
      const pair = element('div', ''); pair.append(element('dt', label), element('dd', String(value))); cards.append(pair);
    }
    result.append(cards, element('p', run.summary || 'Dataset unlocked. Preparing the narrative…'), element('p', `Observed ${new Date(run.dataset.observedAt).toLocaleString()}. AI interpretation is a narrative; the measurements above come from the dataset.`));
    const limitations = element('ul', '');
    for (const text of run.dataset.limitations) limitations.append(element('li', text));
    result.append(limitations, element('p', `Dataset SHA-256: ${run.dataset.sha256}`));
    const sources = element('details', ''); sources.append(element('summary', 'Inspect six source blocks'));
    const list = element('ul', '');
    for (const block of run.dataset.blocks) { const item = element('li', ''); item.append(link(`Mainnet block ${block.height} ↗`, `https://nearblocks.io/blocks/${block.hash}`)); list.append(item); }
    sources.append(list); result.append(sources);
    const download = element('button', 'Download dataset + payment proof ↓'); download.className = 'text-button';
    download.addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ quote: run.quote, dataset: run.dataset, proof: run.proof }, null, 2)], { type: 'application/json' }));
      const anchor = element('a', ''); anchor.href = url; anchor.download = `agentguard-${run.id}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    result.append(download);
  }
  if (!terminal.has(run.state) && !run.recoveryRequired) timer = setTimeout(poll, 1200);
}
async function poll() {
  try { render(await request(`/api/runs/${saved.id}`)); }
  catch (error) {
    disconnected(error);
    if (error.status === 404) {
      status.textContent = 'Saved request not found on this server';
      message.textContent = 'The request may not have reached this server. Retry reuses its original ID. If the server or journal moved, restore that journal first.';
      retryMissing = Boolean(saved.scenario);
      resume.textContent = retryMissing ? 'Retry saved request · same purchase ID' : 'Reconnect to the original server';
    }
  }
}
start.addEventListener('click', async () => {
  if (!inspection?.eligible || Date.now() >= Date.parse(inspection.expiresAt)) { message.textContent = 'Check the transaction again to obtain a current quote.'; return; }
  const selected = inspection;
  buying(false); resume.hidden = true; clearTimeout(timer);
  try {
    const recoverable = await session();
    if (recoverable.length) { await reopen(recoverable[0]); return; }
  } catch (error) {
    status.textContent = 'Cannot check existing purchases';
    message.textContent = 'Reconnect and reload before starting a purchase.'; technical.textContent = error.message; return;
  }
  try {
    const next = { id: crypto.randomUUID(), scenario: scenario.value, inspectionId: selected.id };
    // Persist BEFORE POST. If storage is unavailable, do not start a purchase.
    remember(next);
  } catch {
    status.textContent = 'Browser storage is unavailable';
    message.textContent = 'Enable local storage and reload before buying so refresh can recover the same purchase. No request was sent.'; return;
  }
  status.textContent = 'Saving purchase…'; result.replaceChildren(); invoice.replaceChildren(); trace.replaceChildren();
  try { render(await request('/api/runs', { requestId: saved.id, scenario: saved.scenario, ...(saved.inspectionId ? { inspectionId: saved.inspectionId } : {}) })); }
  catch (error) { try { await recoverConflict(error); } catch (recoveryError) { disconnected(recoveryError); } }
});
resume.addEventListener('click', async () => {
  resume.disabled = true; clearTimeout(timer); status.textContent = 'Checking the saved purchase…';
  try {
    const recoverable = await session(); // A restarted server has a new CSRF token.
    const earlier = recoveryTarget || (!recoverable.some(run => run.id === saved.id) ? recoverable[0] : null);
    if (earlier) { await reopen(earlier); return; }
    if (retryMissing) render(await request('/api/runs', { requestId: saved.id, scenario: saved.scenario, ...(saved.inspectionId ? { inspectionId: saved.inspectionId } : {}) }));
    else {
      const run = await request(`/api/runs/${saved.id}`);
      render(run.recoveryRequired || ['needs_attention', 'paid_incomplete'].includes(run.state) ? await request(`/api/runs/${saved.id}/resume`, {}) : run);
    }
  } catch (error) { if (error.noPurchaseCreated) await recoverConflict(error); else { disconnected(error); if (error.status === 404) await poll(); } }
  finally { resume.disabled = false; }
});
form.addEventListener('submit', async event => {
  event.preventDefault(); if (!canInspect) return;
  inspection = null; buying(false); resume.hidden = true; clearTimeout(timer);
  result.replaceChildren(); invoice.replaceChildren(); preview.textContent = 'Reading finalized receipts…';
  try {
    const recoverable = await session();
    if (recoverable.length) { await reopen(recoverable[0]); return; }
    const inspectedTarget = target();
    const response = await request('/api/inspections', { target: inspectedTarget });
    if (JSON.stringify(inspectedTarget) !== JSON.stringify(target())) throw new Error('INPUT_CHANGED');
    inspection = response;
    preview.textContent = `${response.preview.diagnosis} ${response.preview.receipts} receipts checked. ${response.eligible ? 'Full diagnosis: 0.01 testnet NEAR + gas and AI. Quote valid for 10 minutes.' : 'No diagnostic charge needed.'}`;
    status.textContent = response.eligible ? 'Diagnosis available · review before buying' : 'Free result · no payment or AI request';
    message.textContent = response.eligible ? 'The selected transaction is fixed in this quote. The fee pays our demo diagnostic supplier; it does not retry the investigated payment.' : 'The checked execution facts and their limits are available below.';
    if (response.report) renderIncident(result, response.report);
    buying(true);
  } catch (error) {
    status.textContent = 'Cannot produce a complete diagnosis';
    preview.textContent = 'No payment or AI request was made. Check the network, hash and sender; missing or unsupported receipts cannot be sold as a verified report.';
    technical.textContent = error.message; buying(true);
  }
});
for (const input of [network, txHash, sender]) input.addEventListener('input', () => { inspection = null; start.disabled = true; preview.textContent = 'Input changed. Check this transaction before buying.'; });
panel.querySelector('[data-incident-example]').addEventListener('click', () => {
  if (!canInspect) return;
  network.value = 'testnet'; txHash.value = 'BeXdyg4jBTzqHtaKs3Xm5LEsxUHqZXeGqR1wRTFB8i6T'; sender.value = 'yatimi.testnet';
  inspection = null; start.disabled = true; preview.textContent = 'Recorded testnet payment selected. Check reads its current RPC evidence for free.';
});
try {
  const stored = localStorage.getItem(storageKey);
  saved = stored?.startsWith('{') ? JSON.parse(stored) : stored ? { id: stored } : null;
  if (saved && (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(saved.id) || (saved.scenario && !['purchase', 'injection'].includes(saved.scenario)))) throw new Error('INVALID_SAVED_PURCHASE');
  const recoverable = await session();
  // The server journal recovers an active payment even if another tab changed
  // the last-viewed pointer or this browser lost its local purchase history.
  if (recoverable.length) remember(recoverable[0]);
  if (saved) await poll();
  else { buying(true); status.textContent = 'Ready for a free transaction check'; message.textContent = 'A simple confirmed transfer needs no paid diagnosis. Check first; buy only after reviewing the quote.'; }
} catch (error) {
  buying(false);
  status.textContent = 'Live execution unavailable';
  message.textContent = 'Use the local Node server with browser storage enabled. The separate simulation below still works.';
  technical.textContent = error.message;
  if (saved?.id && error.message !== 'INVALID_SAVED_PURCHASE') disconnected(error);
}
