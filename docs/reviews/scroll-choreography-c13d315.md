# Scroll choreography production review

## Summary

**Not approved for merge.** Seventeen focused implementation commits correct
the reproduced choreography, geometry, input, rendering and delivery defects.
The complete local gate and the final development and production-browser
journeys pass, but the evidence does **not** support every category at 10/10.

- Baseline: `c13d315`; final implementation: `1a9188a`.
- Scope: About/Education and the hero handover, plus Home, Skills, Projects,
  Contact, navigation, scroll ownership and the affected renderer consumers.
- Ready to merge: **No**. `main` was not merged, checked out or modified.
- Issue fully solved: **No**. Consistent frame-budget compliance and the
  originally reported missing-logo incident remain unresolved.
- Production-ready under the requested all-10/10 acceptance rule: **No**.
- Confidence: strong direct evidence for the reproduced corrections, but no
  calibrated percentage is available. A percentage would be an estimate.

The desktop production heading stayed within the measured budget. Tablet
reverse-heading cadence did not: the completion-flag interval recorded
p95 **38.9ms**, worst **49.5ms**, and **13 intervals over 32ms**. A lighter
instrumentation control improved the distribution but still recorded one
**44.4ms** interval. Neither the application nor the host has been proven to be
the sole cause; this is not dismissed as a tooling problem.

## Requirement completeness

E = explicit requirement; S = system-implied requirement. "Complete" below
means verified within the stated local scope, not a universal device guarantee.

| Requirement | Expected behavior | Relevant components | Implementation | Evidence / test | Status | Missing / risk |
| --- | --- | --- | --- | --- | --- | --- |
| E: suspended background rise | Resume visible movement, never finish in one frame | `triggeredPhase`, background | Bounded painted-frame elapsed time | 2200ms stall; active-to-settled 1871.9ms after fix; `backgroundPacing.test.tsx` | Complete | Wall time can lengthen under suspended paints |
| E: title completion ownership | One write at the exact endpoint | Title pixel transition | One guarded completion publisher | Duplicate 27.3ms-apart writes before; none in final traces; `titleCompletion.test.tsx` | Complete | None reproduced |
| E: stopped-reader reverse pause | Keep statements clear until a fresh post-cooldown upward request | About beat requests | Completion, cooldown and fresh-input gating | Exact mounted .549 case; clean browser .549 and later .546/.595 stops | Complete | Native damping means not every requested decimal is reachable exactly |
| E: stable scroll ownership | Real scrollport moves; no idle layout oscillation or blank stranded chapter | FocusRail, App, progress store, pin | Preserve rail layout; repair settled HTML geometry; measure before consume | 677 samples across three contexts at max 10692; skipped-boundary regressions | Complete | Tablet category changes legitimately change total height |
| E: school seal | Visible school image; no nonexistent style | EducationRail | Remove unresolved `styles.seal` | Both WebPs 200 and 512x512 decoded; visible Saint Joseph screenshot | Partial | Original screenshot and localhost/deployed origin unavailable |
| E: timed cue and centered handover | Finish hero, trace cue, show centered heading alone, then accept climb | Home, ScrollCue, HeldHeader | 1200ms clock, owned readiness, cooldown/fresh request | `Home.test.tsx`, chapter sequencing tests, final complete journeys | Complete | Cross-browser matrix not run |
| E: 36px escort | Constant gap while heading moves | Home, HeldHeader, cue CSS | Fractional geometry and shared transform displacement | Production desktop 36.012260-36.013260px; tablet 36.001968-36.002930px | Complete | Measured tolerance was 36px +/-0.1px |
| E: one movement at a time | Completion-serialized copy, wall and title, with complete reverse | About beat components, pin | Shared request helpers; no position-only reset | Mounted production-clock tests; full chapter and stopped-reader recordings | Complete | No claim of universal 60fps |
| E: spent-boundary behavior | Owed movements remain visible; both ends eventually release without more input | Home, PinnedSequence, transitions | Cancellable cooldown wakes and completion-driven release | Single +12000/-12000 wheel journeys; final seq/head/cue/hero exit all 0 | Complete | Re-entry and late geometry remain important regression surfaces |
| E: preserve reader input | Do not cancel wheel, touchmove or keydown; no native smooth scroll on Drei | Navigation, cue, gesture gateway | Native buttons; existing passive gesture path retained | Failing-before Enter/Space tests; all recorded wheel/keyboard inputs uncancelled | Complete | Physical touch-device journey unmeasured |
| E: whole-page choreography audit | Review Home, Skills, Projects and Contact, not About alone | All named chapters | Reduced motion, CSS ownership, timed Projects focus, honest Contact failure | Section-specific mounted tests and browser evidence below | Complete | Does not certify the separately deployed mobile project |
| S: reduced motion and no-WebGL | Readable final content; visible, correctly placed cue | Chapters, KineticHeading, Home | Skip self-running reveal transforms; publish cue CSS; immediate rail republish | Production reduced-motion 3D/flat opacity 1; rail/origin both 671.172px | Complete | Dynamic OS preference changes were not exhaustively exercised |
| S: fallback width | Decorative plate must not create horizontal scrolling | Home CSS | Horizontal clip only; vertical overflow remains visible | Before edge x=1336 at viewport 1280; after scrollWidth=clientWidth | Complete | Browser-only regression, not a jsdom layout assertion |
| S: opaque-pin rendering | Do not draw an invisible world; resume after coverage ends | Pin, camera hold, frame gate | Explicit fully opaque overlay coverage | 15928 hidden draws before; 0 over 3015ms after; 4840 visible draws on release | Complete | Translucent boundaries deliberately keep rendering |
| S: honest Contact status | Do not claim delivery without configured transport | Contact hook/form | Missing configuration enters existing error/log path; preserve inputs | 10 failing-before regressions; false success 1->0, preserved fields 0->3 | Complete | Real delivery/provider controls were not exercised |
| E: protected assets and local-only verification | No original/unused asset changes or loads; no Actions dependency | Public assets, local tooling | Assets/manifests unchanged; local Bun gate | No `/original/` requests; only optimized GLBs observed; git scope check | Complete | One production run had a duplicate optimized CRT response |
| E: all categories genuinely 10/10 | Evidence supports production approval, not just passing tests | Whole reviewed workflow | Corrections and bounded independent measurement passes | Scores and outstanding evidence below | Partial | Performance and external/device evidence prevent approval |
| E: deferred white/dark background exit | Do not start before the existing defects are closed | About background | Not implemented | No such change in the diff | Complete | Remains intentionally deferred |

