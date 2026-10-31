# TIMEVAULT — distinct history and reserve atmospheres

## Presentation changes

- History uses a new, lightweight SVG memory-tide background: blue/silver and lavender light strata around a quiet reading surface. It no longer reuses the glass texture from transaction pages. The records, dial, filters and navigation are retained.
- The reserve home uses a separate SVG light field surrounding the installation. Four existing entry actions share a translucent surface, restrained violet/blue/silver accents and decorative arrow marks. Labels and accessible action names are unchanged.
- Cover digital time moved into the left reading column. The reserve readout is in the top information band, and the small fragment signature sits beside the entry action. The right scene has a reserved top margin, keeping the installation, analog clock and compact controls separate from text. Cool atmospheric light slightly lifts the cover.
- All new selectors are scoped to intro, idle/entered and history. No changes to SELL / BUY flows, Reflection, hand input roles, timings, camera, models, WASM, particles or account/state logic.
- SVGs are original code-native artwork; no new image generation or external asset dependency. No extra animation loop or WebGL renderer.

## Validation

- Client/shared/server TypeScript checks passed.
- 112 tests / 18 files passed, including hand identity, inference, lifecycle, timing and particle policy tests.
- Ordinary client + server, standalone, and GitHub Pages builds passed. Existing Three.js bundle-size warning unchanged.
- Checked cover at 1440×900, 1920×1080, 2560×1440, 1280×720 and 390×844. DOM rectangle checks found no intersection between digital time and scene stage, reserve and scene stage, reserve and title, or fragment signature and entry action / scene stage.
- At 1440×900, digital time ends at y=103; scene starts at y=112.5 and is separated horizontally (time ends x=369.7; scene starts x=619.2). Reserve readout ends above the scene. Fragment signature and entry action have independent columns.
- At 390×844, History document width remains 390px and the history panel scrolls vertically for full content (1289px), without horizontal overflow.
- Browser verified new background URLs and palette computed styles. History ALL / RECLAIMED filtering and return worked. All four reserve buttons were exercised: SELL, BUY, HISTORY and REFLECTION. Transactions were only previewed; account remained unchanged.
- No browser console errors/warnings captured. Reflection retained its prior glass image and opacity 0.43; no live user camera accessed during this presentation-only update.
- Source diff under hooks, visual, shared and server is empty. Exported hand worker and Three.js vendor asset unchanged.

## Local screenshots

- /Users/jojo/Documents/ChatGPT/TIME/docs/qa/timevault-cover-zones-20261031.png
- /Users/jojo/Documents/ChatGPT/TIME/docs/qa/timevault-reserve-lightfield-20261031.png
- /Users/jojo/Documents/ChatGPT/TIME/docs/qa/timevault-history-tides-20261031.png

Publish to the existing https://shi-chenchen.github.io/timevault/ site. Exact deployment and public asset verification are recorded in the workspace publication history.
