// Author: Tommy
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoServer } from '../server/demo-server.mjs';
import { browserTab } from './browser-client.mjs';
const temporaryRoot = await realpath(tmpdir());
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
assert.ok(temporaryRoot !== root && !temporaryRoot.startsWith(root + sep));
const output = await mkdtemp(resolve(temporaryRoot, 'agentguard-demo-qa-'));
const server = await demoServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let tab;
try {
  tab = await browserTab(); const { call, evaluate, until, events } = tab;
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Page.navigate', { url: base }); await until(`document.querySelectorAll('[data-demo-cases] button').length===3`);
  assert.ok(await evaluate(`document.querySelector('[data-demo-result]').textContent.includes('confirmed native transfer')`));
  assert.equal(await evaluate(`document.querySelector('[data-live-start]')`), null);
  assert.equal(await evaluate(`document.querySelector('[data-demo-result] a[href*="nearblocks"]')`), null);
  console.log('PASS recorded sandbox diagnosis has correct transfer/failure and no public explorer link');
  await evaluate(`document.querySelector('[data-case="failed-transfer"]').click()`);
  await until(`document.querySelector('[data-demo-status]').textContent.includes('callback returned false')`);
  assert.ok(await evaluate(`document.querySelector('[data-demo-result]').textContent.includes('failed')`));
  await evaluate(`document.querySelector('[data-case="paid-testnet"]').click()`);
  await until(`document.querySelector('[data-demo-result]').textContent.includes('RECIPIENT_NOT_ALLOWED')`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-demo-result] a[href*="nearblocks"]').length`), 2);
  console.log('PASS three recorded cases switch and paid case separates target and fee');
  await call('Page.reload'); await until(`document.querySelectorAll('[data-demo-cases] button').length===3`);
  for (const width of [1440, 390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  }
  for (const width of [1440, 390]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
    await evaluate(`document.querySelector('#judge-demo').scrollIntoView({block:'start'})`);
    const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(output, `recorded-${width}.png`), Buffer.from(shot.data, 'base64'));
  }
  console.log(`Judge demo screenshots (outside repository): ${output}`);
  await evaluate(`document.querySelector('[data-scenario="injection"]').click(); document.querySelector('#run').click();`);
  assert.ok(await evaluate(`document.querySelector('#events').textContent.includes('RECIPIENT_NOT_ALLOWED')`));
  console.log('PASS judge demo reload/reflow and local attack simulation');
  const requests = events.filter(e => e.method === 'Network.requestWillBeSent').map(e => e.params.request);
  assert.ok(requests.length); assert.ok(requests.every(r => r.url.startsWith(base + '/') && r.method === 'GET'));
  assert.deepEqual(events.filter(e => e.method === 'Runtime.exceptionThrown'), []);
  console.log('PASS only local GETs; no outbound RPC, AI, mutation or browser exception');
} finally { if (tab) await tab.close(); await new Promise(resolve => server.close(resolve)); }
