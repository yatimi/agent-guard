<!-- Author: Tommy -->
# Judge reproduction checks

Verified locally on 2026-11-03, Node 26.3.0 / macOS arm64. The default `demo`/`dev` path is recorded and offline; `dev:live` remains explicit and separate.

- 77 JavaScript tests passed, including demo mutation refusal, no client-network/signing capability, index aliases, no journal writes and fresh-build provenance tampering.
- Historical replay verified 15 recorded model outputs and 14 validator controls without a model call. Three incident recordings were recomputed and checked.
- Chrome passed the existing 26 recovery/rendering fixtures plus four judge-demo groups (case switching, separate evidence identities, responsive/reload/simulation behavior, only local GETs/no exceptions).
- 20 Rust unit tests, format and clippy passed. Five local Sandbox runtime cases passed through the new build-provenance gate.
- Production contract source/Cargo dependencies and live deployment pin were unchanged. The local fresh WASM matched the historical deployed SHA; Linux byte equality is deliberately not assumed because compiler paths are embedded.

A separate temporary Git repository was created containing only the public candidate files, then cloned with no `.env`, `.local`, target directory or personal state. Verification/browser commands were run with an empty environment except PATH. The published remote clone and GitHub Actions run are checked separately; see the Actions link below for authoritative current status.

Four read-only review roles found and closed three issues: case-insensitive index URLs showing the live form in demo mode, browser cleanup using the wrong debugging port, and a Mac-specific WASM hash blocking fresh Linux runtime tests. Focused re-review accepted the fixes. These are agent reviews, not an independent audit.

The build record binds reviewed source hashes, Rust 1.86.0, the build command and the current artifact. It is a trusted local consistency record, not an external attestation. Historical deployed byte hashes and live guards remain unchanged. Existing runtime evidence stays historical; new runtime output is temporary and separately identifies its artifact.

Screenshots were inspected and remain in OS temporary directories outside the repository. No project secrets, signed transactions or screenshots are added to the public candidate. No new AI call, testnet/mainnet signing, deployment or submission was made for this milestone.

[Current GitHub Actions results](https://github.com/yatimi/agent-guard/actions/workflows/verify.yml) · [Judge instructions and limitations](JUDGE.md).
