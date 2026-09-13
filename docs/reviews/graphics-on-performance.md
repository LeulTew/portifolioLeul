# Graphics-on performance review

Date: 2026-09-13. Baseline: `24212cb`.

## Summary

The review found and corrected real rendering starvation, lost animation time,
repeated layout work, document-wide animation invalidation, and an unsafe
high-quality assumption for software WebGL. Graphics remain enabled.

**Ready to merge:** yes for these verified, scoped improvements.
**Confidence:** high for the tested configurations, not a statistical estimate
of device coverage. **Universal low-end/60fps guarantee:** not established.
Software rendering remains lower fidelity and can still have slow frames.

The island, animated avatar, live TV, ocean, reflections, particles, hero cloud,
mint arrow, centered title, Education reader and navigation remain present.
Standard hardware keeps its existing model assets and graphics budgets.

## Requirement completeness

| Requirement | Status | Evidence | Remaining risk |
| --- | --- | --- | --- |
| Keep graphics on during constrained testing | Verified | Healthy WebGL contexts, live draw calls and scene screenshots in both test profiles | Emulation is not every physical device |
| Fix measured bottlenecks, not hide the scene | Verified | Frame-clock regression, CPU profiles, scoped style writes, cached cloud material | Software rendering is still expensive |
| Preserve choreography and reading controls | Verified | Two complete constrained forward/return journeys; synchronized copy/cloud exit; centered/docked title; one Education record per input wave | Firefox/WebKit not exercised here |
| Load the chosen model set consistently | Verified | Software prefetch, scene readiness and rendering request the same three compact GLBs, once each | Offline delivery is not provided |
| Preserve original assets and normal graphics | Verified | Original GLBs unchanged; compact variants are software-only | Software silhouettes/geometry are deliberately lower detail |
| Review before publishing | Verified locally | Unit, lint, TypeScript, build, browser, asset and lifecycle checks below | Deployment is checked separately after push |

## Critical and major findings resolved

1. **Low-tier frames were consumed before the renderer could draw them.**
   `THREE.Clock.getElapsedTime()` calls `getDelta()` and advances the clock.
   Different frame subscribers therefore queried the gate with different times.
   Every subscriber now uses R3F's shared `clock.elapsedTime` snapshot. A mounted
   camera/grade/governor regression produced **0 of 31 expected draws before**
   and all 31 after the correction.
2. **Capped graphics slowed camera, lighting and water.**
   Their damping used a single RAF delta after skipping frames. A shared
   rendered-frame delta now includes the time between actual draws, with the
   existing suspension clamps. Capped and uncapped camera/light convergence
   agree in the regression test.
3. **The handover repeatedly forced layout and restyled the entire document.**
   Hero position now reads the scrolling layer's translation after one layout
   measurement, with remeasurement on layout/layer changes and a real-geometry
   fallback for other transforms. Idle HTML reconciliation checks whether a
   repair is needed before reading scroll geometry. Motion variables are scoped
   to the real heading, its white paint and the arrow rather than `html`.
4. **Software WebGL could be classified as high tier.**
   SwiftShader, Mesa software renderers and the Microsoft Basic Render Driver
   now receive a software budget: DPR 0.4, a 64px water reflection target,
   10fps reflection refresh, and a 30fps maximum scene draw rate. The water
   still draws on every eligible scene frame; its reflection texture is reused
   between refreshes.
5. **The cloud repeatedly evaluated expensive SVG material/filter work.**
   Its authored vector sources are retained, but normal rendering uses cached
   WebP layers and one shared mask. The wave, drift, light shear, transparency,
   coverage, reverse and reduced-motion behavior remain. Decode failure is
   reported and switches the instance to its vector source.
6. **Software rendering spent vertices on detail it could not display.**
   Error-bounded compact GLBs reduce the three models from **408,349 to 81,667
   vertices** and **4,997,312 to 1,118,324 bytes**. Mesh, skin and animation
   counts are preserved. Terrain borders are locked, its faceted shading is
   retained, and TV UVs and avatar skin attributes remain.
7. **Resource ownership and invalid keyframes needed correction.**
   Cached GLTF geometry/materials are no longer disposed by individual avatar
   or terrain instances. Ocean geometry survives material/theme changes and
   is disposed when its own lifetime ends. The hero word rotator no longer
   springs its blur radius below zero.

## Measurements

The hardware-assisted profile used Chromium at 1280x800, device scale factor 2,
2-core/2GB *hints*, and 4x main-thread CPU throttling. Those hints select the low
tier; they do not physically limit RAM or CPU cores. The GPU remained an NVIDIA
hardware renderer. Each run used an isolated browser context.

