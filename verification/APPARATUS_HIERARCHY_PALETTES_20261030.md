# TIMEVAULT: apparatus hierarchy and separate exchange palettes

## Changes

- Cover stage widened from 41% to 47% of the viewport and moved upward. Less supporting copy within the stage gives the existing, measured Three.js vessel and clock more height; no renderer or scene logic changed.
- Removed the large surrounding notes panel. The two compact control rows remain directly below the vessel. Secondary explanatory copy sits in a separate footer aligned with the bottom navigation, without collisions at tested sizes.
- Coloured lavender-to-ice-blue title retains its pointer light, click light pass, focus and keyboard interactions. The cover has restrained cool atmospheric light.
- SELL uses amethyst glass, silver-lavender type and a pale violet primary action. BUY uses ice-blue glass, cool white type and a pale blue primary action. A quiet curved glass edge and peripheral light give depth without covering the copy or dial. Both selection and confirmation pages were inspected.
- All copy and controls retained. Camera, physical hand roles, gesture timings, particle mapping and Reflection styling remain unchanged. No new image assets or tracking dependencies.

## Validation

- Client, shared and server TypeScript checks passed.
- 112 tests across 18 files passed, including hand identity, runtime, timing, inference and particle policy tests.
- Standard client/server build, standalone build and GitHub Pages build passed. Existing Three.js vendor-size warning remains.
- No source changes under client/src/hooks, client/src/visual, shared or server. Existing exported hand worker remains handTracking.worker-CMrdMn4w.js; model and WASM assets unchanged.
- Cover inspected at 1440×900, 1920×1080, 2560×1440, 1280×720 and 390×844. Notes have no border or background. At 1440×900, control area is 56.5px high; vessel stage is 672.5px high; controls end 14px before bottom navigation begins. Footer starts 28.8px to the right of navigation. At 390×844, controls end 34px before entry action begins.
- HOLD / RESET and title light pass were exercised. SELL and BUY selection→confirmation, home navigation, and NOTICE/GATHER/RETURN manual chapter switching were checked. No console warnings/errors captured in inspected flow.
- Solid primary-action contrast: SELL 8.16:1 (#30213f on #d1b5ed); BUY 9.68:1 (#1d354c on #c3e7fa). Background remains quieter beneath text than at the outer glass edges.
- Live user camera was not accessed for this presentation-only update; no claim of new live-hand validation.

## Local visual evidence

- /Users/jojo/Documents/ChatGPT/TIME/docs/qa/timevault-apparatus-cover-20261030.png
- /Users/jojo/Documents/ChatGPT/TIME/docs/qa/timevault-amethyst-sell-20261030.png
- /Users/jojo/Documents/ChatGPT/TIME/docs/qa/timevault-ice-buy-20261030.png

Publish to the existing https://shi-chenchen.github.io/timevault/ GitHub Pages site. Deployment SHA and public asset checks are recorded in the local publication history after verification.
