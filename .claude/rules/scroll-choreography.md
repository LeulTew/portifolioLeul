# Scroll Choreography Contract

> [!IMPORTANT]
> Every scroll-driven animation on this site obeys this contract. It is not a
> style preference — each clause below exists because breaking it shipped a
> specific, reproducible defect. The defect is named next to the rule so the
> rule cannot be "simplified away" by someone who has not hit it yet.

The whole contract in one line:

> **The reader scrolls; we show them one controlled movement; it plays at its own
> speed and finishes; and nothing they do in the meantime can rush it, skip it,
> stack another on top of it, or make it pop.**

---

## 1. One trigger decides both entering and staying

A beat asks exactly one question to decide whether it should be running, and
the same question decides whether it stays running.

- **Do:** `phaseGate(position, wasActive, enter, exit)` where `exit < enter`.
- **Never:** enter on one condition (a scroll gesture, a flag) and sustain on a
  different one (a position threshold).

*Why:* two conditions disagree everywhere except at the threshold. About's beats
once entered from a sticky gesture flag and sustained from a position, so each
one computed active on one frame and inactive on the next, forever. Every swing
registered a scroll block, so input was cancelled on roughly every other frame
and the reader could never travel to the position the sustain condition wanted.
The gate was the reason its own precondition could not be met.

Preconditions (§4) may be **AND**-ed in. They are not a second trigger: they are
monotone, they have a terminal state, and while satisfied the expression reduces
to the position gate alone.

---

## 2. Position triggers; time paces

Scroll decides *whether* a beat runs. Elapsed time decides *where it is*.

- **Do:** `advancePhase(state, active, dt, durationMs)`.
- **Never:** map scroll offset straight onto animation progress.

*Why:* a scrub inherits every irregularity of the hand driving it — a wheel notch
is a ~100px jump, trackpad momentum arrives in uneven deltas, a dropped frame
lands as a visible step. No easing fixes that, because the input is lumpy.

**Fixed speed is observable and must stay so:** the same beat driven by a slow
scroll and by a hard flick takes the same wall-clock time. Measured, not assumed.

**Home-to-About refinement (2026-09-13):** after the scoped `f46b247` restoration,
the user explicitly requested a whiter fog-wave cloud, a redesigned arrow and a
large centered About title that moves to the top left. Copy and cloud
disappear together on the same 900ms exit. The 2026-09-14 refinement starts
the requested arrow during that dissolution, not after it. These are overlapping
layers of one handover; About still waits for both to finish, including the
committed SVG endpoint rather than only its queued React update. The stroke
and foreground share their initial position trigger, so a small wheel movement
does not dissolve the cloud while leaving the arrow waiting for a second input.
This earlier request preserves the existing rail origin, length and landing.
The stroke draws visibly toward its scroll-requested target; its upward movement is never
interpolated independently. It follows the incoming section's actual rendered
scroll transform at 1:1 speed. Use the measured line length to reach the title,
not a different travel speed or an arbitrary shortening cap. A spent flick pins
the unfinished stroke at its landing instead of carrying its drawing offscreen.
Its three wider S turns span the measured rail instead of collecting at the top
above a long straight tail. Both axes use the same composited translation, not
per-frame layout through `left`. Once pinned, its
tip shares the title's two-axis displacement. The centered composition holds for
250ms of visible time, then docks on one 1100ms beat without an extra gesture latch.
Statements wait for actual docking and a 250ms visible reading pause.
Reverse waits for statements, retraces the same pose, then fades before releasing
the pin. Reduced motion keeps the normal inset without a travel animation.
Cloud dissolution belongs to the vapor's own mask/wisps, never a whole-bank slide.
Keep that wave in view until it finishes before exposing About. On return, the
cloud reforms only after About and the arrow have released the screen. Its
neutral-white, translucent footprint follows the actual text and button bounds,
not an empty full-width flex row. The arrow retains its original mint in both
themes, including hover and the current pulse, with a non-scaling 2.4px stroke.
Spatial chrome retains its existing animation behavior.

The fixed chrome uses a second, non-interactive white paint through the
**same live SVG mask** as About Me. LT, navigation labels, Scroll to explore
and the year are not recolored by row majorities, scroll thresholds or a timed
whole-element fade. Education/static green edges clip this viewport-sized
paint to their actual bounds. About Me's existing mask and animation duration are unchanged.

