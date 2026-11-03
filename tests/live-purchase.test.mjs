// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
const source = (await readFile(new URL('../web/live-purchase.mjs', import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
class Element {
  constructor() { this.children = []; this.listeners = {}; this.value = 'purchase'; this.hidden = false; this.disabled = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  click() { return this.listeners.click?.(); }
}
function fixture() {
  const storage = new Map(), runs = new Map(), posts = [], resumes = [];
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const recovery = () => [...runs.values()].filter(run => run.state !== 'completed' && run.state !== 'blocked').map(({ id, scenario, inspectionId }) => ({ id, scenario, ...(inspectionId ? { inspectionId } : {}) }));
  async function tab({ staleSession = () => false, failStorage = false, admissionError = null } = {}) {
    const elements = new Map();
    const panel = { querySelector: name => { if (!elements.has(name)) elements.set(name, new Element()); return elements.get(name); } };
    const fetch = async (url, options = {}) => {
      let value, status = 200;
      if (url === '/api/session') value = { token: 'fixture', recoverable: staleSession() ? [] : recovery() };
      else if (url === '/api/inspections') value = { id: randomUUID(), eligible: true, expiresAt: new Date(Date.now()+600000).toISOString(), preview: { diagnosis: 'Fixture incident', receipts: 6 }, report: null };
      else if (url === '/api/runs') {
        const body = JSON.parse(options.body); posts.push(body);
        if (admissionError) return { ok: false, status: 409, json: async () => ({ error: admissionError, noPurchaseCreated: true }) };
        // A durable intent must already exist before every purchase POST.
        assert.equal(JSON.parse(storage.get(`agentguard-purchase-id:${body.requestId}`)).id, body.requestId);
        const existing = recovery()[0];
        if (existing && existing.id !== body.requestId) { status = 409; value = { error: 'ANOTHER_PURCHASE_IS_ACTIVE', recovery: existing }; }
        else {
          const run = { id: body.requestId, scenario: body.scenario, inspectionId: body.inspectionId, state: 'pending', createdAt: new Date().toISOString(), events: [] };
          runs.set(run.id, run); value = run;
        }
      } else {
        const id = url.split('/')[3]; value = runs.get(id);
        if (url.endsWith('/resume')) { resumes.push(id); if (value) { value.state = 'blocked'; value.recoveryRequired = false; } }
        if (!value) { status = 404; value = { error: 'RUN_NOT_FOUND' }; }
      }
      return { ok: status < 400, status, json: async () => value };
    };
    await runInNewContext(`(async () => { ${source}\n })()`, {
      document: { querySelector: () => panel, createElement: () => new Element() },
      localStorage: failStorage ? { ...localStorage, setItem: () => { throw new Error('quota'); } } : localStorage,
      fetch, renderIncident: () => {}, crypto: { randomUUID }, AbortSignal, formatNear: value => String(value),
      setTimeout: () => 1, clearTimeout: () => {}, URL, Blob,
    });
    if (!elements.get('[data-incident-check]').disabled) await elements.get('[data-incident-form]').listeners.submit({ preventDefault() {} });
    return { inspect: () => elements.get('[data-incident-form]').listeners.submit({ preventDefault() {} }), check: elements.get('[data-incident-check]'), start: elements.get('[data-live-start]'), resume: elements.get('[data-live-resume]'), status: elements.get('[data-live-status]'), technical: elements.get('[data-live-technical]') };
  }
  return { tab, storage, runs, posts, resumes };
}
test('two Ready tabs preserve both intents and reopen the original unresolved purchase after reload', async () => {
  const f = fixture(), first = await f.tab(), second = await f.tab({ staleSession: () => true });
  assert.equal(first.start.disabled, false); assert.equal(second.start.disabled, false);
  await first.start.click(); const original = f.posts[0].requestId;
  await second.start.click(); const competitor = f.posts[1].requestId;
  assert.notEqual(original, competitor);
  assert.equal(JSON.parse(f.storage.get(`agentguard-purchase-id:${original}`)).inspectionId, f.posts[0].inspectionId);
  assert.ok(f.storage.has(`agentguard-purchase-id:${original}`)); assert.ok(f.storage.has(`agentguard-purchase-id:${competitor}`));
  assert.match(second.technical.textContent, new RegExp(original)); assert.equal(second.start.disabled, true);
  // Simulate closing the losing tab immediately after persisting its new pointer.
  f.storage.set('agentguard-purchase-id', JSON.stringify({ id: competitor, scenario: 'purchase' }));
  f.runs.get(original).state = 'needs_attention';
  const reopened = await f.tab();
  assert.match(reopened.technical.textContent, new RegExp(original)); assert.equal(reopened.resume.hidden, false); assert.equal(reopened.start.disabled, true);
  await reopened.resume.click(); assert.equal(f.posts.length, 2);
});
test('a previously Ready tab checks the journal before creating another intent', async () => {
  const f = fixture(), first = await f.tab(), second = await f.tab();
  await first.start.click(); await second.start.click();
  assert.equal(f.posts.length, 1); assert.match(second.technical.textContent, new RegExp(f.posts[0].requestId));
});
test('a blocked competing run links to the original purchase and disables Buy', async () => {
  const f = fixture(), original = randomUUID(), competitor = randomUUID();
  f.runs.set(original, { id: original, scenario: 'purchase', state: 'needs_attention', events: [] });
  f.runs.set(competitor, { id: competitor, scenario: 'purchase', state: 'blocked', error: 'AN_EARLIER_PAYMENT_NEEDS_RECONCILIATION', recovery: { id: original, scenario: 'purchase' }, events: [] });
  f.storage.set('agentguard-purchase-id', JSON.stringify({ id: competitor, scenario: 'purchase' }));
  const tab = await f.tab({ staleSession: () => true });
  assert.equal(tab.start.disabled, true); assert.equal(tab.resume.hidden, false); assert.match(tab.resume.textContent, /Open earlier/);
  await tab.resume.click(); assert.match(tab.technical.textContent, new RegExp(original)); assert.equal(f.posts.length, 0);
});
test('browser storage failure sends no purchase request', async () => {
  const f = fixture(), tab = await f.tab({ failStorage: true }); await tab.start.click();
  assert.equal(f.posts.length, 0); assert.match(tab.status.textContent, /storage is unavailable/);
});

test('multiple interrupted journals resume the displayed purchase instead of switching forever', async () => {
  const f = fixture(), first = randomUUID(), second = randomUUID();
  for (const id of [first, second]) f.runs.set(id, { id, scenario: 'purchase', state: 'planning', recoveryRequired: true, events: [] });
  const tab = await f.tab(); assert.match(tab.technical.textContent, new RegExp(first));
  await tab.resume.click(); assert.deepEqual(f.resumes, [first]);
  await tab.inspect(); assert.match(tab.technical.textContent, new RegExp(second));
  await tab.resume.click(); assert.deepEqual(f.resumes, [first, second]); assert.equal(f.posts.length, 0);
});

for (const code of ['QUOTE_EXPIRED', 'INSPECTION_NOT_FOUND']) test(`${code} before admission allows a fresh check instead of endless 404 recovery`, async () => {
  const f = fixture(), tab = await f.tab({ admissionError: code }); await tab.start.click();
  assert.equal(tab.check.disabled, false); assert.equal(tab.start.disabled, true); assert.equal(tab.resume.hidden, true);
  assert.match(tab.status.textContent, /no purchase created/); assert.equal(f.storage.has('agentguard-purchase-id'), false);
  await tab.inspect(); assert.equal(tab.start.disabled, false);
});
