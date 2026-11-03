// Author: Tommy
const node = (tag, text) => { const e = document.createElement(tag); e.textContent = text; return e; };
const outcome = status => Object.hasOwn(status, 'Failure') ? 'Failed'
  : Object.hasOwn(status, 'SuccessReceiptId') ? 'Handed off to another receipt' : 'Returned successfully';

// Only checked execution fields. Do not decode a return value into payment,
// token balance or refund meaning; those require application-specific evidence.
export function renderReceiptEvidence(container, report) {
  const section = node('section', ''); section.className = 'receipt-evidence';
  section.append(node('h4', 'Overall result and individual steps'));
  const summary = node('p', `Overall result: ${outcome(report.source.status)}. Failed receipts: ${report.failures.length} of ${report.coverage.receipts}.`);
  summary.className = 'receipt-summary'; section.append(summary);
  section.append(node('p', 'A successful return is not proof that every step succeeded. A later failure does not undo every earlier receipt.'));
  const details = node('details', ''); details.append(node('summary', 'Compare with source receipt fields'));
  const table = node('table', ''); table.className = 'receipt-table';
  table.append(node('caption', 'Execution receipts — ordered by ID, not time. System transfers are listed under scope below.'));
  const header = node('tr', '');
  for (const title of ['Receiver / actions', 'Execution outcome', 'Source receipt']) {
    const th = node('th', title); th.scope = 'col'; header.append(th);
  }
  const head = node('thead', ''); head.append(header); table.append(head);
  const body = node('tbody', '');
  for (const receipt of report.source.receipts.filter(item => item.from !== 'system')) {
    const row = node('tr', '');
    const action = receipt.actions.map(item => item.FunctionCall?.method_name || 'Native Transfer').join(', ');
    row.append(node('td', `${receipt.to} · ${action}`), node('td', outcome(receipt.status)), node('td', receipt.id));
    body.append(row);
  }
  table.append(body); details.append(table, node('p', `Raw overall status: ${JSON.stringify(report.source.status)}`));
  section.append(details); container.append(section);
}
