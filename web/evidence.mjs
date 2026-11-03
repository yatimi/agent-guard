// Author: Tommy
const outcomes = {
  'Allowed supplier payment': '0.01 NEAR transferred. Budget updated and settlement completed.',
  'Prompt-injected recipient': 'A substituted address was rejected. No payment was made.',
  'Oversized payment': 'An amount above the payment limit was rejected.',
  'Replay accepted nonce': 'A previously accepted payment could not be repeated.',
  'Agent cannot administer vault': 'The network rejected an administrative call from the agent key.',
  'Agent cannot call another contract': 'The network rejected a call outside the key’s permitted contract.',
  'Owner cannot forge private callback': 'An external settlement callback was rejected by the contract.',
  'Owner emergency pause blocks agent': 'The owner paused payments; an otherwise valid request was rejected.',
};

export async function showTestnetEvidence() {
  const container = document.getElementById('testnet-evidence');
  try {
    const response = await fetch('/testnet-evidence.json', { cache: 'no-store' });
    if (!response.ok) return;
    const report = await response.json();
    if (report.mode !== 'recorded-testnet-run' || report.network !== 'testnet' || report.tests.length !== 8 || !report.tests.every((test) => test.passed)) return;
    const heading = document.createElement('h2'); heading.textContent = 'Beyond the simulation.';
    const description = document.createElement('p');
    description.textContent = `Recorded NEAR testnet run · ${report.finishedAt} · ${report.config.vault}. These results are separate from the interactive lab above. This is a saved run, not live monitoring.`;
    const grid = document.createElement('div'); grid.className = 'evidence-grid';
    for (const test of report.tests) {
      const card = document.createElement('div'); card.className = 'evidence-card';
      const label = document.createElement('span'); label.textContent = '✓ EXPECTED OUTCOME';
      const title = document.createElement('h3'); title.textContent = test.name;
      const detail = document.createElement('p'); detail.textContent = outcomes[test.name] ?? 'The recorded result matched the expected outcome.';
      card.append(label, title, detail);
      if (test.transactionHash) {
        const link = document.createElement('a'); link.href = `https://explorer.testnet.near.org/transactions/${test.transactionHash}`;
        link.textContent = 'Inspect transaction ↗'; link.target = '_blank'; link.rel = 'noreferrer'; card.append(link);
      }
      grid.append(card);
    }
    const download = document.createElement('a'); download.href = '/testnet-evidence.json'; download.download = 'testnet-evidence.json';
    download.textContent = 'Download recorded evidence & CLI output ↓';
    container.replaceChildren(heading, description, grid, download); container.hidden = false;
  } catch {
    // The local lab works independently; never substitute mock evidence for a failed load.
  }
}
