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
  hand's 1/2/3 fingers for chapters and left palm to push. Physical hand identity is retained through brief label glitches using motion continuity,
  and expires after tracking loss. The right hand opens
  to disperse, closes to gather the Time Core, and pinches to pull. A relaxed right
  palm does not push; the left palm retains priority where the hands overlap.
  Camera processing stays in the browser: no camera
  recording, image upload or remote inference is implemented.

Chrome or Edge on a recent computer is recommended for WebGL and camera support.
Use the HTTPS website directly, not an embedded social-app preview. Unsupported
or denied cameras retain the existing mouse/keyboard controls.

Hand tracking shows download progress on first use and reuses the browser cache.
Slow downloads may continue while bytes arrive; startup waits for the complete
local model/runtime. Slower CPU results are accepted with a bounded age allowance. Reflection renders
only the hand field, with a lower pixel ratio and time-based particle following.
Left chapter poses require a deliberate 700 ms hold; right fist and pinch have
separate gates, and deliberate right shapes take priority over the dual-hand filament.

On supported browsers, hand detection runs in a local GPU/CPU Web Worker so it
does not block the particle animation. Only the latest frame is processed, with
one frame in flight and a 30 FPS ceiling; older browsers use the paced compatible
path. Position/open-palm filtering is time-based rather than detection-count
based. The deliberate chapter dwell/release gate is unchanged. In non-exhibition mode, Shift+D diagnostics
show inference cost, frame-to-result age and the active processing thread.

Camera delivery uses an animation-frame heartbeat, so an embedded browser's
stalled video-frame callback cannot silently stop recognition. If the worker
fails or its GPU video upload stalls, tracking retries once with direct-video
CPU inference while retaining the camera. The runtime assets stay valid for
that entire session and are released on stop or exit. If GPU tracking starts
but does not recognise a visible hand, select **COMPATIBILITY MODE** beside
the camera controls to start the direct-video path explicitly.

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