## Critical issues (blocking)

No remaining critical functional failure was reproduced in the final local
journeys. **Approval is nevertheless blocked** by the measured tablet frame
cadence and the unverified original seal incident. Passing tests is not a
substitute for those acceptance conditions.

## Major issues

1. **Frame-budget compliance remains incomplete.** The final production tablet
   reverse-heading interval has p95 38.9ms and worst 49.5ms. It needs an
   attributable rendering/scheduling trace and confirmation on target hardware,
   not an unmeasured animation downgrade or removal of the 3D scene.
2. **The original missing-logo report cannot be closed as reproduced.** Local
   asset loading and actual Education navigation work. The original screenshot
   and its source URL/build are still required to identify that incident.

## Minor issues

The local gate retains existing R3F-in-jsdom warnings and four wave-shader
skips. Build tooling reports stale Browserslist/baseline-browser data; dependencies
were not changed merely to suppress warnings. One earlier browser run recorded
`ERR_INVALID_HTTP_RESPONSE`; the final complete runs did not reproduce it.
Existing Projects drag/wheel tests include dispatch-only cases without outcome
assertions; their passing count is not evidence of input behavior. The new
mounted focus tests and real-browser input recordings provide that evidence.

The final production desktop trace contains two 200 responses for
`crt-lite.glb`. Other final contexts, including the CDP control, contain one.
Whether that earlier second response transferred another payload is unmeasured.
Two `Significant-opt.mp4` requests abort during each complete navigation/filter
journey; they are recorded as aborted media requests, not successful loads.