Suspended frames are not visible time. `phaseFrameDelta` caps each movement
and its post-movement rest at 50ms per paint; a hidden tab or long task must
resume the remaining movement, never complete it in a single frame.

---

## 3. Never cancel the reader's input

- **Never** call `preventDefault`, `stopPropagation`, or
  `stopImmediatePropagation` on `wheel`, `touchmove`, or `keydown`.
- Gesture listeners are registered `passive: true`, which makes cancelling
  impossible rather than merely discouraged.
- **Never** use `scrollTo({behavior:'smooth'})` against the `ScrollControls`
  scrollport — it writes `scrollTop` every frame and silently cancels the smooth
  scroll. Ease it by hand and yield on user input.

*Why:* the predecessor of `scrollGesture.ts` absorbed wheel events whenever an
animation was registered, and a flip-flopping beat therefore pinned the reader
in About with the page refusing to move.

**Holding the reader's attention and taking away their scroll are different
things.** Only the first is allowed. Everything in §4–§6 achieves sequencing
without ever touching an event.

---

## 4. Beats are serialised by completion, never by distance

A beat may not start until the one before it has **finished**.

- **Do:** AND in the previous beat's completion flag, published when it settles.
- **Never:** rely on the gap between two thresholds to keep them apart.

*Why:* the reader picks the speed. Any two thresholds are crossed in a fraction
of the first beat's duration by an ordinary flick, so no distance is safe.
Widening the gap cannot fix it and blocking the scroll is not allowed.

---

## 5. A beat also waits to be asked, and then waits a moment longer

After the previous beat completes, the next one needs **a scroll gesture made
after that completion**. The remaining statement handoffs have a **250ms**
reading cooldown; full animation completion is always required.

- Gestures during a beat: **ignored**.
- Gestures during the cooldown: **discarded, not queued**.

*Why:* completion alone does not make stages read as separate — a reader
spamming the wheel is still producing gestures at the instant the flag lands, so
the chain runs through as one compound movement. And queuing an early gesture
lets spam work simply by arriving early, which is the same failure wearing a
delay. The reader has to ask again.

`BEAT_COOLDOWN_MS` in `aboutBeats.ts` is the statement reading knob.
`BEAT_REST_MS` is the 250ms visible rest at the centered heading and before copy.

Background completion is published on the final animation frame, without a
post-rise rest. The next title request is accepted immediately after that
completion. In reverse, the background accepts a request immediately after the
title finishes returning, and statements accept one immediately after the
background finishes retreating. There are no additional cooldowns at those
boundaries. Early requests still cannot interrupt or queue behind unfinished
movements; shorter statement pauses do not replace their completion checks.

The Education handoff is automatic: **title completion immediately starts
opening the first card**, without another pause, gesture, or physical rail
threshold. The frame and completed title remain owned through the opening.
Reverse closing releases the title immediately on completion, and re-entry
from Skills opens the last record without a separate opening request.

