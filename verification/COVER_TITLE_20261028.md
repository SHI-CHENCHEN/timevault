# Cover title — 2026-10-28

Only `IntroSequence.tsx` and the cover-title selectors in `chromatic-theme.css`
change application source. The two-line CYGUN wordmark retains its layout and
copy, with amethyst/indigo colour and a narrow silver-violet highlight.

The title tracks pointer position in its own bounds. Hover moves the highlight
and a small, bounded translation; leaving resets it. Click, touch and native
button keyboard activation trigger a 900 ms light pass without navigation or
account actions. Reduced-motion preferences replace motion with a static tint.

Validation:

- Client TypeScript check and GitHub Pages production export pass.
- All 101 existing tests in 17 files pass. The initial run lacked temporary
  server dependency links; restoring the existing dependency links resolved it.
- Local production UI verified: two pointer positions change light position
  (18% to 50%), click and Enter trigger the light pass, and the cover stays idle.
- The hand worker, vision bundle, hand model and SIMD WASM are byte-identical
  to commit `843e26e`. Hand/particle source, camera lifecycle, content, layout,
  vessel, clock, buttons and transaction rules are unchanged.
- No physical camera was accessed for this cosmetic update.