## Performance improvements

| Defect | Before | After |
| --- | --- | --- |
| Suspended rise | Transition and settled at the same instant after a 2200ms stall; no active rise | Active-to-settled 1871.9ms |
| Redundant title flag | Duplicate completion writes 27.3ms apart | Zero duplicate watched flags in final journeys |
| Contact exit layout | Repeated max 10692 <-> 10313 | 677 samples at max 10692 in the targeted reproduction |
| Competing CSS transition | Settling lag 389 / 294.5 / 405.6ms | Zero measured lag at 8ms sampling |
| Projects stopped reader | Opacity .704 / scale .9863 unchanged for 2415.2ms | Opacity 1 / scale 1 at partial coverage, unchanged over 1411.2ms desktop and 1556.6ms tablet in production |
| Hidden world rendering | 15928 actual draw calls during 3019.7ms of opaque coverage | Zero during 3015ms; 4840 visible calls after release |
| Reduced-motion reveal | 45 Skills and 4 Contact moving transform targets | No reduced-motion reveal transforms/unreadability across 174 elements and 2229 sampled frames |
| Cue geometry | Independently rounded coordinates varied around the 36px target | All final escort samples within 36px +/-0.1px; cue presence 1 |

### Final production cadence

These are **delivered application-requested animation-frame intervals**, not
physical display/GPU presentation measurements. The table uses the recorded
completion-flag interval for each beat. Background forward activity includes
its authored post-rise rest; it is not a 1916.8ms rise-duration claim.

| Viewport / beat | Observed active interval (ms) | Samples | p50 (ms) | p95 (ms) | Worst (ms) | >32ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1440x900 dark / heading forward | 1099.3 | 110 | 11.1 | 11.2 | 16.7 | 0 |
| 1440x900 dark / heading reverse | 1099.8 | 111 | 11.1 | 16.6 | 16.8 | 0 |
| 1440x900 dark / background forward + rest | 1916.8 | 345 | 5.6 | 5.7 | 5.7 | 0 |
| 1440x900 dark / background reverse | 1501.5 | 270 | 5.6 | 5.6 | 5.8 | 0 |
| 1440x900 dark / title forward | 1500.1 | 270 | 5.6 | 5.7 | 5.7 | 0 |
| 1024x768 light / heading forward | 1100.6 | 89 | 11.1 | 16.8 | 22.3 | 0 |
| 1024x768 light / heading reverse | 1124.1 | 52 | 22.2 | 38.9 | 49.5 | 13 |
| 1024x768 light / background forward + rest | 1927.9 | 341 | 5.6 | 5.7 | 11.2 | 0 |
| 1024x768 light / background reverse | 1501.0 | 270 | 5.6 | 5.7 | 6.2 | 0 |
| 1024x768 light / title forward | 1500.7 | 246 | 5.6 | 11.0 | 16.4 | 0 |

The lower-overhead tablet control removed periodic rectangle/style sampling.
Its 183 intermediate-heading samples had p50 11.1ms, p95 11.2ms, worst 44.4ms,
and one interval over 32ms. No overlapping long-animation-frame entry was
reported. This is insufficient to attribute or dismiss the remaining interval.

Earlier dedicated statement recordings measured p95 <=11.1ms, worst <=11.2ms,
and no intervals over 32ms. They precede the final integration and are retained
as scoped evidence, not relabeled as a fresh final per-statement profile.
Likewise, `data-title-active` alone is not a reliable full reverse-title window;
the final table does not invent a reverse-title duration from that flag.

### Build and asset measurements

Vite reported the following production bundle sizes:

| Chunk | Size (kB) | Gzip (kB) |
| --- | ---: | ---: |
| Application JS | 217.17 | 72.44 |
| Animation vendor | 235.14 | 85.47 |
| Three core | 680.05 | 176.57 |
| R3F vendor | 892.01 | 279.87 |
| CSS | 114.67 | 21.54 |

