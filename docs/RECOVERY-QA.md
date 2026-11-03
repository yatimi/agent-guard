<!-- Author: Tommy -->
# Purchase recovery checks

Verified on 2026-11-03 with Node 26.3.0 and Chrome 156.0.8078.80. These checks use local stand-ins. They do not spend testnet NEAR, call a paid model, or establish new onchain runtime behavior.

## Process and HTTP tests

```sh
npm test
```

The initial recovery milestone passed 21 tests. The later reviewed version passes 43 tests, including four process/HTTP integration tests in `tests/recovery-http.test.mjs`. The test runner launches isolated child servers with empty environments, fake signing/model/RPC adapters, temporary journals and random loopback ports. It sends actual HTTP requests and kills its own child with SIGKILL at controlled boundaries.

| Interruption or race | Observed result |
| --- | --- |
| Kill during the broadcast call, after saving signed bytes | A fresh process reads the original hash, verifies the fixture receipt, and completes; one signature and one broadcast in total |
| Kill while waiting for the proposal, before signing | Recovery stops the run with `INTERRUPTED_BEFORE_PAYMENT`; zero signatures or broadcasts, no repeated model request |
| Kill while summarizing, after proof was saved | The dataset remains available; recovery uses a fallback summary without another model request or payment |
| 16 concurrent create requests, plus a competing server | One pending payment; lock contention cannot overwrite its journal; recovery uses the same hash |

The tests also exercise stale CSRF token rejection after restart, a foreign Origin, scenario changes under the same ID, and reopening a completed run. The provider's real failure timing and actual chain execution are separate concerns; the existing live evidence remains in `live-purchase.json` and `../web/testnet-evidence.json`.

## Optional browser checks

Use a dedicated Chrome instance with a temporary profile and loopback debugging port 9229. Keep personal browser profiles separate. For example, on macOS, launch this in another terminal and close it when finished:

```sh
agentguard_browser_profile=$(mktemp -d /tmp/agentguard-browser.XXXXXX)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --user-data-dir="$agentguard_browser_profile" \
  --remote-debugging-address=127.0.0.1 --remote-debugging-port=9229 \
  --no-first-run --no-default-browser-check about:blank
```

Then run:

```sh
node scripts/check-browser.mjs
```

The script uses Node builtins and Chrome's debugging protocol; no browser package is installed. It serves the actual web assets on a random local port, uses explicitly labeled API fixtures and the public recorded dataset, and never loads Keychain, `.env`, the live executor, or an AI credential. It closes its own tab and test server. Reports and screenshots go to a unique `agentguard-browser-qa-*` directory in the operating system temporary folder; the command prints its path. Screenshots must never be stored in this repository, including ignored directories. If the system temporary folder resolves inside the checkout, the script refuses to run.

Sixteen browser checks passed: lost creation response; refresh while pending; restart recovery; completed refresh; model text escaping; widths 1440, 768, 390 and 320 pixels; doubled root font size at 390 pixels; keyboard focus; reduced motion; retry after a request did not reach the server; pre-payment interruption; unresolved payment; and no uncaught browser exceptions. The desktop/mobile screenshots of the completed panel and paid dataset were inspected. The browser may retry a dropped HTTP connection itself; every retry retains the original purchase ID.

This is not a full accessibility audit. Screen-reader behavior and comprehensive contrast/text-zoom testing remain open. The contract and WASM were not changed by this recovery work.

## Separate live browser run

After the fixture checks, one new purchase was completed through the actual local browser interface, NEAR AI and testnet executor. The page was refreshed while it displayed the pending payment, then reached verified delivery and an AI summary. A second refresh reopened the same purchase without another payment or model reservation. Desktop and 390-pixel screenshots were inspected.

Public evidence: [live-browser-purchase.json](live-browser-purchase.json), including the invoice, dataset, proof, refresh checks and SHA-256 hashes of the exercised source. Transaction: [BeXdyg4jBTzqHtaKs3Xm5LEsxUHqZXeGqR1wRTFB8i6T](https://testnet.nearblocks.io/txns/BeXdyg4jBTzqHtaKs3Xm5LEsxUHqZXeGqR1wRTFB8i6T). The supplier received 0.01 testnet NEAR. This run tested browser refresh on the real path; the process-kill scenarios above still use controlled local dependencies, not a deliberately interrupted live transaction.

## Review follow-up

The 2026-11-03 source review and fixes expanded the suite with six real child-process lock checks, five browser-module recovery checks, and five preflight boundary checks. All 43 tests pass. The sixteen Chrome checks above also pass on the reviewed web module; desktop and mobile captures were inspected and remain outside the checkout. The browser-module tests use controlled DOM/API fixtures, while the Chrome checks exercise the real layout. Detailed scope: [REVIEW-QA.md](REVIEW-QA.md).

The subsequent scoped UI review expanded the Chrome script to 19 checks, adding measured opaque-text contrast, accessible label matching and text-spacing reflow. See [UX-QA.md](UX-QA.md).
