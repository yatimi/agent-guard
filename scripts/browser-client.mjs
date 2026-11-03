// Author: Tommy
export async function browserTab() {
  const debug = process.env.AGENTGUARD_BROWSER_DEBUG_URL || 'http://127.0.0.1:9229';
  const tab = await (await fetch(`${debug}/json/new?about:blank`, { method: 'PUT', signal: AbortSignal.timeout(10000) })).json();
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0; const pending = new Map(); const events = [];
  socket.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (!m.id) { events.push(m); return; }
    const request = pending.get(m.id); if (!request) return;
    pending.delete(m.id); clearTimeout(request.timeout); m.error ? request.reject(new Error(m.error.message)) : request.resolve(m.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw new Error(`UI condition timeout: ${expression}`);
  };
  const close = async () => { for (const p of pending.values()) clearTimeout(p.timeout); socket.close(); await fetch(`${debug}/json/close/${tab.id}`, { signal: AbortSignal.timeout(2000) }).catch(() => {}); };
  return { call, evaluate, until, events, close };
}
