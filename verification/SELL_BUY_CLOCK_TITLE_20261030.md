# Purple SELL / ice-blue BUY, visible chronometer and interactive title

## Delivered changes

- SELL TIME uses violet-lavender glass light, purple controls and warm pale-yellow notation. BUY BACK uses an ice-blue glass field, blue-white text, pale-blue dial marks and blue controls. The existing confirmation and outcome flow keeps its mode's palette.
- The cover retains the current background asset, with a blue-to-violet color treatment and a small warm light at the edge. CSS layers tint the existing static material; no new image download, backdrop animation or renderer was added.
- The cover chronometer's outer circle and ticks have higher contrast. Its three existing time-driven hands now use tapered flat faces so their width remains visible across WebGL implementations; the hour/minute hands are silver-lilac/ice-blue and the second hand pale yellow. The same wall-clock calculation and time zone remain.
- Title light follows pointer position across a wider highlight, with a small movement and soft glow. The click/keyboard light pass lasts 1.4 seconds and restarts on repeated activation. Reduced-motion preferences retain the existing static treatment.
- Layout, content, account/transaction behavior and hand interaction are retained. New BUY theme variables/backgrounds are scoped to exchange screens, excluding Reflection and History. No changes to hand hooks, identity, gesture policy, particle field, camera lifecycle, model or WASM assets. The hand worker export remains `handTracking.worker-CMrdMn4w.js`.

## Verification

- Client/shared/server TypeScript checks pass.
- 112 tests in 18 files pass, including clock rotation, cover interaction, hand timing/identity/particle policy and transaction logic.
- Ordinary client/server, standalone and GitHub Pages production builds pass. The existing Three.js bundle-size warning remains.
- Browser checks cover 1280×720, 1440×900, 1920×1080, 2560×1440 and 390×844. The narrow layout retains its existing vertical scroll; document width remains 390 pixels.
- SELL and BUY selection views and BUY confirmation were visually checked. No confirmation was submitted. Reserve remained 30 minutes, recovered time zero and active fragments six.
- Pointer activation at opposite sides of the title changed `--title-light-x` from approximately 3.4% to 81.0%. Repeated click and Enter activation returned `data-illuminated=true` with `title-light-pass` and a 1.4-second duration.
- The running cover displays its clearer chronometer and moving hands. Clock rotation regression tests continue to pass.
- No physical camera was accessed for this presentation-only update. Hand software/assets are unchanged from the previously validated release.
