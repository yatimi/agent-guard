// Author: Tommy
import { readHttpJson } from './http-json.mjs';
export class RpcClient {
  constructor(endpoint, { timeoutMs = 20000, maxResponseBytes = 2000000 } = {}) {
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
  }

  async call(method, params) {
    const response = await fetch(this.endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'agentguard', method, params }),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new Error(`RPC HTTP ${response.status}`);
    }
    const body = await readHttpJson(response, { maxBytes: this.maxResponseBytes, prefix: 'RPC' });
    if (body.error) {
      const code = body.error.cause?.name ?? body.error.name ?? body.error.code;
      // Preserve protocol identifiers, not arbitrary server diagnostics.
      const safe = typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code)
        ? code : Number.isSafeInteger(code) ? String(code) : 'ERROR';
      throw new Error(`RPC ${safe}`);
    }
    if (!Object.hasOwn(body, 'result')) throw new Error('RPC response has no result.');
    return body.result;
  }

  query(params) { return this.call('query', { finality: 'final', ...params }); }

  async view(account, method, args = {}) {
    const result = await this.query({ request_type: 'call_function', account_id: account,
      method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
    try {
      if (!Array.isArray(result?.result) || !result.result.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) throw new Error('bytes');
      const value = JSON.parse(Buffer.from(result.result).toString('utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
      return value;
    } catch { throw new Error('RPC_INVALID_VIEW_RESULT'); }
  }
}
