// Author: Tommy
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// Only this reviewed transport revision is archived. Prompt/validator changes
// still fail replay; never relabel a historical model run as a fresh observation.
const oldClientHash = 'ff4fdc64bbd7f90b020c193893ce4a4abdfff46e0405b7dbea2439500373ad98';
export async function checkRecordedSource(root, name, expected) {
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const current = await readFile(new URL(name, root));
  if (hash(current) === expected) return 'current';
  if (name !== 'server/ai-client.mjs' || expected !== oldClientHash) throw new Error(`Source changed since recorded run: ${name}`);
  const archived = await readFile(new URL('benchmarks/recorded-sources/ai-client-v1.txt', root));
  if (hash(archived) !== oldClientHash) throw new Error('Recorded AI client archive changed');
  return 'archived-ai-transport-v1';
}
