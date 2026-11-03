// Author: Tommy
// Only temporary files and fake ledger entries; no providers or credentials.
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
const [directory, mode] = process.argv.slice(2), lock = join(directory, 'operation.lock');
const wait = event => new Promise(resolve => {
  const listener = message => { if (message === event) { process.off('message', listener); resolve(); } };
  process.on('message', listener);
});
const realRead = fs.readFile, realWrite = fs.writeFile, realLink = fs.link;
fs.link = async (source, destination) => {
  if (destination === lock && mode === 'pause-publication') { process.send({ stage: 'publishing' }); await wait('publish'); }
  return realLink(source, destination);
};
let readHeld = false;
fs.readFile = async (path, ...args) => {
  const value = await realRead(path, ...args);
  if (path === lock && mode === 'barrier' && !readHeld) { readHeld = true; process.send({ stage: 'read' }); await wait('read'); }
  return value;
};
fs.writeFile = async (path, value, ...args) => {
  if (String(path).endsWith('.candidate') && ['before-publish', 'write-failure'].includes(mode)) {
    await realWrite(path, String(value).slice(0, 5), ...args);
    if (mode === 'write-failure') throw new Error('INJECTED_WRITE_FAILURE');
    process.send({ stage: 'candidate' }); await wait('candidate');
  }
  return realWrite(path, value, ...args);
};
syncBuiltinESMExports();
const { withFileLock } = await import('../../server/file-lock.mjs');
process.send({ stage: 'ready' }); await wait('start');
try {
  const action = async () => {
    // An independent O_EXCL probe detects actual overlap, even if IPC reorders.
    const probe = await fs.open(join(directory, 'critical-section'), 'wx');
    try {
      const ledger = JSON.parse(await realRead(join(directory, 'ledger.json'), 'utf8'));
      process.send({ stage: 'entered' });
      if (mode !== 'stress') await wait('release');
      else await new Promise(resolve => setTimeout(resolve, 5));
      await realWrite(join(directory, 'ledger.json'), JSON.stringify({ reservations: ledger.reservations + 1 }));
    } finally { await probe.close(); await fs.unlink(join(directory, 'critical-section')); }
  };
  if (mode === 'stress') {
    let complete = false;
    for (let attempt = 0; attempt < 100 && !complete; attempt++) {
      try { await withFileLock(lock, action); complete = true; }
      catch (error) {
        if (!/Another operation|LOCK_RECOVERY/.test(error.message)) throw error;
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    if (!complete) throw new Error('Lock did not become available');
  } else await withFileLock(lock, action);
  process.send({ stage: 'done' });
} catch (error) { process.send({ stage: 'failed', error: error.message }); }
process.disconnect();