In the clean production CDP control, encoded transfer lengths were 3757659
bytes for `terrain-opt.glb`, 847465 for `me-animated-lite.glb`, and 393021 for
`crt-lite.glb`; none was reported as disk-cache or service-worker supplied.
No original assets were requested. Public assets, including deliberately
deployed originals and unused GLBs, and dependency manifests remain unchanged.

## Architecture improvements

The existing phase integrator remains the clock; shared immutable request,
cooldown and wake helpers govern completion prerequisites. Home owns hero
readiness, HeldHeader owns heading debt/settlement, and StatementsContainer owns
statement presence. Pending debt is not completion. Each publisher guards its
DOM writes; consumers observe rather than overwrite each other's flags.

The scroll store now has explicit measurement and consumption phases. An idle
Drei repair runs only when damped and physical offsets agree, and only a real
transform repair forces a geometry notification. Moving frames and pending
restores remain Drei-owned. The installed Drei 9.122 HTML layer comes from
`scroll.fixed.firstElementChild`; its separately mounted DOM root makes the
forwarded ref unreliable. That internal DOM relationship is a documented
upgrade-sensitive dependency, not a claimed public stability guarantee.

World coverage is separate from camera freezing. Only fully opaque active
About coverage suppresses rendering, including time-paced pin debt beyond the
physical span. Release, observer hide and unmount clear that coverage.

## Security concerns

This was a public-frontend choreography review, **not** an independent
exploitable-vulnerability audit. No auth, tenant, database or server permission
model was introduced or changed. Those backend-only checks are not applicable.
No credentials or new dependencies were committed.

Contact now fails explicitly when EmailJS configuration is missing rather than
simulating success. All email endpoints were blocked in the delivery
reproduction; zero actual send attempts occurred. Configured success, failure,
retry and injected submit behavior are tested with mocks. Provider-side domain
restrictions, abuse controls and actual delivery remain unverified; a public
client cannot certify those controls.

## Regression risks

The cross-component DOM flag protocol, late layout measurements and installed
Drei HTML structure deserve particular attention on upgrades. Resize, remount,
reverse-boundary, cooldown cancellation, exact endpoint, reduced-motion,
geometry ownership and idle-write regressions cover the changed behavior.

Final desktop max is 10692. Tablet values 9685 / 9831 / 9677 occur during
layout/category changes; this is not evidence of the original idle oscillation.
Both final tablet journeys return to physical scrollTop 0 and complete every
hero/About terminal phase instead of leaving translated HTML at -5585.37px.

## Missing / incomplete behavior

Consistent target-device frame cadence and the original school-seal incident
remain open. Firefox, WebKit, physical touch devices, deployed-site behavior,
actual email delivery and exhaustive live preference/theme changes are not
certified. An Android-user-agent probe verified the redirect to the separate
mobile site, with the external request deliberately blocked; it did not review
that deployed site. A narrow desktop viewport is not a physical-phone result.
The deferred white/dark upward background-exit feature was not started.

## Test coverage evaluation

The baseline had 108 passing files, 1050 passing tests and four skips. The final
gate has **116 passing files, 1118 passing tests and the same four skips**.
Tests exercise mounted production-clock paths, not only helper replicas:
the animation clock drains the components' real frame callbacks; scope-only
visual children are mocked. Native activation tests use `userEvent.keyboard`.

Important regressions include `backgroundPacing`, `titleCompletion`,
`chapterSequencing`, `spentChapter`, `statementReturn`, `Home`,
`PinnedSequence`, `App`, `Projects.pacing`, `SkillsContact.reducedMotion`,
`motionStyleOwnership`, and the Contact hook/form suites.
The fallback-width test executes in a real browser because jsdom has no layout.
Browser probes and raw traces are session artifacts, not a newly installed
project-wide E2E runner.

Some intermediate full gates hit the existing 5s Skills/Contact test timeout,
including one run without an active browser probe. The unchanged isolated
suite and later complete gates passed. No timeout or assertion was weakened
to obtain the final result.

## Test results and scores

Scores are conservative engineering judgments supported by the listed
evidence, not measured probabilities. Unverified production requirements are
not silently treated as passing.

