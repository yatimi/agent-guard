// Author: Tommy
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArgs, sha256, verifyBuild } from '../runtime-tests/build-provenance.mjs';
const project = fileURLToPath(new URL('../', import.meta.url));
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'agentguard-build-test-')); t.after(() => rm(root, { recursive: true, force: true }));
  const pins = JSON.parse(await readFile(join(project, 'runtime-tests/production-source.json'), 'utf8'));
  for (const name of ['runtime-tests/production-source.json', ...Object.keys(pins.sources)]) { await mkdir(dirname(join(root, name)), { recursive: true }); await writeFile(join(root, name), await readFile(join(project, name))); }
  const wasm = Buffer.from('test-only-different-host-artifact');
  const manifest = { schema: 1, command: buildArgs, compiler: 'rustc 1.86.0 fixture', wasmSha256: sha256(wasm), sources: pins.sources };
  await mkdir(join(root, 'target')); await writeFile(join(root, 'target/contract-build.json'), JSON.stringify(manifest));
  return { root, wasm, manifest };
}
test('runtime provenance distinguishes a fresh same-source artifact from the deployed byte hash', async t => {
  const f = await fixture(t); const result = await verifyBuild(f.root, f.wasm);
  assert.equal(result.matchesDeployedArtifact, false); assert.equal(result.wasmSha256, sha256(f.wasm)); assert.ok(result.deployedWasmSha256);
  await assert.rejects(verifyBuild(f.root, Buffer.from('replaced')), /Artifact changed/);
  await writeFile(join(f.root, 'contract/src/lib.rs'), 'changed');
  await assert.rejects(verifyBuild(f.root, f.wasm), /Contract source changed/);
});
test('runtime rejects a mismatched build record, compiler or missing manifest', async t => {
  const f = await fixture(t); const path = join(f.root, 'target/contract-build.json');
  await writeFile(path, JSON.stringify({ ...f.manifest, compiler: 'rustc 9.0.0' }));
  await assert.rejects(verifyBuild(f.root, f.wasm), /Unexpected WASM compiler/);
  await writeFile(path, JSON.stringify({ ...f.manifest, command: ['build'] }));
  await assert.rejects(verifyBuild(f.root, f.wasm), /pinned WASM command/);
  await writeFile(path, JSON.stringify({ ...f.manifest, sources: {} }));
  await assert.rejects(verifyBuild(f.root, f.wasm), /Source changed after/);
  await rm(path); await assert.rejects(verifyBuild(f.root, f.wasm), { code: 'ENOENT' });
});
