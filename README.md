# TIMEVAULT

An interactive personal time reserve: a silver-violet hourglass, five-minute time
fragments, and optional local hand gestures powered by Three.js and MediaPipe.

**Website:** https://shi-chenchen.github.io/timevault/

## Explore

- Cover: drag the vessel through 360°, hold/release to energise, double-click to
  reverse the sand flow. Pause, reverse and reset controls are also available.
- Sell Time: gather fragments into your personal reserve.
- Buy Back: reclaim time and start an active-time countdown.
- History and Reflection: revisit your time and explore the Hand Mirror.
- Hand Mirror: explicitly activate the camera and allow permission. Use the left
  hand's 1/2/3 fingers for chapters, and the right hand's open/closed palm or pinch
  to affect the particle field. Camera processing stays in the browser: no camera
  recording, image upload or remote inference is implemented.

Chrome or Edge on a recent computer is recommended for WebGL and camera support.
Use the HTTPS website directly, not an embedded social-app preview. Unsupported
or denied cameras retain the existing mouse/keyboard controls.

On supported browsers, hand detection runs in a local GPU/CPU Web Worker so it
does not block the particle animation. Only the latest frame is processed, with
one frame in flight and a 30 FPS ceiling; older browsers use the paced compatible
path. Position/open-palm filtering is time-based rather than detection-count
based. The deliberate chapter dwell/release gate is unchanged. In non-exhibition mode, Shift+D diagnostics
show inference cost, frame-to-result age and the active processing thread.

The public version is standalone. Time account/history data is saved locally per
browser and origin, not shared between visitors. Previous Sites-domain data does
not automatically transfer to this GitHub Pages domain. This is an interactive
artwork, not a financial service.

## Build and publish

Requires Node.js 20+ and the pinned pnpm version in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build:github
```

Commit the generated `docs/` folder along with source updates. In repository
**Settings → Pages**, select **Deploy from a branch → main → /docs**. GitHub's
managed Pages workflow publishes that checked-in export. The `.nojekyll` marker
preserves the generated files without a Jekyll build. The app's `/timevault/` base
keeps fonts, images, MediaPipe runtime and the hand model on the correct URL.

For local server/Arduino installation development, `pnpm dev` remains available;
that server is not required or hosted by GitHub Pages. `pnpm build:site` retains
the original root-path standalone export for other static hosts.

This publication starts from the completed Sites version 23, source commit
`42bc92d65ea873634ee94482dc1b730d966f0edd`. It excludes local databases, camera
captures, environment secrets, design working files and the private source history.
