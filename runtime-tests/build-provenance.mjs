// Author: Tommy
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
export const sha256 = data => createHash('sha256').update(data).digest('hex');
export const buildArgs = ['+1.86.0', 'build', '-p', 'agent-guard', '--target', 'wasm32-unknown-unknown', '--release', '--locked', '--target-dir', 'target'];
export async function sourceHashes(root) {
  const pins = JSON.parse(await readFile(join(root, 'runtime-tests/production-source.json'), 'utf8'));
  const sources = {};
  for (const name of Object.keys(pins.sources)) sources[name] = sha256(await readFile(join(root, name)));
  return { pins, sources };
}
export async function verifyBuild(root, wasm) {
  const manifest = JSON.parse(await readFile(join(root, 'target/contract-build.json'), 'utf8'));
  const { pins, sources } = await sourceHashes(root);
  assert.equal(manifest.schema, 1, 'Unsupported contract build record');
  assert.deepEqual(manifest.command, buildArgs, 'Build must use the pinned WASM command');
  assert.match(manifest.compiler, /^rustc 1\.86\.0 /, 'Unexpected WASM compiler');
  assert.deepEqual(sources, pins.sources, 'Contract source changed: review runtime assumptions and production-source.json first');
  assert.deepEqual(manifest.sources, sources, 'Source changed after the recorded build');
  assert.equal(manifest.wasmSha256, sha256(wasm), 'Artifact changed after the recorded build');
  return { ...manifest, deployedWasmSha256: pins.deployedWasmSha256, matchesDeployedArtifact: manifest.wasmSha256 === pins.deployedWasmSha256 };
}
