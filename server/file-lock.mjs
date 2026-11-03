// Author: Tommy
import { open, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export async function withFileLock(path, action) {
  const token = randomUUID();
  let handle;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { handle = await open(path, 'wx', 0o600); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const previous = JSON.parse(await readFile(path, 'utf8'));
      if (!Number.isInteger(previous.pid)) throw new Error('Invalid lock; inspect local state.');
      try { process.kill(previous.pid, 0); }
      catch (probe) {
        if (probe.code === 'ESRCH') { await unlink(path); continue; }
        throw probe;
      }
      throw new Error('Another operation is in progress. Wait before retrying.');
    }
  }
  if (!handle) throw new Error('Cannot acquire operation lock.');
  await handle.writeFile(JSON.stringify({ pid: process.pid, token }));
  await handle.close();
  try { return await action(); }
  finally {
    const current = JSON.parse(await readFile(path, 'utf8'));
    if (current.token === token) await unlink(path);
  }
}
