# Hand interaction latency update — 2026-10-19

Scope: the GitHub Pages publication. No visual redesign, handedness remapping,
chapter gesture change, transaction logic, camera upload or model replacement.

## Causes and changes

- A 52 ms gate on 24–30 FPS video skipped alternate frames. A fresh-frame pacer
  now accepts up to 30 FPS, permits only one in-flight inference and drops frames
  received while busy. Slow main-thread fallback yields more time to animation.
- Synchronous MediaPipe inference shared the animation thread. A bundled classic
  Web Worker now runs the pinned local model/WASM with GPU, then CPU fallback.
  Unsupported workers fall back to the compatible detector; no CDN is required.
- Fixed per-detection coefficients compounded delay at low inference rates.
  Continuous signals now use 22–65 ms time constants, with stationary palm jitter
  filtering, immediate acquisition, no overshoot and gradual hand-loss decay.
  Chapter confidence, warmup, dwell, cooldown and neutral-release rules remain.
- Particle hashes and shared filament/trail calculations are precomputed rather
  than repeated for every particle every animation frame. Shape targets, colours,
  particle budget, force formulas and reduced-motion mode are retained.
- Obsolete results (>300 ms) and results from before a hidden-tab transition are
  discarded. Stop/exit/abort terminates the worker and releases pending frames.

## Browser measurements

Chrome on this Mac, production-bundled worker, 640×480 synthetic video at 30 FPS
from Google's public `right_hands.jpg` test fixture; 10-second runs, both hands
detected. This isolates inference/scheduling and is **not** an end-to-end camera
latency measurement or a full-scene FPS guarantee.

| Metric | Original synchronous + 52 ms gate | Background + fresh-frame pacer |
| --- | ---: | ---: |
| Accepted inference FPS | 14.8 | 26.1 |
| Median inference cost | 28.7 ms | 27.5 ms |
| Median frame-to-result time | 28.8 ms | 28.5 ms |
| P95 frame-to-result time | 36.9 ms | 33.7 ms |
| Animation callback FPS (120 Hz display) | 90.1 | 120.1 |
| P95 animation frame interval | 25.2 ms | 9.2 ms |

The model itself has not become instantaneous: the benefit is denser fresh input,
less smoothing lag and removing inference stalls from the animation thread.
Pure response tests reach >90% of an openness step within approximately 100 ms
of sample time (12/24/30/60 Hz), excluding capture/inference/render latency.

An additional 12,000-particle CPU microbenchmark (500 updates, first 100 excluded,
identical dual-hand input and stubbed text canvas, no WebGL rendering) reduced
median update time from 3.946 ms to 1.793 ms and P95 from 5.770 ms to 2.782 ms.
These measurements isolate the math optimisation; they are not full-scene FPS.

## Validation

- Timing tests cover 24/25/30/60 FPS pacing, duplicates, backpressure, slow
  compatibility mode, stale timestamps, stationary jitter and bounded smoothing.
- Runtime lifecycle tests cover frame timestamps/handedness, single-flight
  rejection, stop during initialization/capture, failed-worker fallback, timeout
  and idempotent cleanup. Existing gesture and transaction tests remain required.
- Final checks: 74 tests passed; client/shared/server TypeScript checks, ordinary
  client/server builds, root-path standalone build and `/timevault/` GitHub Pages
  build all passed using the installed workspace executables directly.
- Local full-scene simulator: LEFT 2 selected GATHER and retained its release
  gate; right fist selected GATHER; local reserve stayed 30 minutes. No real
  camera frames were captured. The user will test the published camera version.
- Real user-camera movement, sensor exposure delay, low-light tracking and every
  browser/device combination cannot be established by the fixture benchmark.

References: [MediaPipe Web hand guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js),
[official worker sample](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/hand-landmarker.worker.ts),
[official fixture test](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/python/test/vision/hand_landmarker_test.py).
