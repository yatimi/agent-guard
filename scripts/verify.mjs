// Author: Tommy
// The default judge/CI checks require only Node. They never load .env.
import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const tests = (await Promise.all(['web', 'tests'].map(async directory => (await readdir(new URL(`../${directory}/`, import.meta.url))).filter(name => name.endsWith('.test.mjs')).sort().map(name => `${directory}/${name}`)))).flat();
for (const args of [['--test', ...tests], ['scripts/replay-security.mjs'], ['scripts/replay-incident-security.mjs'], ['scripts/replay-incident.mjs']]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', timeout: 120000 });
  if (result.error || result.status !== 0) { console.error(result.error?.message || `Verification failed: ${args[0]}`); process.exit(1); }
}
console.log('Judge verification passed. No credentials or spending required.');
