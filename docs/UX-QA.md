<!-- Author: Tommy -->
# Scoped UI/UX and accessibility review

## Mainnet evidence and support workflow pass — 2026-11-03

The default recorded demo now opens a real mainnet example: successful overall return with a failed nested execution step. The first-screen text identifies the support task and bounded diagnostic budget. The result shows the overall status beside failed-receipt count; a native disclosure opens a semantic table of non-system receipt fields with exact IDs. Text explains that rows are ordered by ID, not time, and does not infer token refunds/balances.

Verified: 28 live-flow Chrome fixtures and seven recorded-demo groups, including mainnet provenance/explorer, keyboard activation of source comparison with focus retained, checked handoff, old-case switching, mobile reflow, 200% computed-font reflow for the open Sandbox result, and no outbound requests from demo. Inspected mainnet comparison captures at 1440px and 390px; artifacts remain only in OS temp. The chosen three-ticket study protocol stays stable when demo cases are added. This is a scoped review, not a complete screen-reader/assistive-technology session or accessibility certification.

## Current incident-support pass — 2026-11-03

The selected user is now a NEAR application developer/support engineer. The result leads with “Should the customer pay again?”, followed by a conservative next manual check. A copyable support handoff uses checked transfer/failure facts only, separate from optional AI prose. Exact amounts, receipt IDs, observation time, report hash and recorded Sandbox labels are retained. It makes no complete balance, refund or retry authorization claim.

Chrome passed 26 existing recovery/live-flow fixtures and six recorded-demo check groups. Added checks cover keyboard activation of copy, denied-clipboard fallback with selected text, accessible textarea name, visible focus and copying the exact handoff. Clipboard success/denial use controlled stubs and do not overwrite the user's clipboard. The browser accessibility tree is not a screen-reader session.

Doubling **every computed font size**, including fixed-pixel fonts, at 320px with result disclosures open exposed overflow in the header and lab headings. Flexible wrapping and responsive scenario columns fixed it. The recorded-page test now passes without horizontal page overflow. This is programmatic text resizing of that state, not a complete test of every browser's text-only zoom or all product states. Desktop/mobile captures were inspected; all images remain in OS temporary folders outside the repository.

This pass does not establish external-user usefulness. [Pilot protocol](USER-VALIDATION.md) is ready but has no collected results. Actual VoiceOver/NVDA use and exhaustive accessibility certification remain unverified. The following notes are historical and retain their original scope/counts.

Reviewed 2026-11-03: primary local purchase, recovery and result, plus the free simulation's mode labels and text contrast. The intended user is an agent developer evaluating constrained spending; product usefulness with external users remains a separate open task.

| Finding | Verified evidence | Applied change |
| --- | --- | --- |
| Select's spoken name differed from its visible label | Chrome accessibility tree said “Live purchase scenario”; visible text said “Supplier response” (WCAG 2.5.3) | Native label supplies the accessible name; tree now reports “Supplier response” |
| Small text in the simulation had insufficient contrast | Example ratios: local-balance disclaimer 3.88:1; no-wallet disclaimer 4.05:1; principle labels 3.74:1 | Existing colors darkened; respective measured ratios 6.02:1, 6.02:1 and 5.37:1 |
| Page-level simulation badge preceded the live purchase | First-screen layout could suggest that the live action was free | Intro distinguishes testnet purchase and free simulation, with a direct simulation link |
| Purchase heading promised unspecified usefulness; price unit was a symbol | Copy required reading implementation details to infer the result and cost | Names the sourced snapshot, states testnet NEAR on the button, discloses gas and up to two billed AI requests |
| Long narrative preceded all measurements on mobile | Inspected 390px result capture | Measurements now precede the AI narrative |

Decorative glyphs are hidden from the accessibility tree. The select border is darker; disabled buttons no longer imply that waiting alone will resolve every blocked state. Existing native controls, layout and visual style remain.

## What passed

`node scripts/check-browser.mjs` passed **19 Chrome fixture checks**, including:

- Lost response, refresh, missing-request retry, interruption and unresolved-payment recovery.
- 320/390/768/1440 widths without horizontal page overflow; doubled root font size and WCAG text-spacing overrides at 390px.
- Keyboard movement through the purchase controls, visible focus, and reduced motion.
- Accessible select name and 126 eligible visible opaque-text samples on the initial screen meeting their AA text-contrast threshold.
- Model output remains text; no uncaught browser exceptions.

All **43 JavaScript tests** also passed. Desktop and mobile captures were inspected; all images and raw browser reports remain only in OS temporary folders outside the repository.

## What this does not establish

The contrast scan covers sampled visible opaque text on the initial screen, not every pseudo-element, composited layer or future state. The accessibility tree is not a VoiceOver/NVDA user session. Doubling the root font does not double every fixed-pixel font. Full text-only 200% scaling, exhaustive keyboard/target-size coverage, screen-reader use and performance measurements remain open. No complete WCAG certification or overall design score is claimed. External user feedback and the practical value of paying for a six-block public-data snapshot remain unvalidated.
