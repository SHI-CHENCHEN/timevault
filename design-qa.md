# TIMEVAULT scientific interface — final design QA

Reviewed 2026-11-03; final spacing and narrow-screen recheck 2026-11-04.

## Comparison target and evidence

The user supplied three digital design boards and two TIMEVAULT portfolio boards, then explicitly requested original abstract backgrounds rather than a copy of the rendered landscape. These are art-direction references, not matching application states. No pixel-perfect reproduction is claimed. The retained source hero crop is visible in `docs/qa/timevault-scientific-comparison-20261103.jpg` in the private workspace; the original temporary screenshot `截屏2026-11-03 20.30.06.png` was available for the initial comparison but has since expired.

Final evidence directory: `/Users/jojo/.codex/worktrees/e5f8/TIME/docs/qa/`.

- Full-view source/implementation comparison: `timevault-scientific-comparison-final-20261104.jpg` (1600 × 1450). Opened and visually inspected together.
- Focused title/material and selection/control comparison: `timevault-scientific-focused-final-20261104.jpg` (1500 × 880). Opened and inspected; important controls are shown at original screenshot density.
- Cover, reserve console, History: `timevault-scientific-{cover,idle,history}-final-20261104.png`, 1440 × 900 CSS/pixels.
- SELL, BUY, Reflection: `timevault-scientific-{sell,buy,reflection}-final-20261104.png`, 1280 × 720 CSS/pixels.
- Narrow cover, Reflection and confirmation: `timevault-scientific-{cover,reflection,confirm}-mobile-20261104.png`, 390 × 844 CSS/pixels.
- Earlier confirmation, processing, countdown and three-chapter evidence remains in `timevault-scientific-*-20261103.png`.

Screenshots are browser-rendered content, not fabricated mockups. Full-view images are aspect-preserving normalized thumbnails; focused UI crops remain 1 CSS px = 1 image pixel. The reference is a previously normalized portfolio crop (776 × 288), not an application viewport; its proportions and content intentionally differ. The reference title crop is enlarged only to inspect its type/material vocabulary. Private source boards and QA contact sheets are not included in the public website export.

## Findings and comparison history

1. [P1, resolved] The first scenic background duplicated the portfolio landscape. The user's steering required innovation. Replaced it with four independent abstract optical plates. Final combined comparison shows a calm type column and perimeter detail around the live apparatus; the scenic trial is excluded from publication.
2. [P1, resolved] An older high-specificity rule overrode the two title materials. Increased specificity for TIME and VAULT individually. Final focused comparison shows cold silver-blue TIME and violet chrome VAULT; the original illumination handler and font remain.
3. [P2, resolved] Readout caption and duration selector crowded each other at 1280 × 720. Added explicit readout row spacing and a 72 px selector track. Final SELL/BUY captures show separate number, caption, ruler and action bands.
4. [P2, resolved] Confirmation controls approached the persistent footer at 1280 × 720. Compact-height typography and dial sizing free the action band. Browser bounds place the confirmation footer bottom at 621.84 and installation rail top at 675 (53 px clearance).
5. [P2, resolved] History scrubber caption touched the totals border at 1440 × 900. Reduced archive dial to 43vh and tightened scrubber spacing. Final bounds: scrubber bottom 748.29; totals top 763.5; 15.21 px clearance. Revised same-state screenshot included above.
6. [P2, resolved] Reflection controls ended at the footer boundary at 1280 × 720. Raised them 15 px. Final control bottom 660; rail top 675; 15 px clearance. Revised same-state screenshot included above.

Final combined and focused comparison found no remaining actionable P0/P1/P2 findings. Small secondary metrology labels remain deliberately quiet; primary actions, values and reading text carry stronger contrast.

## Required fidelity surfaces

- **Fonts / typography:** existing CYGUN brand retained, horizontal title with separate metallic materials. Helvetica Neue/Arial headings use weight 400 and controlled wrapping; monospace numeric readings and chrome distinguish measurement from narrative. Primary values and action labels are legible in focused evidence. No new font dependency or rasterized UI text.
- **Spacing / rhythm:** cover has separate identity, copy, grammar, entry and apparatus bands. Clock and controls belong to the right scene while digital time is left and reserve is in the top band. Reserve uses a two-by-two command grid; exchanges use input left/instrument right; confirmations reverse this arrangement; History uses orbit left/records right. Narrow screens stack and scroll below fixed chrome. No horizontal overflow at 390 px.
- **Colors / tokens:** near-black marine `#070c15`, silver `#edf1f8`, muted steel labels, violet `#b99af9` for storing and ice blue `#92d7f1` for reclaiming. Four backgrounds differ geometrically, not only in tint. Optical detail stays at the periphery; the existing live object and data remain foreground priorities.
- **Images / assets:** four original generated 1672 × 941 plates, JPEG quality 78, approximately 109–143 KB each. Restrained refraction, no text or competing primary object. The original live Three.js installation is retained and scaled by its existing measured stage. No portfolio render copied into the public scene. Original SVG/3D controls remain functional code rather than flattened image UI.
- **Copy / content:** all headings, questions, account values, durations, action names and content remain driven by the existing components. No narrative, flow, camera instruction, hand role or particle behavior was replaced by the new presentation stylesheet.

## Interactions and checks

- Cover title click, HOLD/RESUME, reset and navigation exercised. Title material styling remains interactive.
- STORE selection, matching confirmation, real local simulated store processing and return exercised. Local reserve 30 → 90 minutes after a 60-minute store.
- RECLAIM selection, confirmation, countdown and Focus view exercised. Local reserve 90 → 75; countdown and recovered 15 minutes verified. These transactions ran on an isolated localhost origin, not the user's public account.
- History ALL/RECLAIMED filters, records and Continue to Reflection exercised.
- NOTICE, GATHER and RETURN manual chapter controls exercised. Camera remains opt-in. No real camera or physical Arduino test was performed in this visual change.
- At 390 × 844, Reflection scroll height 1296, selection 913 and confirmation 977; document width is 390, with actions reachable through existing scrolling. Final mobile cover screenshot taken after the existing navigation transition settled.
- Browser error log checked after final flow: empty.
- Client/shared/server TypeScript checks, 112 tests in 18 files, ordinary client/server builds, standalone and GitHub Pages export passed. Final CSS spacing edits were rebuilt for GitHub Pages successfully. Existing Three.js chunk-size warning remains.
- Source comparison against published baseline `e5e50ff`: hooks, visual, components, shared and server unchanged. The only existing source edit is the final stylesheet import in main.tsx; the stylesheet and four plates are new. Hand worker and Three.js vendor hashes remain unchanged.

## Implementation checklist

- [x] Original backgrounds and clear STORE/RECLAIM separation.
- [x] Metallic title and responsive cover hierarchy.
- [x] All presentation screens styled without behavior changes.
- [x] Required fidelity surfaces and full/focused comparisons inspected.
- [x] P1/P2 findings corrected and recaptured.
- [x] Builds, regression checks and source preservation verified.
- [x] No remaining actionable P0/P1/P2 visual findings.

final result: passed
