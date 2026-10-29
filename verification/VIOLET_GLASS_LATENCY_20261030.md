# TIMEVAULT: violet glass atmosphere and responsive hand field

## Visual changes

The cover uses deep violet/indigo shadows, broad translucent glass folds and silver-lavender light. Large type stays silver-violet with the existing pointer light and click illumination. Pale yellow is restricted to the link indicator, small navigation indices and the entry button's small circular detail. The desktop vessel is 12.5% larger on wide screens and approximately 10% larger on narrower landscape screens. Its drag, energise, hold, reverse and reset controls and moving chronometer are retained. The title is slightly smaller to balance the cover; phone vessel sizing is unchanged.

Selection, confirmation, outcomes, reserve home, archive and the three reflection chapters share the material with quieter opacity and framing. An explicit reset of older hidden/blackened background rules makes the material visible in the interior screens. The live hand field uses a quieter backdrop. No new animation loop, animated backdrop, canvas renderer, blur filter or network service is introduced.

Contents, account state, transaction semantics, hand identity mapping, gesture thresholds, chapter dwell/cooldown and particle forms are retained. SELL remains violet and BUY retains its cool blue distinction.

## Latency changes

- Worker input has a maximum edge of 320 pixels, preserving orientation and aspect ratio. Capture timeouts, single-flight inference and resource cleanup remain.
- Six consecutive GPU detections costing more than 100 ms trigger one attempt at a CPU **worker**. This avoids competing with the Three.js field on a persistently slow GPU while keeping CPU inference off the rendering thread. Fast GPU use is retained. Existing direct-video CPU recovery remains available if the worker fails.
- The direct-video CPU pacer yields one display frame after inference instead of an additional 50% of inference time.
- Palm smoothing adapts between 14 and 34 ms; other continuous hand values use 28 ms by default. Small stationary jitter remains filtered.
- Hand-field convergence increases from an exponential rate of 9/s to 22/s. The regression check verifies convergence within 150 ms.
- The existing deliberate 700 ms left-hand chapter hold is unchanged. Physical LEFT still selects chapters/pushes; RIGHT still disperses, gathers or pulls.

## Verification

- 112 tests in 18 files pass. New regression cases cover the sustained slow-GPU to CPU-worker transition, the CPU pacing interval, resized frame dimensions and hand-field convergence. Existing camera, identity, chapter, particle policy, recovery and transaction tests pass.
- Client, shared and server TypeScript checks pass. Ordinary client/server, standalone and GitHub Pages production builds pass. The existing Three.js bundle-size warning remains.
- Real MediaPipe model results were exercised using a generated canvas MediaStream displaying Google's public hand fixtures, not fake landmarks. The adaptive switch to a CPU worker was observed. At 1440×900 the sample reported about 19 FPS and approximately 48–50 ms mean worker round-trip cost; heavier concurrent viewport/render load produced roughly 13 FPS and 68–76 ms. These measurements are local observations, not a universal hardware performance guarantee.
- A mirrored pointing fixture, reacquired after loss, changed GATHER to NOTICE with LEFT / 01 NOTICE. The right-hand open fixture retained RIGHT / DISPERSE. Stopping tracking releases the generated stream. No user's physical camera was accessed or recorded.
- Desktop cover checks cover 1280×720, 1440×900, 1920×1080 and 2560×1440; phone checks cover 390×844. Selection, confirmation, BUY, archive and all three reflection chapters were checked. The background is visible, title illumination works, and controls remain reachable.
- No exchange was performed during the visual checks. Reserve stayed 30 minutes, recovered time zero and active fragments six.
- Test fixtures, generated camera streams and instrumentation are outside the repository and are not in the published export.

Public fixture sources: [pointing hand](https://storage.googleapis.com/mediapipe-assets/pointing_up.jpg), [right hands](https://storage.googleapis.com/mediapipe-assets/right_hands.jpg). Runtime API reference: [Google Hand Landmarker web documentation](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

## Generated background provenance

- Mode: new image generation using the built-in imagegen tool; no external service, local generation model or API key.
- Final generated PNG: `/Users/jojo/.codex/generated_images/01a163d9-d450-7070-8dc3-661b50927106/exec-72975914-d4d4-4ecb-b9b3-7063108e1b3b.png`.
- Web asset: `client/public/images/time-ether-v2.jpg`, exported as JPEG at quality 76; 169,676 bytes (about 166 KiB). Published copy: `docs/images/time-ether-v2.jpg`.
- Earlier exploratory background was not included in the final export.

Exact final prompt:

> Use case: stylized-concept. Create only a static 16:9 background for the TIMEVAULT interactive art installation website, no text or UI. Art direction: sophisticated dreamlike nocturnal light installation, predominantly DEEP VIOLET, blue-violet, smoky lavender and midnight indigo, matching the atmospheric soft purple backgrounds of an oracle installation design board. This must feel like projected light through sculptural frosted glass in a dark gallery, never like outer-space wallpaper. Large slow soft folds of translucent violet glass and silk refract a few broad cool silver-lilac light beams diagonally across the far edges. On the upper right, an out-of-focus sculptural membrane bends light into soft luminous lavender ribbons; at the lower left, diffuse violet-blue volumetric haze. Strong depth, broad tonal masses, dark velvet shadows and pearlescent light, restrained fine film grain. Palette midnight #09091f, deep violet #211244, plum indigo #392765, smoky lavender #7b6aab, periwinkle pearl #b4b3dc, deep blue #171d41. The central 12–82% must remain a quiet dark violet stage suitable for superimposed white type and an existing bright metallic hourglass. More depth and purple light than a simple flat gradient; fewer and larger forms than a busy image. Absolutely NO stars, starfields, celestial bodies, sparkles, dotted dust, fine tangled fibers, webs, lightning, visible literal objects, trees, hourglasses, clocks, symbols, circles, rings, text, logos, bright white patches, yellow or gold (yellow accents will be provided by UI code). Dark, enigmatic, immersive, dreamy, beautifully controlled light and shadow. Not pale, not pastel, not sugary, not a busy galaxy. Landscape full-bleed background image only.
