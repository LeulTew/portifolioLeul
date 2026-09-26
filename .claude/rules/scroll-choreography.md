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
per-frame layout through `left`. The rail measurement alone owns the portaled
mark's `--cue-height`; the per-frame driver re-runs when the intro becomes ready
and must never clear it, or the long viewBox fits the 300px fallback and the
line stops short of About on loads where nothing re-measures. Once pinned, its
tip shares the title's two-axis displacement. The centered heading is then set
on its own 600ms `HEAD_REVEAL` clock, triggered by the stretch beginning; its
masks never read the scroll-mapped head presence directly, so stopping one
notch in cannot leave the title or subtitle sliced. The centered composition
holds for 250ms of visible time after it is fully set, then docks on one 1100ms
beat without an extra gesture latch.
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

**Terminal keys are navigation, not gestures.** Home and End go where the
navbar's Home and Contact go (`storyKeys.ts`), with the same release of pinned
chapters, still passively: the browser's own jump happens too, to the same
place. They request no beat and are not forwarded to the track as a scroll.
*Why:* a pinned chapter cannot follow a jump -- its beats play one at a time --
so End left About on screen over the end of the page (round 8, D-FLAT-002).
Line and page keys stay gestures, one beat at a time.

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

**Projects TV handoff (2026-09-16):** the final Skills request carries one
coordinated handoff: its plate withdraws over the existing 600ms departure,
then the original island spline turns visibly for 2200ms. Actual departure
start/completion owns this seam; neither a physical Projects position nor
scrolling harder may skip it. There is no empty-world gesture stop between
withdrawal and turn. The first input after the turn completes, including a
continuing wheel/touch stream or held key, requests the separate 1400ms approach.
Input during either movement is discarded, not queued; no post-movement pause.

The revised CRT uses the existing measured display plane and an authored,
lightweight housing in place of the faceted scan. A single
body-level semantic DOM reader projects onto that plane from the existing camera.
Its native CSS-pixel reading size is independent of WebGL DPR. Tabs sit above the
bezel; the common chamfer controls select projects without a second animation
dependency or autoplay. Full descriptions and technology remain reachable in Details.

**User-revised screen browsing:** wheel input on the normal display selects
projects, including while a broadcast transition or CRT power-on is moving.
Normalize pixel/line/page deltas and trackpad direction before applying the
distance threshold. One native event requests at most one page; discard its
excess after a step so a hard notch cannot bank later changes. Reversing input
resets accumulated distance. Never gate selection on `isAnimating`, elapsed
cooldown or a fresh wave after animation. Buttons, tabs and lateral selection
are immediate too. Latest selection wins: dispose the old reveal and retarget
the current image/lower-third score. Loop first/last within the current category;
screen browsing never implicitly exits to Contact.

Expanded Details is the intentional native-reading exception: display wheel,
touch and page-scroll keys stay native and do not select another project or
request a scene movement. Its explicit Preview action returns to browsing.
The reader fills
the existing rectangular aperture without rounded transparent corners exposing
the paused ambient video beneath it.
Left/right project shortcuts belong to the reader itself, not focused tabs,
links, buttons, fields or scrollable text. Outside the display, vertical
input requests scene continuation/reversal; it is never cancelled.

CRT power-on is a bounded horizontal beam -> vertical opening -> raster settle,
not a flicker loop or simple whole-reader fade. Keep controls live throughout.
Reduced motion shows the readable screen directly. Broadcast text keeps its
original semantic content; no interval-driven accessible glyph scrambling.
Power/reveal frames advance only while visible and are disposed on retarget,
navigation, preference changes and unmount.

Only the readable TV on fine-pointer, non-low-tier, motion-enabled clients has
small pointer parallax. Cache viewport geometry outside frames; use the actual
rendered camera for DOM projection. Departure starts at the real offset pose,
then blends that offset out on the authored approach clock. No per-frame React
state, independent CSS camera transition, extra WebGL context or carryover to
another chapter. Hide both ordinary and ink-mirror footer paints only while
Projects owns the viewport; do not leave two competing scroll instructions.

