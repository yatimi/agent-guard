// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCases } from '../server/demo-cases.mjs';
import { incidentHandoff } from '../web/incident-handoff.mjs';
const { cases } = await demoCases();
test('support handoff keeps a confirmed transfer visible despite callback failure', () => {
  const example = cases.find(item => item.id === 'callback-gas-fault');
  const handoff = incidentHandoff(example.report, example.provenance);
  assert.match(handoff.headline, /confirmed.*duplicate/);
  assert.match(handoff.supportText, /local NEAR Sandbox.*not a public-chain/);
  assert.ok(handoff.supportText.includes(example.report.target.transactionHash));
  for (const item of example.report.transfers.filter(item => !item.system)) assert.ok(handoff.supportText.includes(item.receiptId));
});
test('failed transfer and successful false callback never authorize a retry or assert a refund', () => {
  const example = cases.find(item => item.id === 'failed-transfer');
  const handoff = incidentHandoff(example.report, example.provenance);
  assert.match(handoff.headline, /failed.*Reconcile/);
  assert.match(handoff.supportText, /returned false/);
  assert.match(handoff.supportText, /No replacement payment or refund is authorized/);
  assert.match(handoff.supportText, /System transfers alone do not prove/);
});
test('target with no native transfer is not called unpaid or refunded; fee and AI text stay separate', () => {
  const example = cases.find(item => item.id === 'paid-testnet');
  const handoff = incidentHandoff(example.report, example.provenance);
  assert.match(handoff.headline, /not established/);
  assert.ok(!handoff.supportText.includes(example.fee.transactionHash));
  assert.ok(!handoff.supportText.includes(example.summary));
  assert.match(handoff.supportText, /Recorded evidence/);
  assert.ok(handoff.supportText.includes(example.report.sha256));
});
test('mixed outcomes and one yocto remain exact without counting system transfers as user delivery', () => {
  const report = structuredClone(cases[0].report);
  report.transfers = [
    { from: 'system', to: 'user.near', amountYocto: '1000000000000000000000000', outcome: 'confirmed', system: true, receiptId: 'system-receipt' },
    { from: 'a.near', to: 'b.near', amountYocto: '1', outcome: 'confirmed', system: false, receiptId: 'one-yocto' },
    { from: 'a.near', to: 'c.near', amountYocto: '3', outcome: 'failed', system: false, receiptId: 'failed-receipt' },
  ];
  const handoff = incidentHandoff(report);
  assert.match(handoff.supportText, /0\.000000000000000000000001 native NEAR/);
  assert.match(handoff.supportText, /failed-receipt/);
  assert.ok(!handoff.supportText.includes('system-receipt'));
  report.transfers = [report.transfers[0]];
  assert.match(incidentHandoff(report).headline, /not established/);
});
