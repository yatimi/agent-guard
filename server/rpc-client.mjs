// Author: Tommy
export class RpcClient {
  constructor(endpoint, { timeoutMs = 20000 } = {}) {
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }

  async call(method, params) {
    const response = await fetch(this.endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'agentguard', method, params }),
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) {
      const error = new Error(`RPC ${body.error.cause?.name ?? body.error.name ?? body.error.code}`);
      error.rpcError = body.error;
      throw error;
    }
    if (!Object.hasOwn(body, 'result')) throw new Error('RPC response has no result.');
    return body.result;
  }

  query(params) { return this.call('query', { finality: 'final', ...params }); }

  async view(account, method, args = {}) {
    const result = await this.query({ request_type: 'call_function', account_id: account,
      method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
    return JSON.parse(Buffer.from(result.result).toString('utf8'));
  }
}
