// Author: Tommy
// Any accidental network client or signing process use is a test failure.
import http from 'node:http';
import https from 'node:https';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const forbidden = () => { throw new Error('LIVE_CAPABILITY_USED_BY_DEMO'); };
globalThis.fetch = forbidden;
http.request = http.get = https.request = https.get = forbidden;
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync']) childProcess[name] = forbidden;
syncBuiltinESMExports();
const { demoServer } = await import('../../server/demo-server.mjs');
const server = await demoServer();
server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
