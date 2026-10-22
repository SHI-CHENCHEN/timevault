# TIMEVAULT colour refresh — 2026-10-22

The near-black interface hid secondary text and controls. The presentation now
uses an illuminated amethyst cover, silver-white typography, lilac primary
actions and a separate ice-blue palette for reclaiming time. Selection dials,
receipts, processing, protected time, the archive and Reflection share clearer
text, borders and selected states. Existing page layouts and copy are retained.

Source changes are limited to `client/src/chromatic-theme.css` and its import in
`client/src/main.tsx`. The generated `/docs` export is rebuilt for GitHub Pages.
There are no dependency or package-lock changes.

## Verification

- All 74 existing tests passed across 13 files.
- Client, shared and server TypeScript checks passed. GitHub Pages production
  build passed; the existing Three.js chunk-size advisory remains.
- Native Chrome visual inspection covered the public baseline and local cover,
  violet selection, confirmation, processing, blue selection, archive and manual
  Reflection. Camera stayed off in the separate localhost QA account.
- Local demo flow: store 15 minutes, reserve 30 → 45; reclaim 15 minutes,
  completion returns to reserve 30 and total recovered 15. History retained
  separate store/reclaim records. The public-origin account was not transacted.
- Representative solid-colour text contrast: secondary on the brightest regular
  violet background 5.77:1; blue secondary text 4.52:1; hand-panel text 9.07:1;
  primary-button text 8.75:1. These samples are not a full accessibility audit
  of animated gradients, translucent layers or every small caption.
- Hand-tracking source, particle-motion source, DigitalOrbit, deployed worker,
  hand model and WASM are byte-identical to the previous publication. No
  camera permission or real-hand acceptance test was performed for this change.
- Existing responsive layouts are unchanged; no physical-phone test was run.

The earlier Sites-hosted copy and the parent design workspace are not published
by this GitHub-only update.
