// Author: Tommy
import { link, readFile, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

async function remove(path) {
  try { await unlink(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export async function withFileLock(path, action) {
  const token = randomUUID();
  const candidate = `${path}.${token}.candidate`;
  const guard = `${path}.reclaim`;
  let acquired = false;
  try {
    // Publish complete metadata atomically. A crash while writing leaves only an
    // unreferenced candidate, never an empty lock at the shared path.
    await writeFile(candidate, JSON.stringify({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
    // ALL publications share this short guard, including uncontended ones.
    // Otherwise a normal acquirer could replace a just-released lock between
    // a reclaimer's read of the old owner and its dead-PID check.
    try { await link(candidate, guard); }
    catch (claim) {
      if (claim.code === 'EEXIST') throw new Error('LOCK_RECOVERY_REQUIRES_INSPECTION');
      throw claim;
    }
    try {
      let previous;
      try { previous = JSON.parse(await readFile(path, 'utf8')); }
      catch (read) { if (read.code !== 'ENOENT') throw read; }
      if (previous) {
        if (!Number.isSafeInteger(previous.pid) || previous.pid <= 0 || typeof previous.token !== 'string' || !previous.token) throw new Error('Invalid lock; inspect local state.');
        let dead = false;
        try { process.kill(previous.pid, 0); }
        catch (probe) { if (probe.code !== 'ESRCH') throw probe; dead = true; }
        if (!dead) throw new Error('Another operation is in progress. Wait before retrying.');
        await remove(path);
      }
      await link(candidate, path);
      acquired = true;
    } finally {
      // Never auto-reclaim this guard: a crash here requires operator inspection
      // with all writers stopped. Guessing a timeout would reopen the race.
      await unlink(guard);
    }
    return await action();
  } finally {
    if (acquired) {
      const current = JSON.parse(await readFile(path, 'utf8'));
      if (current.token === token) await unlink(path);
    }
    await remove(candidate);
  }
}
