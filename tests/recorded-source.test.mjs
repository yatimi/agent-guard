// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkRecordedSource } from '../benchmarks/recorded-source.mjs';
const hash = 'ff4fdc64bbd7f90b020c193893ce4a4abdfff46e0405b7dbea2439500373ad98';
test('historical transport archive is exact and cannot exempt prompt/source changes', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'agentguard-source-pins-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'server')); await mkdir(join(dir, 'benchmarks/recorded-sources'), { recursive: true });
  await writeFile(join(dir, 'server/ai-client.mjs'), 'changed transport');
  await writeFile(join(dir, 'server/incident-prompt.mjs'), 'changed prompt');
  const root = pathToFileURL(dir + '/');
  await assert.rejects(checkRecordedSource(root, 'server/ai-client.mjs', hash), { code: 'ENOENT' });
  await copyFile(new URL('../benchmarks/recorded-sources/ai-client-v1.txt', import.meta.url), join(dir, 'benchmarks/recorded-sources/ai-client-v1.txt'));
  assert.equal(await checkRecordedSource(root, 'server/ai-client.mjs', hash), 'archived-ai-transport-v1');
  await assert.rejects(checkRecordedSource(root, 'server/incident-prompt.mjs', hash), /Source changed/);
  await assert.rejects(checkRecordedSource(root, 'server/ai-client.mjs', '0'.repeat(64)), /Source changed/);
  await writeFile(join(dir, 'benchmarks/recorded-sources/ai-client-v1.txt'), 'tampered archive');
  await assert.rejects(checkRecordedSource(root, 'server/ai-client.mjs', hash), /archive changed/);
});
