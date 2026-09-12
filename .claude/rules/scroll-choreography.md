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

The hero cue is intentionally a spatial connection, restoring its original
journey from below the hero into About. Scroll requests a point on that path;
`advanceCue` bounds its drawing speed and `cueTravel` moves the origin through
the matching path, so even a flick cannot skip the visible journey. It starts
as soon as the copy has left, while the cloud disperses, not only after
About's landing arrives.
On a tight heading margin, the same tangent-continuous curve bends inward
instead of being clipped by the viewport; its landing vertical stays unchanged.
Home publishes handover completion for About;
the heading must not appear over unfinished hero movements. Reduced motion
publishes the complete mark to both the SVG and its CSS visibility properties.

The fixed chrome uses a second, non-interactive white paint through the
**same live SVG mask** as About Me. LT, navigation labels, Scroll to explore
and the year are not recolored by row majorities, scroll thresholds or a timed
whole-element fade. Education/static green edges clip this viewport-sized
paint to their actual bounds. About Me's existing mask and timing are unchanged.

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
after that completion**, and not until a cooldown has elapsed.

- Gestures during a beat: **ignored**.
- Gestures during the cooldown: **discarded, not queued**.

*Why:* completion alone does not make stages read as separate — a reader
spamming the wheel is still producing gestures at the instant the flag lands, so
the chain runs through as one compound movement. And queuing an early gesture
lets spam work simply by arriving early, which is the same failure wearing a
delay. The reader has to ask again.

`BEAT_COOLDOWN_MS` in `aboutBeats.ts` is the knob.

Education records require a **new input wave** after their complete GSAP
timeline (including seal and rows) and a 1200ms visible reading pause. A wave
ends after 250ms without wheel input; sub-threshold motion cannot consume its
start. Touch momentum and repeated keys cannot become additional requests.
Next/Previous use the same completion and reading gate, without spending
scroll distance. Native control activation remains native.

---

## 6. A movement is never skippable, and never plays to an empty room

- The section stays pinned while the chapter **still owes a movement** — not
  merely while one is mid-flight.
- The terminal state must exist at **both** ends, so the hold always releases.
- An `IntersectionObserver` may not hide a section whose chapter is still
  playing.
- Past the end of the stretch a transition beat **stops waiting to be asked**.
  Education may open this way, but its readable records are an explicit
  exception: they never auto-advance from a spent scroll position. A fresh
  wave or Next/Previous activation is still required for every record.
- Education keeps the completed About title owned through its handoff and
  reverse, and resumes the About underlay before disappearing. Explicit global
  navigation may leave after the current movement and reading pause. A natural
  exit aligns the next section only if the reader has not already left the rail.
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
- Preserve fractional cue geometry and compose the heading displacement in a
  transform. Independently rounding the rail height, origin and displacement
  makes the authored 36px escort gap vary during the journey.

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