Reverse retreats from the display, retraces the turn, then requests the trailing
Skills pose with an immediate `edge: 'end'` landing. Keep the last camera pose
until the returning Skills plate is actually opaque. A return from Contact
starts at the real current camera pose, not a guessed or reset establishing aim.
Forward departure now replaces the old retreat with one 2000ms rise into the
Contact cloud clearing; it does not append another flight after that retreat.
Capture the real TV pose, including its current pointer offset. Camera and
grade sample the same visible-time progress, and reverse retraces that path
from the actual parked camera to the current viewport's fitted TV pose.
During progress 0.66 through 0.92, reveal the actual Contact heading and form
under the existing owner, not an extra entrance after the flight. Only the
single section's outer paint overrides inherited cover visibility and
counter-translates after Drei HTML; its controls remain inert until release.
Do not release Contact until the terminal camera frame has been committed by
the existing renderer. Navbar Contact settles the clearing and readable DOM
directly, cancelling both unfinished clocks and pending endpoint receipts.
The form remains the same native DOM subtree; its draft, focus, edit keys and
textarea scrolling never become scene requests. While Projects owns the viewport, later
entrances remain unspent, earlier pinned paint cannot reclaim it, and physical
About ranges cannot suppress the visible 3D world. Ownership, cover, inert and
projection registration release together. The existing render governor and
quality budgets remain in force; ambient TV decoding pauses while the screen
is owned. Reduced motion cuts to readable poses, with a flat reader when the TV
is unavailable or the viewport cannot support its spatial composition.
A native return owed from Contact also gates earlier chapters before Projects
claims: a hard upward flick must not let Education or Skills win the subscriber
order and skip the TV. Navbar intent and unavailable/stopped staging clear that
gate; it never selects Projects while Contact is being read.
After a natural departure has fully completed, the first upward input event can
request that return even if its wheel wave or held key began during departure.
Pre-completion input is discarded, never queued. Explicit navigation cancels
this continuation allowance; outside entry after navbar intent still requires
a fresh input wave. No timer or post-departure pause is added.
Accepted upward return keys from navbar/body focus bridge to the actual Drei
scrollport because it is not their native scroll ancestor. The scoped policy
is ArrowUp40px, PageUp90% of the scrollport height, Home to its top. Keep focus
where it is; do not cancel events or remove the position gate. Do not forward
while a beat is active, after navbar cancellation without new intent, from
inside the native scrollport, or from editables/display/details/tabs and native
arrow-owning controls. Modified platform shortcuts remain native.

**Navbar-only bypass (2026-09-16):** a navbar click or native keyboard activation
may explicitly skip intervening beats. Carry `source: 'navbar'` through the
navigation channel, settle physical and damped scroll together, and use each
owner's existing painters/cleanup to release active text, covers, inert state
and pending landing glides. Skills opens directly at its first settled pose.
This exception must never be inferred from scroll position, an automatic
chapter landing, wheel, touch, or scroll keys. Natural forward/reverse scrolling
still plays every required movement and must have separate regressions.

**One view owner (2026-09-25):** a chapter whose portalled reader takes the
window (Skills' stage, the TV) holds a `claimView` from
`src/lib/scroll/viewOwner.ts` for exactly as long as it shows, and releases it
with its cover. The story's `main` is inert while any claim stands; the newest
claim names the chapter on screen for Tab order. Never set or clear `main`'s
`inert` directly, and never infer ownership from whether `main` happened to be
inert when an effect started: a handoff or a motion-preference remount then
reopens the story under the TV or leaves Skills unclaimed. A chapter's reader
marks `data-arriving` while its entrance is still moving, so a navbar landing
waiting on it does not age; landing waits age by capped visible frame time,
never wall-clock time, and never through a hidden tab. A navbar choice made
while the track is about to rebuild (a resize) is kept and taken again once the
new geometry is in place, instead of restoring the pre-resize offset over it.

**A layout change keeps the reader's chapter (2026-09-26):** when a chapter
remounts between its staged reader and its linear page -- a motion preference
changed, or a window crossing the stage's size -- the new layout continues the
chapter being read. It is taken through navigation, as the navbar would (with
`anchor` naming the linear chapter's element), so the other chapters settle
around it and a rebuilding track takes it again; a staged reader resumes
settled, without an entrance, and focus lost with the old layout lands in it.
The reader's own input first, or a navigation elsewhere, cancels the resume.
Its own navigations carry `resume: true`, which is how it, and the replay of
it after a rebuild, are told from a new choice of Skills, which starts afresh
(round 15, TECH-050).

**A rebuild keeps the reader's place, not their pixel offset (2026-09-26):**
the 3D page samples where the reader is -- a chapter and a distance into it,
from what is drawn, while the layout is settled -- and a track rebuild
restores to it. Keeping the pixel offset put a Contact reader into Projects
once Skills re-staged above them. A replayed navigation re-announces its
place for two frames after a rebuild, as a restore does, or Drei damps back
to the target it held before; and a navbar choice made on a layout already
changed but not yet reported is kept for the rebuild (round 16, TECH-055).
Education keeps its record the same way Skills keeps its chapter, through a
`resume` navigation to About that About's other chapters leave alone (they
act only on navbar choices), and that App keeps across a rebuild just as it
keeps a navbar choice (round 17, TECH-058).
A scroll offset or a section ratio alone is not a reader's place: the staged
reader came back empty waiting for a gesture, and the linear page opened on
another chapter (round 14, D-MOTION-001).
A staged reader whose layout is being replaced claims nothing: the new layout
is committed before the old reader's cleanup runs, and its observers in that
frame see positions from a layout they no longer own (round 17; Education the
same, round 18, TECH-060). Any destination accepted after a choice was queued
for a rebuild retires that queued choice, a natural handoff included: the
replay otherwise wrote the older destination back over it (round 18, TECH-059).
The newest accepted destination owns the whole pending settlement, the restore
of the reader's old place as well as the replay: a natural handoff made while
a rebuild is still to land is kept for it and taken again after, as a navbar
choice is. A Contact handoff made as a motion change landed mid-flight was
placed, then the rebuild put the reader back in Projects (round 19, TECH-061).

**A chapter enters where the one before it has left (2026-09-27):** where
a linear chapter leads into a staged one, the staged one enters once the
linear one has left the window, not only at its own edge. At the 900px
floor the stretch between them was all the window showed, empty, until
another wheel came (round 17, D-UX-005).

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
