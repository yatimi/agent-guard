// Author: Tommy
// Records a fresh local artifact separately from the historical deployed hash.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { sourceHashes, sha256, buildArgs } from '../runtime-tests/build-provenance.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const before = await sourceHashes(root);
const compiler = spawnSync('rustup', ['run', '1.86.0', 'rustc', '-Vv'], { cwd: root, encoding: 'utf8' });
if (compiler.error || compiler.status !== 0) throw new Error('Install Rust 1.86.0 and put rustup/cargo on PATH; see docs/JUDGE.md.');
const result = spawnSync('cargo', buildArgs, { cwd: root, stdio: 'inherit' });
if (result.error || result.status !== 0) { console.error(result.error?.message || 'Contract build failed'); process.exit(1); }
const after = await sourceHashes(root);
assert.deepEqual(after.sources, before.sources, 'Source changed during compilation');
const wasm = await readFile(join(root, 'target/wasm32-unknown-unknown/release/agent_guard.wasm'));
const record = { schema: 1, builtAt: new Date().toISOString(), command: buildArgs, compiler: compiler.stdout.trim(), platform: `${process.platform}-${process.arch}`, sources: after.sources, wasmSha256: sha256(wasm) };
await mkdir(join(root, 'target'), { recursive: true });
await writeFile(join(root, 'target/contract-build.json.tmp'), JSON.stringify(record, null, 2) + '\n');
await rename(join(root, 'target/contract-build.json.tmp'), join(root, 'target/contract-build.json'));
console.log(`Local WASM SHA-256: ${record.wasmSha256}. Build provenance: target/contract-build.json`);
console.log('This build does not deploy or change the expected live contract hash.');
