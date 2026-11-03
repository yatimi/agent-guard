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
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('Page.bringToFront');
  await call('Page.navigate', { url: base }); await until(`document.querySelectorAll('[data-demo-cases] button').length===4`);
  assert.ok(await evaluate(`document.querySelector('[data-demo-source]').textContent.includes('Recorded mainnet evidence')`));
  assert.ok(await evaluate(`document.querySelector('.receipt-summary').textContent.includes('Returned successfully. Failed receipts: 1 of 6')`));
  assert.ok(await evaluate(`document.querySelector('[data-demo-result]').textContent.includes('E51: contract paused')`));
  assert.equal(await evaluate(`document.querySelector('[data-demo-result] a[href*="nearblocks"]').hostname`), 'nearblocks.io');
  assert.ok(await evaluate(`document.querySelector('.incident-handoff textarea').value.includes('does not establish the complete wallet balance, token delivery')`));
  await evaluate(`document.querySelector('.receipt-evidence summary').focus()`);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.ok(await evaluate(`document.querySelector('.receipt-evidence details').open`));
  assert.ok(await evaluate(`document.querySelector('.receipt-table').textContent.includes('ft_resolve_transfer')`));
  assert.equal(await evaluate(`document.activeElement.textContent`), 'Compare with source receipt fields');
  for (const width of [1440, 390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    if (width !== 320) {
      await evaluate(`document.querySelector('.receipt-evidence').scrollIntoView({block:'start'})`);
      const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(resolve(output, `mainnet-evidence-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  console.log('PASS real mainnet evidence, keyboard comparison, correct explorer and token-scope limits');
  await evaluate(`document.querySelector('[data-case="callback-gas-fault"]').click()`);
  assert.ok(await evaluate(`document.querySelector('[data-demo-result]').textContent.includes('confirmed native transfer')`));
  assert.equal(await evaluate(`document.querySelector('[data-live-start]')`), null);
  assert.equal(await evaluate(`document.querySelector('[data-demo-result] a[href*="nearblocks"]')`), null);
  console.log('PASS recorded sandbox diagnosis has correct transfer/failure and no public explorer link');
  assert.ok(await evaluate(`document.querySelector('.incident-decision').textContent.includes('Avoid a duplicate payment')`));
  assert.ok(await evaluate(`document.querySelector('.incident-handoff textarea').value.includes('not a public-chain transaction')`));
  // Exercise the denied-clipboard path with keyboard activation, without changing
  // the user's system clipboard or granting a browser-wide permission.
  await evaluate(`Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async()=>{throw new Error('denied')}}}); [...document.querySelectorAll('[data-demo-result] button')].find(b=>b.textContent==='Copy support handoff').focus()`);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until(`document.activeElement===document.querySelector('.incident-handoff textarea')`);
  assert.equal(await evaluate(`(()=>{const e=document.activeElement;return e.selectionStart===0&&e.selectionEnd===e.value.length})()`), true);
  await call('Accessibility.enable');
  const tree = await call('Accessibility.getFullAXTree');
  assert.ok(tree.nodes.some(n => !n.ignored && n.role?.value === 'textbox' && n.name?.value === 'Support handoff text'));
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate(`document.activeElement.textContent`), 'Copy support handoff');
  assert.ok(await evaluate(`parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2`));
  await evaluate(`navigator.clipboard.writeText=async text=>{window.capturedHandoff=text};document.activeElement.click()`);
  await until(`document.querySelector('[data-demo-result]').textContent.includes('Support handoff copied')`);
  assert.equal(await evaluate(`window.capturedHandoff===document.querySelector('.incident-handoff textarea').value`), true);
  console.log('PASS keyboard copy, denied-clipboard selection, accessible name and recorded provenance');
  await evaluate(`document.querySelector('[data-case="failed-transfer"]').click()`);
  await until(`document.querySelector('[data-demo-status]').textContent.includes('callback returned false')`);
  assert.ok(await evaluate(`document.querySelector('[data-demo-result]').textContent.includes('failed')`));
  await evaluate(`document.querySelector('[data-case="paid-testnet"]').click()`);
  await until(`document.querySelector('[data-demo-result]').textContent.includes('RECIPIENT_NOT_ALLOWED')`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-demo-result] a[href*="nearblocks"]').length`), 2);
  assert.ok(await evaluate(`document.querySelector('.incident-decision').textContent.includes('not established')`));
  console.log('PASS recorded cases switch and paid case separates target and fee');
  await call('Page.reload'); await until(`document.querySelectorAll('[data-demo-cases] button').length===4`);
  await evaluate(`document.querySelector('[data-case="callback-gas-fault"]').click()`);
  for (const width of [1440, 390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  }
  // Double every computed font size, including fixed-pixel text. Unlike a root
  // font change this reaches all text in this recorded-result state.
  await evaluate(`document.querySelectorAll('[data-demo-result] details').forEach(e=>e.open=true)`);
  await evaluate(`(()=>{const samples=[...document.querySelectorAll('body *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const [e,size]of samples)e.style.fontSize=(size*2)+'px'})()`);
  if (!await evaluate('document.documentElement.scrollWidth <= innerWidth')) console.log('Text reflow overflow:', await evaluate(`[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,70),width:e.getBoundingClientRect().width})).slice(0,20)`));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, '200% text at 320px must reflow');
  assert.ok(await evaluate(`document.querySelector('.incident-handoff textarea').value.includes('No replacement payment')`));
  await call('Page.reload'); await until(`document.querySelectorAll('[data-demo-cases] button').length===4`);
  await evaluate(`document.querySelector('[data-case="callback-gas-fault"]').click()`);
  console.log('PASS open result details and all computed text sizes doubled at 320px');
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