Education records also have no post-animation cooldown:
a **new input wave** is accepted **as soon as the full GSAP timeline finishes**
(including seal and rows), with no extra reading or settle pause. Readiness is
published by completion itself, never by a later timer or scroll update.
Record crossings finish in **one second in either direction**: the track,
artwork, title and rows settle together instead of extending the input lock with
subtle animation tails. Row stagger uses a bounded total amount, not a delay per
row, so dense cards cannot take longer. Do not enable controls before completion.
Seal arrival transforms belong to untransitioned wrappers; hover transforms
stay on the inner artwork so CSS cannot extend the completed GSAP movement.
The Education typography and artwork use a paused Anime.js timeline sought by
that same GSAP clock on every arrival. The 2026-09-14 text refinement replays all
card copy and artwork on backward crossings and re-entry too; never interpret
the direction as an animation-enable flag. The desktop text refinement gives
each record its own exclusive text-motion families, not a shared blur/decode
template: HiLCoE uses folds, lateral assemblies and a counting GPA; Saint Joseph
uses center-out letterpress and smooth word-level ink reveals; Boot.dev uses
typed builds, decoded metadata and discrete terminal scans; freeCodeCamp uses
letter/word waves and soft-focus text. Individual course rows vary inside those
profiles too. A family may repeat within one institution, never across
institutions, including metadata, awards and group labels.
Start them late enough to remain visible after the track
exposes their side of the card. Everything still finishes in the shared second.
Mirror incoming glyph direction and decode order on return. Frame departure
remains simple. Dispose the reveal at completion, restoring plain text and
removing transient filters, transforms, clips and text-paint layers before enabling input.
Use only a small phrase-level blur, not a filtered surface per word. Precompute
and batch text frames across the record; leave the source text accessible and
in layout. Typing preserves whole-word slots so a growing prefix cannot jump
between lines; counters preserve the exact source precision. Cipher frames have
ten steps, and typing/counting have at most 24. Perspective is enabled only while
the visible record is revealing. Paint arrivals at most 60 times per authored second on high-refresh
displays, always publishing the exact terminal frame. Do not throttle the track
or introduce a second clock. Institution-specific title profiles, the small
supplied Boot.dev mark, and the two certification diagrams share this timeline.
No second playback loop,
independent completion timer, or engine sharing the same element's transform.
Dispose the previous reveal when changing records and on unmount.
The React Bits artwork tilt runs only on the interactive record with a fine
pointer. Its inner Motion spring is separate from Anime's arrival wrapper,
caches pointer geometry, and resets immediately before a crossing or when hidden.
No pointer-following tooltip, persistent promotion, or idle animation loop.
Build each Anime reveal with timeline composition disabled and initialize it
once after adding its explicit endpoints. Keep the native scrollport visible
while suppressing covered HTML/pinned-overlay painting; restore that painting
before departure reveals the page.
A wave ends after 250ms without wheel input; this groups momentum, not a pause
added after completion.
Sub-threshold motion cannot consume its start. Waves started during a crossing
are discarded, never queued or retriggered on completion. Touch momentum and
repeated keys cannot become additional requests. Next/Previous use the same
completion gate, without spending scroll distance. Native control activation
remains native.

**Skills completion refinement (2026-09-16):** active Skills accepts the first
wheel/touch/scroll-key event after its exact final animation frame, including a
continuing gesture or held key. Do not require a 250ms quiet interval or a new
wave between Skills. The existing 1.81-second entrance and 2-second crossings do
not speed up; input before completion is discarded, not queued. Outside-stage
entry still uses wave starts. Education's separate fresh-wave policy is unchanged.
The progress lines are explicit navigation controls: selecting a named skill
settles that pose directly without replaying intermediate chapters or scrolling.

**Navbar-only bypass (2026-09-16):** a navbar click or native keyboard activation
may explicitly skip intervening beats. Carry `source: 'navbar'` through the
navigation channel, settle physical and damped scroll together, and use each
owner's existing painters/cleanup to release active text, covers, inert state
and pending landing glides. Skills opens directly at its first settled pose.
This exception must never be inferred from scroll position, an automatic
chapter landing, wheel, touch, or scroll keys. Natural forward/reverse scrolling
still plays every required movement and must have separate regressions.

---

## 6. A movement is never skippable, and never plays to an empty room

- The section stays pinned while the chapter **still owes a movement** — not
  merely while one is mid-flight.
- The terminal state must exist at **both** ends, so the hold always releases.
- An `IntersectionObserver` may not hide a section whose chapter is still
  playing.
- Past the end of the stretch a transition beat **stops waiting to be asked**.
  Education opens directly on title completion, but its readable records are
  an explicit exception: they never auto-advance from a spent scroll position. A fresh
  wave or Next/Previous activation is still required for every record.
- Education keeps the completed About title owned through its handoff and
  reverse, and resumes the About underlay before disappearing. Navigation stays
  on About while its sequence or Education is visible, regardless of the
  physical sections under the overlay. Explicit global navigation may leave as
  soon as the current movement completes. Natural forward departure always
  aligns Skills: wheel travel spent reading cards must not skip later sections.
  Publish `data-education-released` only when forward closing actually completes;
  clear it on a new claim, backward reset, or cleanup. While Skills publishes
  `data-skills-active`, Education must not reclaim the viewport. Observe its
  release so an already-requested return can open without another gesture.
  A final one-shot settlement at the closing boundary synchronizes the native
  scrollport, Drei offset, and HTML transform, even if momentum interrupted the
  initial glide. This adds no timer or input listener; subsequent native input
  remains native. Explicit navigation cancels this pending automatic landing.
  Apply the same settlement to the reverse About landing.
  Later viewport-driven entrances remain unspent while covered, and resume from
  their freshly measured coverage when the chapter releases ownership, never a
  cached intersection from a section behind the overlay.
  Shared kinetic headings and Contact's actual Motion triggers use the same
  ownership-aware entrance hook, not independent `whileInView` one-shot latches.
  Explicit Home/About navigation resets an outside Education chapter to its first
  record; only the natural upward Skills return preserves its trailing record.
