// Author: Tommy
// Safe default: reads public recordings, serves loopback, never loads .env.
import { demoServer } from '../server/demo-server.mjs';
const server = await demoServer();
server.once('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 4174 is already in use. Stop your previous demo or open http://127.0.0.1:4174.' : error.message); process.exitCode = 1; });
server.listen(4174, '127.0.0.1', () => console.log('AgentGuard recorded demo: http://127.0.0.1:4174\nOffline evidence + simulated attacks. No keys, AI calls or transactions.'));
