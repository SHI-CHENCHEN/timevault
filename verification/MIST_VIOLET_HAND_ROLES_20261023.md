# Mist violet and distinct hand roles — 2026-10-23

## Result

The interface uses a low-chroma mist-violet/silver-gray background, dark violet
type and solid primary actions. The cover's silver materials have deeper
reflections, visible glass and violet grains, plus a stronger contact shadow.
The wordmark's animated glow is removed. Existing page structures, content,
cover controls, transactions and countdown rules remain intact. A manual
Reflection page uses the light palette; its live hand canvas remains graphite
to preserve luminous particles. A previously incidental vessel silhouette is
hidden behind the manual Reflection dial.

## Hand-effect correction

Previously, a detected right palm always received a local force of 1.05. Unless
pinched, that force was repulsion, duplicating the left palm. Particle shape
thresholds also differed from the UI's GATHER/DISPERSE thresholds.

- Left: physical-left 1/2/3 chapter gestures and palm repulsion remain unchanged.
- Right: neutral palm has no local repulsion; open palm disperses; fist gathers
  the Time Core; pinch attracts nearby particles and takes priority over global
  shape changes. Left-palm repulsion wins in overlapping interaction regions.
- `handFieldPolicy.ts` is shared by the renderer, status text and camera labels.
  The panel now reports right-hand dispersion, gathering and pinch explicitly.
- The existing physical handedness mapping is retained. No label swap,
  screen-position heuristic, new model, camera capture or upload is added.
  The official Tasks graph maps Right=0 and Left=1:
  https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/hand_landmarker/hand_landmarks_detector_graph.cc

## Verification

- 84 tests passed across 15 files. Ten new cases cover shared hand policy and
  real particle-force behavior: neutral right has no push, left repels while
  right pinch attracts from the same position, and overlap retains left priority.
- Client/shared/server TypeScript checks passed. Client/server production,
  root standalone export and `/timevault/` GitHub Pages export builds passed.
  The existing Three.js chunk-size advisory remains.
- Browser inspection covered the cover at 1440×900 and 390×844. At 1920×1080 and
  2560×1440 the measured entry, navigation and vessel controls remained within
  the viewport, without horizontal overflow. These are viewport checks rather
  than physical-phone tests.
- Cover keyboard rotation and reset retained reserve 30 minutes.
- A separate local installation used a temporary database and disabled serial
  auto-connect. The deterministic simulator confirmed left 2 selected GATHER;
  right-only OPEN/FIST/PINCH reported DISPERSE/GATHER/PULL without changing the
  chapter; both hands retained TIME FILAMENT plus right PULL; stopping restored
  manual mode. Its account remained zero throughout.
- The hand model, WASM, worker, camera lifecycle, handedness math, gesture dwell,
  release/cooldown gates, inference pacing and transaction source are unchanged.
- No actual user-camera acceptance or Arduino test was performed. Existing
  deterministic permission/runtime/lifecycle tests passed; they do not establish
  real-device behavior under every lighting, occlusion or permission condition.

Only the GitHub publication checkout is deployed. The parent design workspace
and older Sites deployment are retained separately.
