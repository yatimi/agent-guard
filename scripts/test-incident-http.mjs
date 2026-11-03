// Author: Tommy
import assert from 'node:assert/strict';
import { RpcClient } from '../server/rpc-client.mjs';
import { IncidentService } from '../server/incident-service.mjs';
const target = { network: 'testnet', transactionHash: '2CeRPmk84jQjZdb8anP64XkrEtxSkEfwsNwVZRNnjPtk', sender: 'owner.test.near' };
const service = (path, options = {}) => new IncidentService({ testnet: new RpcClient(`http://127.0.0.1:4011/rpc/${path}`, options) });
const report = await service('final').collect(target);
assert.equal(report.failures.length, 1); assert.equal(report.transfers.find(t => !t.system).outcome, 'failed');
await service('final').verify(report);
await assert.rejects(service('missing').collect(target), /INCOMPLETE_RECEIPT_TRACE/);
await assert.rejects(service('quota').collect(target), /RPC HTTP 429/);
await assert.rejects(service('timeout', { timeoutMs: 100 }).collect(target), error => error.name === 'TimeoutError');
await assert.rejects(service('large', { maxResponseBytes: 1024 }).collect(target), /RPC_RESPONSE_TOO_LARGE/);
console.log('PASS real HTTP: final report + source recheck, missing receipt, 429, timeout and response-size limit. No model/signing imports.');
