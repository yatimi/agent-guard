<!-- Author: Tommy -->
# Scoped UI/UX and accessibility review

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
