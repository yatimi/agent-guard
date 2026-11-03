// Author: Tommy
// Optional UI QA against a dedicated Chrome debugging port. Uses only local
// fixtures and public recorded data; never imports the signer or AI client.
import assert from 'node:assert/strict';
import { buildIncidentReport, normalizeIncident } from '../server/incident-report.mjs';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
// QA images belong outside the checkout, including ignored directories.
const temporaryRoot = await realpath(tmpdir());
const checkoutRoot = await realpath(project);
assert.ok(temporaryRoot !== checkoutRoot && !temporaryRoot.startsWith(checkoutRoot + sep), 'Temporary directory must be outside the repository.');
const output = await mkdtemp(resolve(temporaryRoot, 'agentguard-browser-qa-'));
console.log(`Temporary browser QA artifacts: ${output}`);
const recording = JSON.parse(await readFile(resolve(project, 'docs/live-purchase.json'), 'utf8'));
const runtime = JSON.parse(await readFile(resolve(project, 'docs/runtime-verification.json'), 'utf8'));
const raw = runtime.cases.find(c=>c.case==='callback-gas-fault').evidence.finalRpcReceipt;
const target = { network: 'testnet', transactionHash: raw.transaction.hash, sender: raw.transaction.signer_id };
const incident = buildIncidentReport(normalizeIncident(raw, target), new Date().toISOString(), 'recorded-local-sandbox');
let inspectionMode = 'paid';
const inspectionId = '11111111-1111-4111-8111-111111111111';
const root = resolve(project, 'web');
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
let current = null, dropCreate = false, discardCreate = false, creates = [], resumes = 0;
const complete = id => ({ id, state: 'completed', events: [], createdAt: recording.verifiedAt, updatedAt: recording.verifiedAt,
  quote: { ...recording.quote, title: 'NEAR transaction incident report', task: { version: 'incident-v1', target } }, target, inspectionId, taskVersion: 'incident-v1', report: incident, deliveryVerified: true, proof: recording.proof, summary: 'Fixture support draft; inspect the execution evidence.',
  transactionHash: recording.proof.transactionHash, recoveryRequired: false });
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const send = (code, body) => { response.writeHead(code, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
  try {
    if (path === '/api/session') return send(200, { token: 'local-ui-fixture' });
    if (path.startsWith('/api/')) {
      let text = ''; for await (const chunk of request) text += chunk;
      if (path === '/api/inspections') {
        if (inspectionMode === 'incomplete') return send(409, { error: 'INCOMPLETE_RECEIPT_TRACE' });
        return send(200, { id: inspectionId, target, eligible: inspectionMode === 'paid', expiresAt: new Date(Date.now()+600000).toISOString(), preview: { diagnosis: incident.diagnosis, receipts: 6, failures: 1 }, report: inspectionMode === 'free' ? incident : null });
      }
      if (path === '/api/runs' && request.method === 'POST') {
        const input = JSON.parse(text); creates.push(input);
        if (!discardCreate) current = { ...complete(input.requestId), state: 'pending', proof: null, report: null, deliveryVerified: false, summary: null, recoveryRequired: false };
        if (dropCreate) { response.destroy(); return; }
        return send(202, current);
      }
      if (path.endsWith('/resume') && request.method === 'POST') { resumes++; current = complete(current.id); return send(200, current); }
      return send(current ? 200 : 404, current || { error: 'RUN_NOT_FOUND' });
    }
    const file = resolve(root, `.${path === '/' ? '/index.html' : decodeURIComponent(path)}`);
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    let body = await readFile(file);
    if (path === '/') body = Buffer.from(body.toString().replace('<body>', '<body><p role="note" style="padding:16px;background:#fff0c2;color:#352b12;margin:0">LOCAL UI TEST FIXTURE · Recorded data / simulated responses · No live model or payment</p>'));
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); response.end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
let socket, tab;
const debug = process.env.AGENTGUARD_BROWSER_DEBUG_URL || 'http://127.0.0.1:9229';
const report = { mode: 'local-browser-fixtures', observedAt: new Date().toISOString(), checks: [], screenshots: [], limitations: 'Chrome UI fixtures plus recorded public dataset; no new model call, signing or live purchase. Does not establish screen-reader support.' };
try {
  report.browser = (await (await fetch(`${debug}/json/version`)).json()).Browser;
  tab = await (await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map(), exceptions = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    if (message.id) { const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timeout); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 30)); }
    throw new Error(`UI condition timed out: ${expression}`);
  };
  const click = async selector => {
    const position = await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...position, button: 'left', clickCount: 1 });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...position, button: 'left', clickCount: 1 });
  };
  const reload = async () => { await call('Page.reload'); await until('document.readyState === "complete"'); };
  const check = title => { report.checks.push(title); console.log(`PASS ${title}`); };
  const screenshot = async (name, selector) => {
    await evaluate(selector ? `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})` : 'window.scrollTo(0, 0)');
    const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(output, `${name}.png`), Buffer.from(result.data, 'base64')); report.screenshots.push(`${name}.png`);
  };
  await call('Page.enable'); await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base }); await until('document.querySelector("[data-incident-check]")?.disabled === false');
  assert.equal(await evaluate('document.querySelector("[data-live-start]").disabled'), true); check('Buy stays disabled until a free inspection produces a quote');
  const contrast = await evaluate(`(() => {
    const rgb = text => { const n=text.match(/[\\d.]+/g)?.map(Number); return n?.length===3 || (n?.length===4 && n[3]===1) ? n.slice(0,3) : null; };
    const luminance = c => c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
    return [...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length && [...e.childNodes].some(n=>n.nodeType===3 && n.textContent.trim()) && !e.closest('button:disabled, [aria-hidden="true"]')).flatMap(e=>{
      const s=getComputedStyle(e),fg=rgb(s.color); if (!fg || s.visibility==='hidden' || Number(s.opacity)!==1) return [];
      let parent=e,bg; while(parent && !bg){bg=rgb(getComputedStyle(parent).backgroundColor);parent=parent.parentElement;} if(!bg)return [];
      const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      const large=parseFloat(s.fontSize)>=24 || (parseFloat(s.fontSize)>=18.666 && Number(s.fontWeight)>=700);
      return [{selector:e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+[...e.classList].join('.'),text:e.textContent.trim().slice(0,70),foreground:s.color,background:bg,fontSize:s.fontSize,ratio,required:large?3:4.5,pass:ratio >= (large?3:4.5)}];
    });
  })()`);
  report.contrast = contrast;
  assert.deepEqual(contrast.filter(item=>!item.pass), []); check('visible opaque text in the ready screen meets measured AA contrast');
  await call('Accessibility.enable');
  const tree = await call('Accessibility.getFullAXTree');
  report.accessibleControls = tree.nodes.filter(node=>['combobox','button','link'].includes(node.role?.value) && !node.ignored).map(node=>({role:node.role.value,name:node.name?.value}));
  assert.equal(report.accessibleControls.find(node=>node.role==='combobox' && node.name==='Supplier response')?.name, 'Supplier response'); check('supplier select accessible name matches its visible label');
  const inspect = async () => {
    await evaluate(`document.querySelector('[data-incident-hash]').value=${JSON.stringify(target.transactionHash)};document.querySelector('[data-incident-sender]').value=${JSON.stringify(target.sender)};`);
    await click('[data-incident-check]');
  };
  await inspect(); await until('document.querySelector("[data-live-start]").disabled === false');
  await evaluate('document.querySelector("[data-live-scenario]").focus()');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate('document.activeElement.hasAttribute("data-live-start")'), true);
  assert.notEqual(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'none'); check('quoted diagnosis Buy is keyboard reachable with visible focus');
  dropCreate = true;
  await click('[data-live-start]'); await until('document.querySelector("[data-live-status]").textContent.includes("Connection interrupted")');
  const original = creates[0].requestId, submitted = creates.length;
  assert.ok(creates.every(input => input.requestId === original));
  assert.equal(await evaluate('document.querySelector("[data-live-start]").disabled'), true);
  check('lost create response disables new purchases and retains the original ID');
  await reload(); await until('document.querySelector("[data-live-status]").textContent === "Payment outcome not confirmed"');
  assert.equal(creates.length, submitted); assert.equal(await evaluate('document.querySelector("[data-live-result]").textContent.includes("Your paid")'), false);
  check('refresh while pending performs no POST and shows no premature paid result');
  assert.equal(await evaluate(`document.querySelector('[data-live-invoice]').textContent.includes(${JSON.stringify(target.transactionHash)})`), true); check('pending reload retains the investigated transaction identity separately from fee');
  current.recoveryRequired = true;
  await reload(); await until('document.querySelector("[data-live-status]").textContent.includes("Server restarted")');
  await click('[data-live-resume]'); await until('document.querySelector("[data-live-status]").textContent === "Purchase complete"');
  assert.equal(resumes, 1); assert.equal(creates.length, submitted); assert.equal(current.id, original);
  check('restart recovery completes the original purchase without another create');
  await reload(); await until('document.querySelector("[data-live-status]").textContent === "Purchase complete"');
  assert.equal(creates.length, submitted); assert.equal(resumes, 1); check('completed refresh preserves the original proof without API mutation');
  assert.equal(await evaluate('document.querySelector(".incident-draft").open'), false);
  await click('.incident-draft summary');
  assert.equal(await evaluate('document.querySelector(".incident-draft").open'), true);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".incident-draft p")).whiteSpace'), 'pre-line');
  check('review-only AI draft expands on demand and preserves paragraph breaks');
  current.summary = '<img src=x onerror="window.agentguardInjection=true">';
  await reload(); await until('document.querySelector("[data-live-result]").textContent.includes("onerror")');
  assert.equal(await evaluate('document.querySelector("[data-live-result] img") !== null || window.agentguardInjection === true'), false);
  check('model content renders as text and cannot inject HTML');
  current.summary = 'The native transfer is confirmed, while settlement failed. Preserve the payment record and ask the application owner to reconcile it. Do not repeat the transfer from the overall failure status.';
  current.vault = { observedAt: recording.verifiedAt, policy: { per_payment: '100000000000000000000000', per_day: '200000000000000000000000', lifetime_budget: '500000000000000000000000' } };
  for (const width of [1440, 768, 390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
    await reload(); await until('document.querySelector("[data-live-status]").textContent === "Purchase complete"');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `horizontal overflow at ${width}`);
    check(`completed screen fits ${width}px without horizontal page overflow`);
    if ([1440, 390].includes(width)) { await screenshot(`completed-${width}`); await screenshot(`paid-result-${width}`, '[data-live-result]'); }
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 1050, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.documentElement.style.fontSize="200%"');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true); check('page has no horizontal overflow with doubled root font size at 390px');
  await evaluate('document.documentElement.style.fontSize=""');
  await evaluate(`(() => {
    const style=document.createElement('style');style.id='qa-spacing';style.textContent='* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }';document.head.append(style);
  })()`);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true); check('390px layout reflows with WCAG text-spacing overrides');
  await evaluate('document.querySelector("#qa-spacing").remove()');

  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".scenario")).transitionDuration'), '0s'); check('reduced motion disables scenario transitions');
  await evaluate('localStorage.clear()'); current = null; discardCreate = true;
  await reload(); await until('document.querySelector("[data-incident-check]").disabled === false'); await inspect(); await until('document.querySelector("[data-live-start]").disabled === false');
  await click('[data-live-start]'); await until('document.querySelector("[data-live-status]").textContent.includes("Connection interrupted")');
  const missing = creates.at(-1).requestId;
  await reload(); await until('document.querySelector("[data-live-resume]").textContent.includes("Retry saved request")');
  dropCreate = false; discardCreate = false;
  await click('[data-live-resume]'); await until('document.querySelector("[data-live-status]").textContent === "Payment outcome not confirmed"');
  assert.equal(creates.at(-1).requestId, missing); check('request lost before persistence retries with the same ID after refresh');
  current.state = 'blocked'; current.error = 'INTERRUPTED_BEFORE_PAYMENT'; current.transactionHash = null;
  await reload(); await until('document.querySelector("[data-live-status]").textContent === "Stopped before payment"');
  assert.equal(await evaluate('document.querySelector("[data-incident-check]").disabled'), false); assert.equal(await evaluate('document.querySelector("[data-live-start]").disabled'), true); check('interruption before payment requires a fresh inspection before another fee');
  current.state = 'needs_attention'; current.error = 'TRANSACTION_NOT_FINAL_YET';
  await reload(); await until('document.querySelector("[data-live-status]").textContent === "Payment needs attention"');
  assert.equal(await evaluate('document.querySelector("[data-live-start]").disabled'), true); check('unknown transaction keeps Buy disabled and exposes recovery');
  current = { ...complete(current.id), state: 'paid_incomplete', report: null, deliveryVerified: false, error: 'SOURCE_UNAVAILABLE' };
  await reload(); await until('document.querySelector("[data-live-status]").textContent.includes("delivery needs attention")');
  assert.equal(await evaluate(`document.querySelector('[data-live-invoice]').textContent.includes(${JSON.stringify(target.transactionHash)})`), true);
  assert.equal(await evaluate('document.querySelector("[data-live-result]").textContent.includes("Diagnostic fee transaction")'), true);
  await click('[data-live-resume]'); await until('document.querySelector("[data-live-status]").textContent === "Purchase complete"'); check('paid delivery retry retains both identities and creates no second fee');
  const previousCreates = creates.length;
  await evaluate('localStorage.clear()'); current = null; inspectionMode = 'free';
  await reload(); await until('document.querySelector("[data-incident-check]").disabled === false'); await inspect();
  await until('document.querySelector("[data-live-status]").textContent.includes("Free result")');
  assert.equal(await evaluate('document.querySelector("[data-live-start]").disabled'), true); assert.equal(creates.length, previousCreates); check('free result displays without any purchase POST');
  inspectionMode = 'incomplete'; await inspect(); await until('document.querySelector("[data-live-status]").textContent.includes("Cannot produce")');
  assert.equal(await evaluate('document.querySelector("[data-live-start]").disabled'), true); check('incomplete trace cannot enable Buy');
  current = { id: original, state: 'completed', events: [], quote: recording.quote, dataset: recording.dataset, proof: recording.proof, summary: recording.summary, transactionHash: recording.proof.transactionHash };
  await evaluate(`localStorage.setItem('agentguard-purchase-id',JSON.stringify({id:${JSON.stringify(original)},scenario:'purchase'}))`);
  await reload(); await until('document.querySelector("[data-live-result]").textContent.includes("Your paid network snapshot")'); check('legacy paid snapshot remains readable');
  assert.deepEqual(exceptions, []); check('no uncaught browser exceptions');
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Browser QA report: ${output}/report.json`);
} finally {
  if (tab) await fetch(`${debug}/json/close/${tab.id}`, { signal: AbortSignal.timeout(2000) }).catch(() => {});
  socket?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