- Cooldowns wake themselves when they expire; pin release observes completion.
  Neither may depend on another scroll publication after the reader stops.
- Publish local sequence measurements before their animation consumers, even
  when a return jumps across the entire spacer. A completed forward chapter
  still needs its reverse request.
- Reconcile an idle Drei HTML layer with its settled, physical scroll position.
  A rebuilt track can have zero delta while retaining an old transform; that
  geometry repair must notify consumers even if normalized progress is unchanged.
- Skip world draws while a fully opaque overlay remains pinned beyond its
  physical range. Clear that coverage on release, hide, and unmount; a
  translucent boundary must never suppress the world behind it.

*Why:* beats serialised by §4 leave gaps where the chapter is unfinished and
nothing is animating. A flick crosses the whole spacer inside the first gap, the
pin releases, and the remaining movements play correctly and on time to nobody
above the fold.

Equally: a hold with no terminus never releases. A fixed, full-viewport overlay
pinned on a sticky attribute covered every later section with "Education"
painted on top of Skills, Projects and Contact.

---

## 7. Nothing pops

- **Continuity at every boundary.** Whatever phase *N* leaves on screen, phase
  *N+1* starts from exactly that value — in both directions, because beats
  reverse.
- **No CSS transition on a property JavaScript writes every frame.** The
  transition retargets before it arrives, so the rendered value lags and never
  lands. Discretely-switched properties (a `data-` attribute flipping) are the
  opposite case: there the transition *is* the animation.
- **Reveal, don't relayout.** Move a mask's position, don't regenerate its
  image; animate transforms and opacity, never `top`/`width`/`height`.
- Preserve fractional cue geometry and the authored 36px gap. Title and arrow
  must share the same progress and measured center/rest coordinates, not chase
  one another's previous-frame rectangles.

*Why:* opacity jumping 0 → 0.6 at a phase edge flashed on scrolling down and off
scrolling up. A clearing phase that restarted its own sweep relit every dot below
its cut for one frame — a sparkle across the heading as it resolved.

---

## 8. Reverse is the way down, played backwards

Scrolling up shows the same movements in the opposite order.

- Beat *N* may not reverse until beat *N+1* has fully reversed.
- **Never** hard-snap a beat to rest because the position says so while a later
  beat is still leaving.

*Why:* position releases them in the wrong order — the earlier beat's threshold
is crossed first — so the copy walked back in over a chapter that had not
finished leaving.

---

## 9. Two paints of one thing must be one thing

Where an effect needs a second paint of the same content (a two-tone heading
split by a moving boundary — CSS cannot do that in one paint), the copy is a
**mirror**, not a lookalike.

- Every write reaches both through **one call**.
- The copy inherits none of the original's entrance, shadow, or transition.

*Why:* a hand-built copy drifted — hardcoded text that never followed the real
heading, an extra reveal transform, a drop shadow — and the pair read as two
badly-registered headings, because that is what they were.

---

## 10. An idle frame costs nothing

Subscribers publish from inside the render loop, so their work runs
synchronously on every frame of the whole page. The overwhelming majority of
frames are still ones.

- Guard every `setAttribute` / `setProperty` / `dataset` write:
  `writeAttribute`, `writeStyleProperty`.
- Attributes on `#about` are watched by `body:has(...)` selectors, so a
  redundant write there costs a document-wide selector re-evaluation.

*Why:* an idle frame was costing 51 redundant DOM writes. It is pinned at 0 by
`idleWriteCost.test.tsx`, which is the shape any new subscriber should be held
to.

---

## Verifying a change against this contract

Local only — GitHub Actions is over quota.

```bash
bun x vitest run && bun run lint && bun x tsc -p tsconfig.app.json --noEmit && bun run build
```

Behaviour that a unit test cannot prove — smoothness, ordering as seen — is
checked by driving a real browser and recording, not by looking once:

- frame distribution per beat (p50/p95/worst, count over 32ms),
- the attribute timeline through the chapter, forward and reverse,
- `defaultPrevented` on every wheel event (must be 0, always).

A claim that is not measured is reported as unmeasured.
