# Design QA — экран настроения

## Artifacts

- Source visual truth: `C:/Users/matve/psy-platform/docs/qa/mood-reference-v2.png`.
- Browser-rendered implementation: `C:/Users/matve/psy-platform/docs/qa/mood-implementation-v2.png`.
- Combined comparison evidence: `C:/Users/matve/psy-platform/docs/qa/mood-comparison-v2.png`.
- Source pixels: 298 × 539, supplied framed-phone reference.
- Implementation pixels and CSS size: 400 × 648 at device scale factor 1, captured from the desktop demo phone viewport.
- Comparison canvas: 860 × 710; the source was proportionally enlarged without cropping, the implementation remained at native CSS-pixel density.
- State: mood 5.0, joyful expression, first step of the mood check-in.

## Full-view comparison evidence

The source and implementation were placed in the same comparison image before judging. The generated character now uses the reference's five-lobed cloud silhouette, wide edge-to-edge body, paired white eyes with low black pupils, and open black mouth with two white teeth. The explicitly requested product deviations are preserved: the screen background remains white, the character uses the Bereg mood palette instead of orange, and the existing product controls sit below the character rather than on a full-screen colored field.

## Focused region evidence

A separate crop was not needed. The character face occupies more than half of the 400 px implementation width and remains clearly readable in the native-size full-view comparison. The low-resolution source does not contain additional face detail that a larger crop would reveal.

## Findings

- No actionable P0/P1/P2 differences remain.
- Fonts and typography: the existing Bereg heavy rounded display type keeps the reference's compact, playful hierarchy. The Russian headline wraps into three balanced lines without clipping; small labels and the primary action remain readable.
- Spacing and layout rhythm: the body reaches both horizontal edges, the five lobes are centered, the face sits in the lower half of the character, and the full CTA remains visible in the 400 × 648 phone viewport.
- Colors and visual tokens: the white background and continuous five-stop mood palette match the approved direction. Text and controls retain the existing ink and neutral tokens.
- Image quality and asset fidelity: the body mask and eye layer were generated from the supplied reference, chroma-keyed, cropped, and optimized for the actual slot. Mouth states are real raster assets derived from the existing generated character set. No placeholder, emoji, inline SVG illustration, or CSS-drawn mascot is used.
- Copy and content: all established product copy and the two-step save flow are preserved.
- Motion and performance: only one eye layer and one or two adjacent mouth layers render at a time. At the tested fractional state 2.4 the slider contained three images and eight descendant nodes, replacing five simultaneous full-character Motion images. Moods are updated at most once per animation frame.
- Accessibility: the character remains labelled as an image, the interaction remains an ARIA slider with value 1–5, keyboard arrows change the value by 0.1, and focus remains visible.

## Primary interactions tested

- Keyboard step changed the slider from 4.0 to 3.9.
- A horizontal drag changed the value continuously to 2.4 and displayed the blended intermediate expression.
- The independent blink was observed after 2365 ms with the eye layer closing to `scaleY(0.055)` and reopening.
- The joyful quick state produced the reference-like open mouth and two teeth.
- “Дальше” opened the emotion-selection step; “Назад к настроению” returned to the character without losing the selected value.
- At fractional values the runtime kept only three image nodes in the interactive character.
- Browser console contained no application errors. Remaining warnings are the known Telegram WebApp 6.0 capability notices from the desktop demo harness; unsupported haptic calls are now bypassed.
- `bun run build` completed successfully with TypeScript validation and all 25 pages generated.

## Comparison history

- First pass P1: the previous implementation used five simultaneous 500 KB full-character PNGs, producing lag and slow expression updates. Replaced with one generated raster body mask, one eye layer, and adjacent mouth layers only.
- First pass P1: the character had visible side margins and a tall composition. Rebuilt the body to touch both edges and reduced the scene to `clamp(260px, 38vh, 320px)`.
- First pass P1: small scale divisions could queue feedback after the gesture. Replaced the timer queue with a frame-local WebAudio burst capped at 80 ms and primed the audio context on pointer down.
- Second pass P2: eyes were too small and the pupils were over-clipped. Increased the eye pair to 55% width, adjusted the crop, and restored the reference's low pupil placement.
- Second pass P2: the joyful mouth was oversized and clipped at the body edge. Reduced its relative width from 90% to 58% of the face slot.
- Second pass P2: the primary action touched the bottom edge of the demo phone. Reduced the character scene height while preserving full-width geometry; the CTA now fits completely.
- Post-fix evidence: `docs/qa/mood-implementation-v2.png` and `docs/qa/mood-comparison-v2.png`.

## Open questions

- None blocking.

## Follow-up polish

- [P3] A future sound setting can expose the existing click mute preference if the product adds a general sound-controls section.

final result: passed