| Category | Result / evidence / reason below 10 | Score (/10) |
| --- | --- | ---: |
| Correctness | Reproduced local failures corrected; full forward/reverse and failure paths pass. The original seal incident cannot be matched to its source build. | 9 |
| Completeness | Whole named-page audit performed; consistent performance and original-report/deployment evidence remain incomplete. | 8 |
| Code Quality | Focused changes, guarded writers, bounded clocks, typed guards and lifecycle cleanup; lint/typecheck pass; no known new static defect in the reviewed changes. | 10 |
| Performance | Zero hidden draws and idle-write regressions are fixed, but final tablet reverse p95 38.9ms / worst 49.5ms prevents the required frame-budget claim. | 8 |
| Security | No new sensitive surface; honest transport failure and validation coverage. Provider-side production controls/delivery are unverified. | 9 |
| Architecture | Existing gateways and shared clocks retained; explicit ownership and measurement order. Drei's internal DOM relationship remains an upgrade-sensitive dependency. | 9 |
| Maintainability | Focused commits, contract updates and mounted regressions. Global attribute protocol and browser-only reproduction artifacts still require coordinated maintenance. | 9 |
| Testing Quality | 1118 passing tests and clean development/production browser journeys; four existing skips, no Firefox/WebKit/physical-device matrix, and no actual email delivery. | 9 |
| Regression Safety | Final integrated code passes; no protected assets/manifests changed. Late-layout/internal-Drei and untested device/provider paths prevent blanket assurance. | 9 |

## Sixteen-phase review record

The repository contract numbers its process from Phase 0 through Phase 16.

| Phase | Work and conclusion |
| --- | --- |
| 0 - Requirements | Read the ten-rule choreography spec, review contract, CLAUDE.md and user handoff; explicit/system-implied requirements extracted above. |
| 1 - Actual resolution | Reproduced the supplied concrete defects before fixes; separated local seal success from the unavailable original incident; did not equate tests with approval. |
| 2 - Lifecycles | Traced passive input -> Drei physical/damped position -> measurement -> request/completion state -> phase clock -> DOM flags/styles -> pin and renderer release, both ways. Contact validation -> configured transport -> status/input preservation reviewed separately. |
| 3 - Full context | Covered Home, About/Education, Skills, Projects/FocusRail, Contact, navigation, scroll consumers, camera holds and rendering gates, plus their existing tests and fallback modes. |
| 4 - Diff | Reviewed 48 changed implementation/test/doc files through `1a9188a`; protected assets and manifests unchanged; CRLF-aware whitespace check passed. |
| 5 - Hallucination checks | Removed the nonexistent seal class and fake delivery success; used actual statement-presence ownership, actual installed Drei behavior and existing shared helpers rather than invented APIs. |
| 6 - Correctness | Verified exact endpoints, serialized reverse, discarded early asks, stopped-reader and spent-boundary behavior, native activation, flat/reduced paths and explicit delivery errors. |
| 7 - Architecture | Owned publishers, immutable request helpers, ordered measurement/consumption and separate camera/occlusion concerns; internal Drei dependency remains documented risk. |
| 8 - Security | Reviewed changed public client/config/error surfaces; no backend/tenant/auth changes. Provider controls and independent exploitation assessment not performed. |
| 9 - Performance | Measured actual WebGL calls, frame cadence, idle writes, CSS settling, scroll geometry and optimized asset requests. Remaining tablet cadence is a blocker, not a guessed host issue. |
| 10 - Reliability | Cancellable timers, observers and frames; terminal release without extra input; stale HTML recovery; no-WebGL usability; missing-config failure preserves user input. |
| 11 - Regressions | Complete suite plus integrated dark/light, production/development, forward/reverse, filtering, reduced-motion and fallback journeys. Limitations listed explicitly. |
| 12 - Data/database | No schema, persistence model, migration, transaction or historical-record change. Not applicable to this client-only correction. |
| 13 - Coverage | Failing-before mounted regressions and browser reproductions retained. Layout assertions run in a browser rather than pretending jsdom proves geometry. |
| 14 - Execution | Exact local Bun gate passed; production build served and exercised in isolated Chromium contexts. No GitHub Actions queried or awaited. |
| 15 - Completeness | Local corrections and whole named-page review complete; all-10/10 approval is incomplete for the reasons above. Deferred feature untouched. |
| 16 - Integration | All 17 implementation commits tested together in this isolated worktree, including coordinated About and Contact work. No PR, push, main-checkout change or merge performed. |

