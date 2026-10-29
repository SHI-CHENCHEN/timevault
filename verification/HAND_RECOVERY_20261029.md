# Hand Mirror frame delivery and runtime recovery

## Reproduced failures and fixes

The previous build depended exclusively on `requestVideoFrameCallback` whenever a browser exposed that method. A playing 640×480 stream with a stalled callback produced zero inference and then `VIDEO_NOT_READY`. The final build uses a cancellable animation-frame heartbeat plus the existing single-flight, 30 FPS pacer. It prefers the compositor frame counter when `currentTime` is frozen, and keeps duplicate-frame suppression.

The previous detector fell back only during initialization. A worker frame timeout, ImageBitmap/video-upload failure or lost GPU context after initialization instead stopped the camera. Bitmap creation itself also had no timeout. The detector now bounds bitmap capture and retries once on a direct-video CPU backend, retaining the stream and sampling the current frame after recovery. It does not retry cancellation or concurrent requests. The session's local model/WASM URLs remain alive until stop, so later CPU initialization can use them. Late bitmaps, late initialization and repeated cleanup safely release resources.

An explicit **COMPATIBILITY MODE** button also lets a visitor choose direct-video CPU inference when a GPU runtime starts but does not recognise a visible hand. This restarts local tracking with the existing camera permission. Manual chapters remain available.

## Validation

- 109 tests in 18 files pass. Regression cases cover absent video callbacks, a frozen video clock, worker failure/timeout, a browser that never resolves bitmap capture, CPU recovery, cancellation, resources arriving after stop and idempotent disposal.
- Client/shared/server TypeScript checks and ordinary client/server, standalone and GitHub Pages builds pass.
- The actual production app was tested with its real MediaPipe model and a generated canvas MediaStream using Google's public `pointing_up.jpg` and `right_hands.jpg` fixtures. No fake landmarks or simulator results supplied the recognition checks.
- In the old build, a deliberately stalled video callback stopped inference. With the fix, the same stalled-callback scenario detects a hand. A deliberately injected GPU frame failure then recovers to CPU and reports HAND MIRROR ACTIVE at approximately 10–19 FPS during the recovery checks (performance varies by viewport and host load).
- A mirrored pointing fixture, reacquired after hand loss, triggered physical LEFT / 01 NOTICE and changed the manually selected GATHER chapter to NOTICE. A right-hand open fixture produced RIGHT / DISPERSE. Removing the fixture restored SEARCHING FOR HANDS / 0 OF 2.
- Normal GPU startup and the explicit compatibility button were also exercised in the final build. The old generated track ended on restart, and CPU tracking resumed on the new track.
- Stop released generated tracks; a denied-camera fixture showed CAMERA_DENIED with Retry available. Allowing the fixture again and choosing Retry restarted recognition. Leaving Reflection also releases tracking.
- Browser layout checks covered 1440×900, 1920×1080, 2560×1440 and 390×844. The existing narrow-screen scroll makes camera controls reachable; document width remained 390 pixels.
- Reserve stayed 30 minutes, recovered time stayed zero and fragment count stayed six. No exchange was performed.
- The CSS bundle, cover sculpture, hand mathematics, physical identity mapping, particle field, model, WASM and worker bundles are unchanged from the previous release. Test fixtures and fault injection are outside the published source/assets.

These checks reproduce software failure paths matching the reported symptom. They do not establish which path occurred on the visitor's device. No user's physical camera was accessed, recorded or uploaded; real-camera hardware, lighting and OS permissions remain device-dependent.

Public fixture sources: https://storage.googleapis.com/mediapipe-assets/pointing_up.jpg and https://storage.googleapis.com/mediapipe-assets/right_hands.jpg. API reference: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js.
