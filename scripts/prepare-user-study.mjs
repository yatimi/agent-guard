// Author: Tommy
// Disposable study material from public recordings. No network or credentials.
import { mkdtemp, mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoCases } from '../server/demo-cases.mjs';
import { incidentHandoff } from '../web/incident-handoff.mjs';
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const temporaryRoot = await realpath(tmpdir());
if (temporaryRoot === root || temporaryRoot.startsWith(root + sep)) throw new Error('Study artifacts must be outside the repository.');
const output = await mkdtemp(join(temporaryRoot, 'agentguard-user-study-'));
for (const dir of ['sources', 'facilitator']) await mkdir(join(output, dir));
const runtime = JSON.parse(await readFile(new URL('../docs/runtime-verification.json', import.meta.url)));
const live = JSON.parse(await readFile(new URL('../docs/live-incident-purchase.json', import.meta.url)));
const { cases } = await demoCases();
const tickets = [
  'The application showed a payment error. Did native NEAR move, and what should support check before the customer tries again?',
  'The final result contains a successful callback returning false. Was the native transfer successful? Can support promise a refund or retry?',
  'The attempted operation was rejected. Which step failed? Does this trace establish the customer’s full wallet balance or authorize another payment?',
];
const answers = [], rows = [];
for (const [index, item] of cases.entries()) {
  const id = ['A', 'B', 'C'][index];
  const raw = item.id === 'paid-testnet' ? live.run.report.source : runtime.cases.find(c => c.case === item.id).evidence.finalRpcReceipt;
  await writeFile(join(output, 'sources', `${id}.json`), JSON.stringify({ provenance: item.provenance, format: item.id === 'paid-testnet' ? 'normalized RPC trace' : 'recorded RPC response', trace: raw }, null, 2) + '\n');
  answers.push({ id, ticket: tickets[index], demoCase: item.id, provenance: item.provenance,
    failures: item.report.failures, nativeTransfers: item.report.transfers.filter(t => !t.system), returnsFalse: item.report.returnsFalse,
    expectedHandoff: incidentHandoff(item.report, item.provenance).supportText,
    forbiddenConclusions: ['Automatically repeat the payment', 'Overall failure proves no money moved', 'System transfer proves a principal refund', 'All token balances or order fulfillment reconciled'] });
  rows.push({ id, ticket: tickets[index], sourceFile: `sources/${id}.json`, network: item.provenance.network });
}
await writeFile(join(output, 'tickets.json'), JSON.stringify(rows, null, 2) + '\n');
await writeFile(join(output, 'facilitator', 'answer-key.json'), JSON.stringify(answers, null, 2) + '\n');
await writeFile(join(output, 'facilitator', 'results-template.json'), JSON.stringify({ status: 'not_started', participants: [],
  observationFields: ['anonymousParticipantId', 'roleAndNearExperience', 'case', 'condition', 'seconds', 'transferConclusion', 'failureReceiptIds', 'nextCheck', 'unsafeConclusion', 'assistanceNeeded', 'reuseReason', 'currentAlternative', 'incidentFrequency', 'priceReaction'],
  limitations: 'Three-person formative pilot with recorded traces, not a commercial-demand or production speed benchmark. No results have been collected.' }, null, 2) + '\n');
console.log(`Prepared 3 recorded tickets, source traces, facilitator answer key and empty results template: ${output}`);
console.log('No participant contacted; no results collected. Instructions: docs/USER-VALIDATION.md');
