# Gradient cover, visible clock and continuous hand roles — 2026-10-24

## Presentation

- Reflection now takes a dedicated rendering path: the world/apparatus,
  cover vessel and selection scene are hidden, and only its particle field is
  updated. This removes the faint hourglass behind the manual and live mirror.
  The obsolete manual dial is hidden while the live field is active.
- Cover only: layered lavender, silver and ice-blue gradients respond to the
  pointer. The wordmark uses lighter violet/blue with pointer-responsive color;
  the entry action uses a lighter violet gradient. Vessel hover illumination,
  subtle buoyancy, hold/release energy and existing drag/keyboard rotation work
  together. The existing clock behind the vessel has stronger ticks and three
  visible, continuously rotating wall-clock hands. Reduced-motion is retained.
- Other page layouts, account/transaction rules, countdowns and copy are retained.

## Hand response

- A small motion-continuity tracker seeds physical identity from MediaPipe
  labels, retains it through brief label flips/duplicate labels/crossings, and
  expires it after 700 ms of loss. It never maps roles from screen halves.
- A right fist no longer becomes a pinch merely because thumb/index are close.
  Deliberate right open/fist shapes also take priority over the dual-hand filament.
  Left chapter/push and right shape/pull remain distinct; the guide explicitly
  describes physical hands and mirrored viewing.
- Chapter warmup is 650 ms and the stable-pose gate is 100 + 600 ms. Release,
  jitter tolerance and cooldown remain mandatory.
- Target following is exponential in elapsed time rather than rendered frames.
  The renderer passes full bounded elapsed time; performance adaptation can
  lower particle count and uses DPR <= 1.2 while tracking. Background inference
  transfers a frame scaled to at most 480 px, with compatible raw-frame fallback.

## Validation

- 101 tests / 17 files pass, including six identity tests (physical labels,
  swapped labels, duplicate labels, single-hand continuity, crossing, expiry),
  fist/pinch and shape/filament priority, and matching target following at
  4, 15 and 60 FPS. Client/shared/server type checks and client/server production,
  standalone and GitHub Pages builds pass, using existing local executables.
- Local production bundle inspected visually: gradient/lightened wordmark and
  entry action, visible clock, vessel rotation feedback, and no Reflection vessel.
- Actual MediaPipe GPU Worker confirmed by ready/result messages, not a simulator.
  Public official pointing/open-hand test images were drawn into a generated
  640×480 stream. Right-hand GATHER worked. A composite original/mirrored fixture
  produced two simultaneous hands with LEFT / 01 NOTICE and RIGHT / GATHER;
  it did not incorrectly override right shape with the filament. Single-hand
  sampling showed 16 FPS and the stable two-hand sample 14–15 FPS on this run;
  FPS varied under load, so these are observations rather than a device guarantee.
- Hand loss, left-hand reacquisition, Stop and exit verified with generated
  streams. No physical camera, camera frames or private landmark data was read,
  saved or uploaded. The local account stayed at its observed 45-minute reserve
  while the hand tests ran. No Arduino or physical-phone acceptance test.
- Responsive layout retains the prior viewport structure; the new clock is
  inside the existing responsive sculpture. Narrow Reflection remains scrollable.
