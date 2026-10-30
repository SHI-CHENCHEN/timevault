# Quiet dreamlike atmosphere, distinct modes and a non-overlapping cover

## Changes

- The supplied nebula reference was edited to soften its heavy left-hand ultramarine. The versioned JPEG is restricted to the cover's quiet peripheral atmosphere at 32% layer opacity with a softer central mask; the user's original file is untouched. Text, the vessel and the entry action carry the strongest contrast.
- SELL has a muted violet surface, lavender selection state and pale-purple controls. BUY has a separate cool-blue surface, ice-blue selection state and pale-blue controls. Their confirmation/outcome palettes follow the same mode. Fine glass texture is limited to the edges at 18–20% opacity; the central instruments and text remain quiet and legible.
- The cover follows existing pointer variables with restrained composited parallax and a low-intensity light pool. Existing click feedback produces a soft fading ripple. These effects are cover-only and disabled for reduced-motion preferences.
- The vessel and its notes share one grid. The hint, buttons, exploration disclaimer and poetic caption use normal flow instead of independently positioned blocks. The Three.js vessel fits the measured control region, leaving room for the notes. A quiet translucent backing keeps the notes readable without competing with the vessel.
- Title light/click interaction and the moving chronometer remain. Reflection styling, camera code, physical hand roles, particle forms, gesture timing, model and WASM assets remain unchanged.

## Verification

- 112 tests in 18 files pass, including cover exploration, clock rotation, hand policy/identity/timing, camera recovery and transaction behavior.
- Client/shared/server TypeScript checks and ordinary client/server, standalone and GitHub Pages builds pass. The existing Three.js bundle-size warning remains.
- Browser layout checks cover 1440×900, 1920×1080, 2560×1440, 1280×720 and 390×844. Document width matches viewport width.
- The measured hint-to-caption gap is 12 px where the caption is shown. On the shorter 1280×720 layout, notes end 18 px before navigation. On 390×844, notes end 34 px before the entry button. The control region and hint are separated by 11–13 px.
- Pausing changes HOLD FLOW to RESUME FLOW; reversing changes REVERSE FLOW to FLOW FORWARD; Reset restores both. The account remains 30 reserve minutes, zero recovered minutes and six fragments. No exchange was confirmed.
- Pointer checks moved the cover light position from about 28% to 90%; the background transform changed with it. The existing click feedback remains functional.
- No physical camera was accessed. Hand software/assets are unchanged, including `handTracking.worker-CMrdMn4w.js`.

## Background provenance

- Mode: built-in imagegen edit of the user's supplied nebula image, preserving the original file.
- Generated PNG: `/Users/jojo/.codex/generated_images/01a163d9-d450-7070-8dc3-661b50927106/exec-5f07849d-c12f-494c-99cd-6849f5d29ed2.png`.
- Project asset: `client/public/images/time-nebula-v3.jpg`; exported JPEG, quality 76, 319,364 bytes (about 312 KiB). Public copy: `docs/images/time-nebula-v3.jpg`.
- Supporting reserve/history views use subdued glass texture. Reflection retains its prior appearance and interaction.

Exact edit prompt:

> Edit the supplied nebula background for the TIMEVAULT website. Change color and lighting only: retain its wide landscape composition, diagonal flowing ribbons, nebular structure and dreamy mysterious atmosphere. The left third is currently too dark, saturated and heavy ultramarine. Replace that oppressive cobalt-blue area with a much softer luminous mist-blue and lavender-periwinkle atmosphere, and lift the dark midtones across the image. Aim for a refined medium-tone silver-blue / pale amethyst nebula, airy and translucent, still enigmatic with selective indigo shadows. The reference should feel noticeably lighter and less saturated than the original, with pearlescent light blue and pale lilac flowing through the ribbons. Keep the finest stars subtle rather than glittery; slightly reduce their contrast. Preserve depth and layered flowing light, no flat washed-out pastel fill, no black-heavy left block, no strong cyan or teal, no orange/pink, no neon rainbow. Avoid blown-out white bands: highlights should remain softly pearlescent. This will sit behind UI text and an existing metallic hourglass, so keep the left-middle typography area relatively calm with broad soft forms, no new objects, no text, logos, symbols, clocks or hourglass. Output the edited backdrop alone, same wide composition.
