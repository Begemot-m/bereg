# Design QA — клиентские практики

## Artifacts

- Source visual truth: `C:/Users/matve/Desktop/Рефы визуала/590abfaa45d213c9d952d28b2fc142ee.jpg` and Bereg Icon Pack at `C:/Users/matve/Desktop/Bereg Icon Pack — Generated/preview-ui.png`.
- Browser-rendered implementation: `C:/Users/matve/psy-platform/qa-tools-mobile.png`.
- Combined comparison evidence: `C:/Users/matve/psy-platform/qa-tools-comparison.png`.
- Viewport: 390 × 844 CSS pixels.
- State: client Tools screen with one saved thought-diary draft and one completed GAD-7 check.

## Full-view comparison evidence

The reference and implementation were placed into one 1590 × 900 comparison image before judging. The implementation carries across the reference system rather than its sample content: flat pastel fields, warm white cards, heavy dark display type, compact uppercase labels, large outlined radii, high-contrast black actions, four distinct semantic colors, and a fixed rounded navigation surface. The four real raster illustrations use the supplied Bereg icon pack and remain sharp at their displayed size.

## Focused region evidence

The 390 × 844 implementation is preserved at native CSS-pixel size inside the combined comparison, so the hero, card grid, type hierarchy, outlines, icon crops, buttons, and navigation remain readable without a separate crop. A separate breathing-flow capture was visually inspected in-browser at the same viewport: the colored header, white practice surface, 220 px illustration, evidence note, and primary action showed no clipping or alignment defect.

## Findings

- No actionable P0/P1/P2 differences remain.
- Fonts and typography: the existing Bereg rounded family and its 800–900 weights reproduce the playful, compact hierarchy of the reference. Headlines wrap intentionally at 390 px; no button or card label is clipped.
- Spacing and layout rhythm: 16 px page margins, 2 × 2 practice grid, 2–2.5 px outline ladder, 18–24 px radii, and white lower card panels produce the same dense but readable rhythm as the reference. Persistent navigation overlaps only the scrollable continuation area, not the active primary action in a practice.
- Colors and visual tokens: sky, lilac, green, coral, amber, ink, and warm white are mapped to existing product tokens. There are no gradients or heavy shadows; selected and active states retain sufficient contrast.
- Image quality and asset fidelity: all four practice images are original 512 px PNG assets from the supplied Bereg pack, placed with `object-contain` and no stretching, placeholder art, CSS illustration, inline SVG illustration, or transparency halo.
- Copy and content: instructions are short, non-diagnostic, and usable without clinical knowledge. GAD-7 explicitly says it is screening rather than diagnosis; the impairment question does not affect the score; grounding does not force text input.
- Icons: actions use one Phosphor icon family at consistent 16–21 px optical size. Illustrative icons come only from the supplied raster pack.
- Accessibility and motion: primary controls are at least 40 px high, native buttons and inputs expose labels, decorative images have empty alt text, the full-screen shell prevents background scroll, and reduced-motion mode removes shell, progress, intro, and breathing-image motion.

## Primary interactions tested

- Opened all four client-only practice entry points at 390 × 844.
- Started breathing in the default 4/6 rhythm, checked the optional 4/7/8 caution, started the timer, paused it, and verified early completion is available.
- Entered a thought-diary situation, reloaded the page, reopened the practice, and confirmed the exact draft and step were restored. The home recommendation changed to “continue draft”.
- Started grounding and confirmed it presents one object at a time with optional text plus “noticed” and “skip” actions.
- Completed all seven GAD-7 questions with score 7, answered the separate impairment question, and verified the “light” band and non-diagnostic support copy.
- Checked the browser console: no application errors. Only the known Telegram WebApp haptic warning appears outside Telegram.
- Ran two successful optimized production builds with TypeScript validation and static page generation.

## Comparison history

- First pass P2: a fresh account recommended grounding while the supporting copy described a calm breathing rhythm. Fixed the no-history branch to recommend breathing.
- First pass P2: saved form drafts restored after reopening, but the Tools cards did not expose that state. Fixed by prioritizing the saved draft in “What helps now” and changing the card action to “continue draft”.
- First pass P3: the thought diary intro duplicated a generic primary action and two format choices. Removed the redundant action and left two explicit equal-weight choices.
- Post-fix evidence: `C:/Users/matve/psy-platform/qa-tools-mobile.png` and `C:/Users/matve/psy-platform/qa-tools-comparison.png` show the corrected recommendation, draft label, and stable 2 × 2 card hierarchy.

## Open questions

- None blocking. Practice history and drafts are intentionally local in this version; therapist sharing remains off until a separate consented data flow is designed.

## Follow-up polish

- [P3] When a backend is introduced, sync only explicit user-approved summaries and keep raw journal text private by default.
- [P3] Add a user-controlled cue volume if audio settings expand beyond the current quiet on/off phase signal.

final result: passed
