// Author: Tommy
// Read-only transaction diagnosis; no AI, wallet, credentials or signing imports.
import { RpcClient } from '../server/rpc-client.mjs';
import { IncidentService } from '../server/incident-service.mjs';
const [network, transactionHash, sender, ...extra] = process.argv.slice(2);
if (!network && !transactionHash && !sender) console.log('Usage: node scripts/inspect-incident.mjs <testnet|mainnet> <transaction-hash> <sender-account>\nRead-only RPC report; no payment or AI request.');
else {
  if (extra.length) throw new Error('Expected network, transaction hash and sender only.');
  const service = new IncidentService({ testnet: new RpcClient('https://test.rpc.fastnear.com', { timeoutMs: 10000 }), mainnet: new RpcClient('https://free.rpc.fastnear.com', { timeoutMs: 10000 }) });
  console.log(JSON.stringify(await service.collect({ network, transactionHash, sender }), null, 2));
}
