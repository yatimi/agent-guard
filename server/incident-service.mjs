// Author: Tommy
import { incidentTarget, normalizeIncident, buildIncidentReport, digest } from './incident-report.mjs';
export class IncidentService {
  constructor(clients) { this.clients = clients; }
  async source(target) {
    target = incidentTarget(target);
    const rpc = this.clients[target.network];
    const raw = await rpc.call('EXPERIMENTAL_tx_status', { tx_hash: target.transactionHash, sender_account_id: target.sender, wait_until: 'FINAL' });
    return normalizeIncident(raw, target);
  }
  async collect(target) {
    target = incidentTarget(target);
    return buildIncidentReport(await this.source(target), new Date().toISOString(), this.clients[target.network].endpoint);
  }
  async verify(report) {
    if (digest(await this.source(report.target)) !== report.sourceSha256) throw new Error('INCIDENT_SOURCE_CHANGED');
  }
}