## Evidence

Exact final gate:

```text
bun x vitest run && bun run lint && bun x tsc -p tsconfig.app.json --noEmit && bun run build
```

Result: exit 0; 116 files / 1118 passed / 4 skipped; Vitest 26.00s; ESLint and
application TypeScript passed; Vite built 2567 modules in 7.13s.
`git -c core.whitespace=cr-at-eol diff --check` was used for this Windows checkout.

Every final measured journey used a new browser context, waited for the footer
and 2200ms, clicked before real wheel input, and closed its context afterward.
No source edits occurred during a measurement. The shared browser page was
excluded after unsolicited user input contaminated an earlier run. The
requested preview-pane launch tool was unavailable; an attached local Vite
process was used, not a detached server. Production preview used port 5184.

The full development and production matrices each covered 1440x900 dark and
1024x768 light, spent-end travel, complete reverse, category changes and native
Home Space activation. Each final run recorded zero premature About visibility,
zero duplicate watched flags, zero cancelled observed inputs, zero page/console
errors, zero HTTP error responses and zero original-asset requests.
Aborted media requests are separately disclosed above.

Production reduced-motion checks at 1280x800, with and without WebGL, measured
cue opacity 1, origin/rail 671.172px, zero document horizontal overflow and
uncancelled Enter activation. About moved from top 800px to 144.651855px in 3D
and -64px in flat mode after activation.

Raw evidence is retained in the review session's persistent `files` directory
(session `b1568aa9-cf76-46b3-bbdf-d0f5fd1d7768`), including:

- `final-integrated-gate.log`.
- `desktop-dark-review.json`, `tablet-light-review.json`,
  `production-desktop-dark-review.json`, `production-tablet-light-review.json`.
- `review-development-probe.js`, `review-browser-probe.js`,
  `fallback-layout-probe.js`, `fallback-layout-evidence.json`,
  `lightweight-performance.json`.
- `occluded-draw-before.log`, `occluded-draw-after.json`, `reduced-final.json`.
- `about-choreography-audit.md`, `about-hero-gate-audit.md`,
  `about-pin-eligibility-audit.md`, their timelines and per-beat metrics.
- `contact-delivery-evidence.txt` and before/after JSON, images and test logs.
- `keyboard-before.log`, `projects-pacing-before.log`, `cue-layout-before.log`,
  `idle-html-before.log` and the earlier rise/title/scroll-track evidence.
- Final production contact/projects/Home screenshots, `reduced-3d-final.png`,
  `reduced-flat-final.png`, and the visible Saint Joseph screenshot.

Earlier `reduced-3d.png` and `reduced-flat.png` show the pre-reposition defect;
they are not the final corrected screenshots. The fallback width probe's first
after-run exposed a measurement mistake: subtracting `innerWidth` included the
native scrollbar and returned -8px. The final assertion uses
`scrollWidth - clientWidth`, preserving the actual no-horizontal-scroll goal.

### Implementation commits

| Commit | Correction |
| --- | --- |
| `742a940` | Resume suspended beats rather than skip them |
| `a86e7b0` | Publish title completion once at the exact endpoint |
| `c527f11` | Preserve Projects rail layout during Contact exit |
| `4e7d8df` | Remove unresolved school-seal style |
| `473d66b` | Respect reduced motion in Skills, Contact and heading reveals |
| `34c757c` | Complete spent chapters without another scroll publication |
| `2a698e8` | Remove CSS competition with frame-owned entrance properties |
| `748356b` | Serialize About and its full reverse |
| `779dac4` | Wait for the completed hero cue |
| `d524e85` | Hide About until the handover is eligible |
| `fb4134a` | Reject unconfigured delivery instead of simulating success |
| `d58cea8` | Repair idle geometry before chapter consumers |
| `4296e3a` | Preserve native logo keyboard activation |
| `c37a338` | Finish Projects focus on its own clock |
| `9ac46bb` | Suppress draws behind extended opaque pin coverage |
| `552ecfa` | Contain the hero plate's horizontal fallback bleed |
| `1a9188a` | Serialize cue handover/return and preserve precise visible geometry |

