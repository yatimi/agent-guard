// Author: Tommy
import { renderIncident } from './incident-result.mjs';
const node = (tag, text) => { const e = document.createElement(tag); e.textContent = text; return e; };
const status = document.querySelector('[data-demo-status]');
const description = document.querySelector('[data-demo-description]');
const source = document.querySelector('[data-demo-source]');
const result = document.querySelector('[data-demo-result]');
const choices = document.querySelector('[data-demo-cases]');
function show(item) {
  for (const button of choices.children) button.setAttribute('aria-pressed', String(button.dataset.case === item.id));
  status.textContent = item.title; description.textContent = item.explanation;
  source.replaceChildren(node('p', `Recorded ${item.provenance.network === 'local-sandbox' ? 'local NEAR Sandbox' : item.provenance.network} evidence · ${item.provenance.source}. This replay does not query the chain.`));
  result.replaceChildren();
  if (item.fee) {
    const fee = node('a', 'Recorded diagnostic fee · testnet ↗');
    fee.href = `https://testnet.nearblocks.io/txns/${item.fee.transactionHash}`; fee.target = '_blank'; fee.rel = 'noreferrer'; result.append(fee);
  }
  renderIncident(result, item.report, item.summary, item.fee, { heading: 'Recorded transaction diagnosis', provenance: item.provenance, explorer: item.provenance.network !== 'local-sandbox', networkLabel: item.provenance.network });
}
try {
  const response = await fetch('/api/demo');
  if (!response.ok) throw new Error('Recorded evidence unavailable');
  const data = await response.json();
  if (data.mode !== 'recorded' || !data.cases?.length) throw new Error('Unexpected demo response');
  for (const item of data.cases) {
    const button = node('button', item.title); button.type = 'button'; button.className = 'text-button'; button.dataset.case = item.id;
    button.addEventListener('click', () => show(item)); choices.append(button);
  }
  show(data.cases[0]);
} catch {
  status.textContent = 'Recorded evidence could not be loaded';
  description.textContent = 'Restart npm run demo from the repository root. The free security simulation below remains available.';
}
