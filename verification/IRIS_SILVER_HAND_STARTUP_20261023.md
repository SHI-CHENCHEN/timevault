# Iris / titanium silver and working hand startup — 2026-10-23

## Changes

The mist-plum wash is replaced with a denser titanium-blue/silver background,
deep iris type and solid violet primary actions. The vessel retains its silver
and violet material. A focused cool highlight separates it from the backdrop.
The wordmark's old animated pseudo-element glints are disabled so letters do
not wash out. The camera activation has a solid, legible primary treatment.
Page structure, content, transaction rules and gesture roles are preserved.

Two code paths could produce an open camera without a useful hand response:

- A model body had an 18-second deadline; the worker had 25 seconds including
  another large WASM download. The prior live-network check timed out after
  30 seconds with only part of each public file received. Assets now download
  with byte progress, browser-cache reuse and a 60-second **inactivity** timeout
  refreshed by each chunk. Downloading is completed before detector startup.
  The pinned model is validated, matching SIMD/non-SIMD WASM is selected by
  MediaPipe, its magic is checked, and local session Blob URLs provide the
  downloaded loader/WASM to both the worker and compatible main-thread path.
  Stop, exit and failed sibling transfers abort outstanding downloads. Blob
  URLs are revoked after detector initialization. Only public runtime assets
  are downloaded; frames and landmarks never enter these caches.
- Every result older than 300 ms was discarded, including an otherwise valid
  result from a slower CPU. The bounded freshness allowance now accounts for
  measured inference time (up to 1.2 seconds), while continuing to reject
  queued, hidden-tab and future-dated results. One in-flight frame is retained.
  Sustained delays now produce a visible performance recovery hint.

## Verification

- 92 tests / 16 files pass. New cases exercise a progressing 100-second
  download, a genuinely stalled transfer, cancellation during a partial body,
  missing/invalid assets, Blob lifetime, prepared-runtime worker forwarding,
  and acceptance of slow inference without admitting old queued results.
- Client, shared and server TypeScript checks pass. Production client/server,
  standalone and `/timevault/` GitHub Pages exports pass. Commands used the
  existing local executables directly, equivalent to package scripts, because
  this host's pnpm launcher tried to reinstall dependencies before running.
- Real MediaPipe initialized and inferred three generated canvas frames.
- The actual production app then consumed a generated 640×480 MediaStream,
  using the real model and official public MediaPipe hand test photographs:
  https://storage.googleapis.com/mediapipe-assets/pointing_up.jpg
  https://storage.googleapis.com/mediapipe-assets/right_hands.jpg
  https://storage.googleapis.com/mediapipe-assets/thumb_up.jpg
  The original pointing hand was detected as right with GATHER feedback.
  Mirroring the fixture yielded left/01 NOTICE and changed a manually selected
  GATHER chapter back to NOTICE after dwell. Open-hand imagery produced right
  DISPERSE. Removing the image restored SEARCHING FOR HANDS / 0 of 2.
- The production UI correctly handled generated permission denial and missing
  hardware; Retry returned to live inference. Stop and leaving Reflection
  changed all synthetic video tracks to `ended`. Reserve stayed 30 minutes,
  recovered stayed zero and active fragments stayed six throughout these tests.
- Responsive iframe viewports cover 1440×900, 1920×1080, 2560×1440 and 390×844;
  document width equals viewport width. Mobile Reflection retains its existing
  vertical scroll for the activation panel and controls.
- No user's physical camera was accessed, recorded, uploaded or screenshotted.
  These are actual-model/fixture and viewport tests, not physical-camera,
  physical-phone or Arduino acceptance tests.

Only the isolated GitHub publication checkout is published. The parent design
workspace and older Sites publication are not overwritten.