## Missing tests

Target-device presentation/GPU timing, Firefox/WebKit, physical touch gestures,
the original screenshot/deployment reproduction, exhaustive runtime
preference/theme toggles, actual provider delivery/abuse controls and a
maintained project-wide browser runner remain outside the completed evidence.
No unsupported confidence claim replaces those tests.

## Final verdict

**Withhold approval and merge.** The reproduced local defects are corrected,
committed and materially better covered; the final implementation passes the
required local gate and complete browser journeys. The requested all-10/10
outcome has not been established. Further work must resolve or causally explain
the remaining tablet cadence and obtain the original seal-incident evidence,
then close the relevant device/deployment verification gaps. No changes were
made merely to manufacture a passing score.

## Follow-up: Education reader and original hero journey

The subsequent user request changes Education from distance-selected records
to deliberate reading stages and restores the arrow's original Hero-to-About
journey. This follow-up does not retroactively change the baseline verdict.

The first isolated reproduction selected records 1, 2 and 3 within **63.8ms**,
before the About title completed. The new controller waits for that completion,
the full opening/crossing timeline and a **1200ms visible reading pause**.
Each accepted wheel wave or native control activation selects one record.
Momentum, early gestures and repeated keys are discarded, not queued.
Visibility changes preserve the remaining pause. Explicit navigation and both
terminal exits are covered, including button-only reading and reverse re-entry.

The arrow again starts below the departed hero and travels into About, rather
than beginning already anchored at the destination. Its spatial request has a
bounded visible-frame drawing speed. Original tangent-continuous paths and
current-flow animation remain; on narrow margins the curve is reflected inward
to avoid clipping without moving the landing vertical.

Fresh production-bundle journeys at 1440x900 dark and 1024x768 light verified:

- An initial +12000 wheel leaves Education at record 0. A separate uninterrupted
  85-event wave causes exactly one crossing; a fresh wave advances once more.
- Next/Previous, full forward release, last-record reverse entry and full Home
  return succeed. Native Space changes exactly one record and spends **0px**
  of page scroll. Button-only reading releases to visible Skills; Home navigation
  requested during a crossing waits rather than interrupting it.
- Navigation and footer follow the visible Education stage, not hidden Contact.
  The light toolbar's composited text contrast is **10.49:1**.
- Cue-box-to-heading gaps are **36.013px / 36.002px**. The first partial stroke
  starts at visible hero-space y **764.6px / 644.6px**, rather than above the screen.
- No page errors occurred. Lightly instrumented reverse-heading rAF cadence has
  p95 **16.7ms**, worst **22.3ms**, at both sizes. The previous 38.9ms p95 was not
  reproduced by this probe, which avoids repeated computed-style and geometry
  sampling during motion. These are delivered rAF intervals, not a universal
  GPU-presentation or physical-device guarantee.

The complete local gate passes **121 files / 1138 tests**, with the same four
existing skips, plus ESLint, application TypeScript and the production build.
Obsolete distance-to-record helpers and their tests were replaced by mounted
completion, gesture, navigation, visibility and ownership regressions.

Evidence includes `education-before.json`, `education-pacing-before-clean.log`,
`hero-origin-wave-before.log`, `education-exits-before.log`,
`education-arrow-final-gate.log`, `education-arrow-1440-dark.json`,
`education-arrow-1024-light.json`, `hero-curve-inward.png` and
`education-light-readable-chrome.png` in the same session artifact directory.

**Integration remains pending:** the requested animated hero cloud has not yet
been integrated or verified. No main push, merge or redeployment is represented
by this follow-up gate.
