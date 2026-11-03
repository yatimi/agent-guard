// Author: Tommy
const ENDPOINT = 'https://test.rpc.fastnear.com';

export async function rpc(method, params) {
  const response = await fetch(ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 'agent-guard', method, params }),
  });
  if (!response.ok) throw new Error(`Testnet RPC HTTP ${response.status}`);
  const body = await response.json();
  return body;
}

export async function query(params) {
  const body = await rpc('query', { finality: 'final', ...params });
  if (body.error || !body.result) throw new Error(`Testnet RPC error: ${JSON.stringify(body.error)}`);
  return body.result;
}
