// Author: Tommy
const panel = document.querySelector('#live-purchase');
const status = panel.querySelector('[data-live-status]');
const trace = panel.querySelector('[data-live-events]');
const result = panel.querySelector('[data-live-result]');
const start = panel.querySelector('[data-live-start]');
const resume = panel.querySelector('[data-live-resume]');
const scenario = panel.querySelector('select');
let token, runId, timer;
const terminal = new Set(['completed', 'blocked', 'needs_attention']);
const storageKey = 'agentguard-purchase-id';
function remember(id) { try { localStorage.setItem(storageKey, id); } catch {} }
function element(tag, text) { const item = document.createElement(tag); item.textContent = text; return item; }
function link(text, url) { const item = element('a', text); item.href = url; item.target = '_blank'; item.rel = 'noreferrer'; return item; }
async function request(path, body) {
  const response = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AgentGuard-Token': token }, body: JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
  return value;
}
function render(run) {
  status.textContent = run.error ? `${run.state}: ${run.error}` : run.state.replaceAll('_', ' ');
  start.disabled = !terminal.has(run.state) || run.state === 'needs_attention';
  scenario.disabled = start.disabled;
  resume.hidden = run.state !== 'needs_attention';
  trace.replaceChildren(...run.events.map(event => element('li', event.message)));
  result.replaceChildren();
  if (run.transactionHash) result.append(link('Inspect testnet transaction ↗', `https://testnet.nearblocks.io/txns/${run.transactionHash}`));
  if (run.dataset && run.proof) {
    result.append(element('h3', 'Your paid network snapshot'), element('p', run.summary || 'Dataset unlocked. Preparing the narrative…'));
    const metrics = run.dataset.metrics;
    const cards = element('dl', ''); cards.className = 'live-metrics';
    for (const [label, value] of [['Finalized blocks', metrics.blocks], ['Mean block interval', `${metrics.meanBlockIntervalMs} ms`], ['Included chunks', metrics.includedChunks], ['Sampled chunk gas', `${metrics.sampledChunkGasUsedTgas} Tgas`]]) {
      const pair = element('div', ''); pair.append(element('dt', label), element('dd', String(value))); cards.append(pair);
    }
    result.append(cards, element('p', `Observed ${new Date(run.dataset.observedAt).toLocaleString()}. AI interpretation is a narrative; the measurements above come from the dataset.`));
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
  clearTimeout(timer);
  if (!terminal.has(run.state)) timer = setTimeout(poll, 1200);
}
async function poll() {
  try { render(await request(`/api/runs/${runId}`)); }
  catch (error) { status.textContent = `${error.message}. Reload to reconnect; this does not create another purchase.`; }
}
start.addEventListener('click', async () => {
  start.disabled = true; scenario.disabled = true; resume.hidden = true; result.replaceChildren();
  try {
    runId = crypto.randomUUID(); remember(runId);
    render(await request('/api/runs', { requestId: runId, scenario: scenario.value }));
  } catch (error) { status.textContent = error.message; start.disabled = false; scenario.disabled = false; }
});
resume.addEventListener('click', async () => {
  resume.disabled = true; status.textContent = 'Checking the saved transaction hash…';
  try { render(await request(`/api/runs/${runId}/resume`, {})); }
  catch (error) { status.textContent = error.message; }
  finally { resume.disabled = false; }
});
try {
  const session = await request('/api/session'); token = session.token;
  start.disabled = false; status.textContent = 'Ready · 0.01 testnet NEAR per dataset';
  try { runId = localStorage.getItem(storageKey); } catch {}
  if (runId) await poll();
} catch { status.textContent = 'Live execution requires the local Node server. The browser lab below still works.'; }
