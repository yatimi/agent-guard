// Author: Tommy
import { randomBytes } from 'node:crypto';
export function localApi(workflow) {
  const token = randomBytes(32).toString('hex');
  return async (request, response, url) => {
    const send = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(value));
    };
    if (request.headers.host !== '127.0.0.1:4173') return send(403, { error: 'LOOPBACK_HOST_REQUIRED' });
    if (request.method === 'GET' && url.pathname === '/api/session') return send(200, { token, network: 'testnet', config: workflow.config, priceNear: '0.01' });
    const match = url.pathname.match(/^\/api\/runs\/([0-9a-f-]+)(\/resume)?$/);
    try {
      if (request.method === 'GET' && match && !match[2]) {
        const run = await workflow.load(match[1]);
        return send(run ? 200 : 404, run ? workflow.public(run) : { error: 'RUN_NOT_FOUND' });
      }
      if (request.method !== 'POST' || request.headers.origin !== 'http://127.0.0.1:4173' || request.headers['x-agentguard-token'] !== token || request.headers['content-type'] !== 'application/json') return send(403, { error: 'LOCAL_SESSION_REQUIRED' });
      let text = '';
      for await (const chunk of request) { text += chunk; if (Buffer.byteLength(text) > 4096) return send(413, { error: 'BODY_TOO_LARGE' }); }
      const body = JSON.parse(text);
      if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('INVALID_REQUEST');
      if (url.pathname === '/api/runs' && Object.keys(body).sort().join(',') === 'requestId,scenario') return send(202, await workflow.create(body.requestId, body.scenario));
      if (match?.[2] && Object.keys(body).length === 0) return send(200, await workflow.resume(match[1]));
      return send(400, { error: 'INVALID_REQUEST' });
    } catch (error) { return send(409, { error: error instanceof SyntaxError ? 'INVALID_JSON' : error.message }); }
  };
}
