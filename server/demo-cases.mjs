// Author: Tommy
// Recorded public evidence only. No RPC, model, wallet or local journal imports.
import { readFile } from 'node:fs/promises';
import { buildIncidentReport, normalizeIncident, verifyIncidentReport, digest } from './incident-report.mjs';
const read = async path => JSON.parse(await readFile(new URL(`../docs/${path}`, import.meta.url), 'utf8'));
export async function demoCases() {
  const runtime = await read('runtime-verification.json');
  const cases = [
    ['callback-gas-fault', 'Transfer confirmed, callback failed', 'A deliberately gas-starved callback in a separately identified WASM fixture. The native transfer remains confirmed.'],
    ['failed-transfer', 'Transfer failed, callback returned false', 'A failed native transfer in local NEAR Sandbox. A successful callback does not make the transfer successful.'],
  ].map(([id, title, explanation]) => {
    const saved = runtime.cases.find(item => item.case === id);
    if (!saved?.passed) throw new Error(`Missing passed runtime case: ${id}`);
    const raw = saved.evidence.finalRpcReceipt;
    const target = { network: 'testnet', transactionHash: raw.transaction.hash, sender: raw.transaction.signer_id };
    const report = buildIncidentReport(normalizeIncident(raw, target), runtime.manifest.finishedAt, 'recorded-local-sandbox');
    return { id, title, explanation, provenance: { mode: 'recorded', network: 'local-sandbox', source: 'docs/runtime-verification.json', wasmSha256: saved.wasmSha256 }, report };
  });
  const live = await read('live-incident-purchase.json');
  const run = live.run;
  verifyIncidentReport(run.report, run.target, run.quote.reportSha256);
  if (run.state !== 'completed' || !run.deliveryVerified || run.proof?.transactionHash !== run.transactionHash || run.proof.amountYocto !== run.quote.amountYocto || run.proof.recipient !== run.quote.recipient) throw new Error('Recorded purchase evidence is inconsistent');
  cases.push({ id: 'paid-testnet', title: 'Completed testnet purchase', explanation: 'A recorded real purchase: an agent paid for diagnosis of a rejected transaction and received this report. Replaying it makes no new payment or AI request.',
    provenance: { mode: 'recorded', network: 'testnet', source: 'docs/live-incident-purchase.json', recordedAt: live.verifiedAt }, report: run.report, summary: run.summary, fee: run.proof });
  const mainnet = await read('mainnet-incident-evidence.json');
  const normalized = normalizeIncident(mainnet.result, mainnet.target);
  if (mainnet.mode !== 'recorded-public-mainnet-read' || mainnet.target.network !== 'mainnet'
    || mainnet.observations.length !== 2 || !mainnet.observations.every(item => item.normalizedSourceSha256 === digest(normalized) && item.resultSha256 === digest(mainnet.result))) throw new Error('Recorded mainnet evidence is inconsistent');
  cases.unshift({ id: 'mainnet-nested-failure', title: 'Mainnet: successful result, failed step',
    explanation: 'A real mainnet transaction returned successfully, but ft_on_transfer failed because the receiving contract was paused. The resolver ran afterward. This execution report does not establish a token refund or token balance.',
    provenance: { mode: 'recorded', network: 'mainnet', source: 'docs/mainnet-incident-evidence.json', recordedAt: mainnet.observations[0].observedAt },
    report: buildIncidentReport(normalized, mainnet.observations[0].observedAt, mainnet.endpoint) });
  return { mode: 'recorded', newTransactions: 0, newModelCalls: 0, cases };
}