The first frame of each measurement phase is excluded in the table, consistently
for the saved baseline and final data. Otherwise the cost of starting the CPU
profiler was incorrectly charged to the idle phase.

| Metric, graphics on | Baseline | Final |
| --- | ---: | ---: |
| Idle actual 3D draw cadence | 3.48fps | 29.42fps |
| Fog/arrow RAF p95 | 72.2ms | 22.2ms |
| Title-docking RAF p95 | 122.3ms | 27.7ms |
| Draws while the opaque About panel covers the world | 0 | 0 |

An intermediate scoped-style run measured 16.7ms p95 for both moving phases;
the table intentionally uses the final run rather than selecting the best run.
These are delivered callbacks/draw calls, not measured GPU presentation times.

A separate, freshly launched Chrome used actual **SwiftShader software WebGL**
at 960x720 with device scale factor 2. Its initial high-tier-policy probe, after
the first frame/style fixes, had a 419.8ms mean browser frame interval. The final
software path measured:

| Software WebGL metric | Final |
| --- | ---: |
| Drawing buffer | 384x288 |
| Idle RAF mean / p95 | 32.09ms / 55.5ms |
| Handover RAF mean / p95 | 18.51ms / 50ms |
| Worst observed handover interval | 99.9ms |
| WebGL context lost | No |
| Original/full GLBs fetched in this profile | None |

The software path is materially more usable, but it is **not locked 60fps**.
Physical low-end GPUs, thermal throttling and constrained RAM still need target
hardware testing. No operating-system hardware settings were changed.

## Test results and regression review

| Category | Result | Score / qualification |
| --- | --- | --- |
| Correctness | Frame budget, elapsed damping, position cache, shared mask, asset selection and lifecycle regressions pass | Verified scope |
| Completeness | Graphics-on CPU and software journeys complete | Physical-device coverage incomplete |
| Code quality / architecture | Existing frame gate, tier detector and asset pipeline reused; no new dependencies | Reviewed |
| Performance | Large measured improvements; software tails remain | No blanket 10/10 claim |
| Security / data | No auth, database, permissions or server API changes | Not an independent security assessment |
| Maintainability | Editable SVG sources, reproducible raster baker and model-generation script retained | Reviewed |
| Testing / regression safety | **129 files, 1193 passing tests, four existing skips**; lint, app TypeScript and production build pass | Local verification |

The full browser journeys kept graphics on, verified both light and dark
presentations, checked 1.45x centered title placement, maintained the 36px arrow
gap within 0.013px, and completed Education entry, a 65-event momentum wave,
Previous, and Home return. Reduced motion keeps the cloud still and title at
its normal inset. Forced WebP failures successfully use the vector textures.
Repeated theme toggles retain a healthy WebGL context and produce no page or
invalid-keyframe errors.

Raster/source comparison found a maximum mean composited channel difference of
0.054 on a 0-255 scale; the mask's comparison was exact. The cached textures add
about 413KB of transfer for normal hardware in exchange for eliminating repeated
filter evaluation. Software models more than offset this transfer increase.

The automated broken-image hook matched an `<img>` mention in an asset-module
comment, not rendered markup. Actual asset existence and loading were checked.

## Reproduction and evidence

Local gate:

```text
bun x vitest run
bun run lint
bun run typecheck
bun run build
git -c core.whitespace=cr-at-eol diff --check
```

`bun run optimize:models` regenerates only the software GLBs, leaving the input
models untouched. `scripts/bake-hero-cloud.mjs` exports `bakeHeroCloud(page)` for
a Node.js runner with a Playwright Page; it regenerates the WebP files from the
checked-in SVG sources using the browser's SVG renderer.

CPU profiles and raw traces are retained in review session
`b1568aa9-cf76-46b3-bbdf-d0f5fd1d7768`: `graphics-baseline-4x.json`,
`graphics-reviewed-4x.json`, `graphics-comparison.json`,
`software-graphics-reviewed.json`, `graphics-journey-cpu4.json`,
`graphics-journey-software.json`, `frame-budget-before.log`, and
`low-end-full-gate.log`.

## Final verdict

Approve the scoped optimizations on the tested evidence, with the software
quality tradeoffs and device limitations above. Do not describe this as a
guarantee that every weak device can present full-quality graphics at 60fps.
No reported FPS improvement was obtained by switching the site to its 2D fallback.
