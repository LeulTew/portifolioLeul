# Section Choreography

How every section on the 3D portfolio arrives, holds, and leaves.

The goal is that each section reads as a composed shot rather than a pile of
elements that happen to fade in together: layers arrive in a deliberate order,
hold while you read, and resolve out as you scroll past.

This document is the contract. Adding choreography to a new section means
picking its cues and wiring the two hooks below — not inventing new timing.

The coverage-based lifecycle below describes the original sections. Held
chapters follow `.claude/rules/scroll-choreography.md` instead: position requests
a beat, visible time paces it, and a completed beat plus a fresh gesture releases
the next. Skills' implementation of that contract is documented in section 6.

---

## 1. The focus lifecycle

Every section moves through four phases, derived from how much of the
**viewport** it occupies (never from `window.scrollY`, which does not move on
this page — see `useViewportCoverage`).

| Phase | Coverage | What runs |
| --- | --- | --- |
| `away` | 0 | Nothing. Layers sit at their entry pose. |
| `entering` | rising past `ENTER_THRESHOLD` | The entry sequence plays **once**, on its own clock. |
| `focused` | at or near peak | Everything at rest. Only ambient loops continue. |
| `leaving` | falling after having entered | The exit is **scroll-linked**, not timed. |

Two deliberate asymmetries:

- **Entry is timed, exit is scrubbed.** An entry is a performance: it should
  play at its own pace regardless of how fast you scrolled in. An exit is a
  consequence of your scrolling, so it must track the scroll or it feels
  detached from your hand.
- **Entry plays once.** Re-triggering on every pass turns a composed reveal
  into a flicker. Exit, being scrubbed, is naturally reversible.

---

## 2. The entry sequence

An entry is an ordered list of **cues**. A cue names a layer, when it starts
(in seconds from the top of the sequence) and how long it runs.

```ts
export const HERO_SEQUENCE: readonly SectionCue[] = [
  { id: 'backdrop', at: 0,   duration: 0.70, engine: 'css' },
  { id: 'portrait', at: 0.6, duration: 0.55, engine: 'css' },
  { id: 'title',    at: 1.0, duration: 2.40, engine: 'css' },
  ...
];
```

### First-load visibility gate

The hero stays mounted beneath the loader so fonts, images, layout and the
scroll track can settle. Mounting is not permission to play its entrance:
`App` passes `introReady` only after the loader completes its exit. Until then
Home neither observes its entry coverage nor arms its entrance-settle backstop.
This keeps the name's snow/fill sequence from finishing under an opaque loader.
The original cue offsets, durations, scroll handover, re-entry and reduced-motion
behavior are unchanged. A recording must capture the visible empty, partial and
full name states before its first scroll, not just a finished Home screenshot.

### Ordering rule: ground before figure

Layers arrive back-to-front, the way a shot is lit:

1. **Backdrop** — the plate or scrim the section sits on. Establishes the stage.
2. **Anchor** — the one element the eye should land on first (a portrait, a
   section number, a headline rule).
3. **Headline** — the largest type.
4. **Supporting copy** — subtitle, body, metadata.
5. **Controls** — buttons, filters, links.
6. **Affordance** — the scroll cue. Always last: it invites the *next* move, so
   it must not compete with the content that just arrived.

Never start two cues at the same instant. Overlap is what makes a sequence feel
choreographed rather than staggered-by-formula, but simultaneous starts read as
a single pop.

### Engine choice

Both engines are already in the bundle. Pick per layer, not per section:

| Use | Engine | Why |
| --- | --- | --- |
| Backdrops, containers, whole-element enter/exit, presence | **Framer Motion** | Declarative, and it already owns the component tree. |
| Text broken into words/characters, anything needing a timeline with its own internal stagger | **GSAP** | Fine-grained timeline control and per-node stagger without a component per node. |
| Anything scroll-linked | **Neither** — derive it from coverage and write a style | A scrubbed value should be a pure function of scroll, not an animation with its own clock. |

GSAP work must be scoped in `gsap.context()` and reverted on unmount.
`@gsap/react` is deliberately **not** a dependency; `context()` covers it.

**The hero runs entirely on CSS**, and every entrance should. Both JS engines
apply a hidden start state synchronously and animate on `requestAnimationFrame`;
a tab served no frames keeps that state, and the section is simply absent.
Worse, entry is triggered by `IntersectionObserver`, whose callbacks arrive with
the rendering lifecycle — so no frames means no callback, no entry, and nothing
to rescue it. Every section therefore needs a **timer** that forces the finished
state, ungated by having entered.

---

## 2a. Techniques — what "arrive" actually means

A fade plus a translate is the default, and it reads as one: everything slides.
Reach for these instead.

### Reveal from behind an edge, don't fade in

Type should be **uncovered**, not faded. Wrap the line (or each character) so it
is clipped, and move it out from behind that clip:

- **Per character** — each char in an `overflow: hidden` inline-block, the char
  itself starting at `y: 115%`. Pair the clip with
  `padding-bottom: 0.14em; margin-bottom: -0.14em` or descenders (g, y, p) get
  cropped by the same edge that does the reveal.
- **Per line** — `clip-path: inset(100% 0 0 0)` resolving to
  `inset(0 0 -12% 0)`, with a small `yPercent`. The negative bottom inset stops
  the clip shaving the descenders once it has finished.

### Stagger should decelerate

A fixed interval per character marches. Space them on a curve —
`Math.pow(index, 0.82) * 0.045` — so the tail of a word settles instead of
arriving on a metronome.

### Lines are drawn, not faded

Anything that reads as a stroke — a rule, an underline, the scroll cue — should
**trace itself**. That means a real SVG `path`, never a `border-radius` box: a
border cannot be drawn on, so a box can only ever fade or slide.

Set `pathLength={100}` on the path and every dash length becomes a percentage,
independent of the geometry. Then animate `stroke-dashoffset` from 100 to 0.

Once drawn, a short bright dash (`stroke-dasharray: 7 93`) looping along the
same path reads as a current running down the line, and keeps the mark alive
without blinking it.

### Fill the glyph, don't move it

The strongest reveal for a headline is not motion at all: leave the glyph
unpainted and let the fill arrive inside it.

`-webkit-text-fill-color: transparent` on the character, a painted copy in an
`::after`, and a tall feathered gradient mask slid up through it. Use
`-webkit-text-fill-color`, never `color: transparent` — `color` would make
`currentColor` transparent for the painted copy too and the word renders as
nothing.

Angle the mask a few degrees off `to top` so the front crosses the glyph
diagonally; a level front reads as a wipe. Keep the angle **near 0deg**: near
180deg inverts the mask and the glyph is hidden at exactly the point it should
be full.

No outline. An outlined-then-filled letter reads as a colouring-in exercise;
an unpainted one reads as the fill arriving.

### Prefer CSS animation for anything that must not be left half-finished

GSAP and Framer both tween on `requestAnimationFrame`. A tab that is never
served frames keeps the start state — which for a reveal means **invisible
content**. CSS animations run on the compositor and finish regardless, so they
are the right tool for a draw-on or any reveal whose start state is hidden.

Where a JS tween is the right tool anyway, give it a timer backstop that sets
the finished pose. The backstop must clear **every** property the tween starts
from: a forgotten `clip-path` leaves a line invisible at full opacity.

---

## 3. The exit

The exit is one shared transform, applied to the whole section, derived from
coverage as it falls:

```
amount = 1 - clamp01(share / EXIT_THRESHOLD)   // 0 while focused, 1 when gone
```

`share` is the **raw** fraction of the viewport the section fills, and
`EXIT_THRESHOLD` is 1, so the exit tracks the scroll from the first pixel.

Do not drive it from the scrim's focus curve. That curve holds at 1 until a
section is nearly half gone, which leaves the section sitting untouched while
the reader is already scrolling past it — it reads as the page not responding.

and mapped to:

| Property | Range | Purpose |
| --- | --- | --- |
| `opacity` | 1 → 0.15 | Recede without disappearing abruptly. |
| `translateY` | 0 → -64px | Drift against the scroll, so it reads as depth. |
| `scale` | 1 → 0.965 | Pull back, never push forward. |
| `blur` | 0 → 5px | Defocus. This is the "out of focus" cue. |

Never exit to `opacity: 0` exactly. A hard zero makes the section vanish a beat
before it leaves the viewport, which reads as a bug.

Exit applies only **after** the section has entered, so a section scrolled past
upward on the way back does not exit while it is arriving.

---

## 4. Reduced motion

Under `prefers-reduced-motion: reduce`:

- Entry cues collapse to a single opacity fade, all at `at: 0`.
- The exit keeps **opacity only** — no translate, scale or blur.
- Nothing is removed. Legibility and hierarchy are not motion effects.

---

## 5. Adding a section

1. Define its cue list next to the others in `lib/motion/sectionChoreography.ts`,
   following the ordering rule above.
2. In the component:
   ```tsx
   const [element, setElement] = useState<HTMLElement | null>(null);
   const { hasEntered, exit } = useSectionFocus(element);
   ```
3. Put `style={exitStyle(exit)}` on the section's content wrapper.
4. Gate entry animations on `hasEntered`, delaying each by `cueDelay(SEQ, id)`.
5. Add the section to the choreography test's table so its ordering is checked.

The cue list is data, so the sequence is reviewable without reading animation
code, and the tests assert the ordering rules rather than specific numbers.

---

## 6. Skills: one continuous scene, six distinct capabilities

Desktop Skills is an **experience** surface: a light-first editorial stage,
distinct capability-specific assets and one readable group at a time.
All six categories and all 35 skills come from `data/cv.ts`. The short summaries
and presentations in `Skills/skillsData.ts` describe those capabilities, not
new credentials, employment, or performance claims.

| Capability | Primary visual subject | Headline / inner-label grammar |
| --- | --- | --- |
| Languages | Solid processor, pins, source code and output | Cipher resolution / short decoded labels |
| Frameworks & Web | Upright application window and mobile device | Component assembly / masked word assembly |
| AI & Data Science | Three beveled neural slices, shaded neurons, weighted routes and tensor-to-prediction flow | Focus / restrained word focus |
| Databases | Solid relational storage tiers and query/schema elements | Horizontal scan / bounded typed labels |
| Tools & Design | Beveled vector pen nib drawing a Bezier path | Curved character alignment / vector-line reveals |
| Professional Skills | Separate collaborating 3D modules | Bilateral alignment / word-emphasis reveal |

`skillGeometry.ts` authors compatible transition contours and signal paths.
`SkillSculpture.tsx` keeps one scene, but not one repeated ring or object:
solid surfaces, an application frame, a housing-free network, a sharp pen
outline, and separate modules have different visual structures. Shared features
morph while outgoing and incoming asset parts hand over. Continuity belongs
to the choreography, not to forcing every capability into an identical asset.
The neural instrument keeps its ten neurons anchored to the same eight
weighted routes in SVG and low-tier Canvas rendering. Three layer-level
animation groups replace per-neuron motion; material depth comes from
theme-aware vector gradients and bevels, not raster assets or blur filters.

The visual track alternates sides, banks and changes scale. Ground and
foreground construction lines have different relative travel and timing,
producing actual layered parallax during the clock-paced transition. Copy
also changes high/low alignment where the composition has room. The reading
measure remains bounded while the sculpture gets a wider track at 4K; very
wide, shallow windows use a height-aware content span.

### Playback and integration

`useSkillsPlayback.ts` owns a body-level portal, because the desktop's Drei
HTML layer is transformed and cannot hold a normal CSS sticky element.
It consumes the existing scroll-progress store and passive, wave-start gesture
subscription; it never cancels wheel, touch, or keyboard input.

`skillsTimeline.ts` builds one paused GSAP score. The first chapter reveals in
1.81 seconds and each subsequent crossing in 2 seconds. Input is ready on
the exact final animation frame, with no post-animation pause. Progress is
advanced with `phaseFrameDelta`, not mapped to scroll distance. An unfinished
crossing ignores new requests; input during movement is discarded, not
queued. Once the stage is active, the first wheel/touch/scroll-key event after
completion is accepted even if the same gesture is continuing. The reader need
not pause or release a held key. Outside-stage entry retains wave-start gating,
so leftover input cannot undo an explicit navbar destination. Reverse
seeks the same score back to its previous resting point.

Next/Previous use the same gate without consuming scroll distance. The next
action names its destination instead of presenting a generic slide control.
The six progress lines change when the new pose finishes, not over the outgoing
heading. A separate visible numeric fraction is omitted because it duplicates
those lines; the live accessible status retains the chapter name and position.
Each line is a named native button with an unchanged 2px visual stroke and a
48px-tall transparent hit area. Hover labels and keyboard focus identify the
destination. Explicit selection settles the requested skill directly, even
from a crossing; it does not play intermediate skills or move the scrollport.
The larger Previous/Next controls remain an alternative to the compact lines.
The final
**See projects** action and the first **Back to About** action release the
stage after its exit. Chapter-generated navigation can leave after the current
movement. Natural exits align the neighboring section only
when the reader has not already scrolled beyond the Skills rail. Natural
reverse returns to Education's trailing edge; only the labelled About button
jumps to About's heading.

Navbar activation is the intentional exception to scroll serialization. Its
`source: 'navbar'` intent settles the native scrollport and Drei position
together, releases old Skills/Education covers and pending landings, and settles
skipped Home/About beats through their existing state painters. It does not play
every intervening chapter. Direct Skills navigation shows its first settled
pose; subsequent scroll still plays every requested crossing at the same speed.
Automatic chapter landings (`immediate: true`) are not navbar bypasses.

Skills controls use the shared native `ControlButton` with its focus, disabled,
theme and hit-target rules. Navbar, Hero and these controls share the chamfer
geometry and brand values in `ui/controlFoundation.module.css`; the incumbent
navbar and Hero appearances are unchanged. Compact step controls do not inherit
the Hero's magnetic pointer effects or ambient tracer loop.
Both step controls are neutral at rest; the brand-lit surface is hover-only.
Keyboard focus keeps its visible outline without a persistent lit fill.

Skills and Education respect each other's stage ownership on return.
Natural forward entry waits for Education's explicit `data-education-released`
signal, not merely the absence of an active overlay. Direct Skills navigation
can skip earlier chapters deliberately. Ignored momentum never cancels a queued
navigation request, and a newer destination is honored after an in-flight exit.
On a track rebuild, App restores Drei's damped offset together with native
`scrollTop`, before publishing geometry. Otherwise a new zero-based scroll
state can briefly appear to revisit Education while the reader is in Skills.
Unconnected or zero-height rails never request an entry.
An About grid resize preserves its completed background ownership and the
remaining rise without adding a post-rise rest. The shared `reconcileScrollLayer`
cache avoids repeated scroll-layout reads caused by CSSOM serialization
rounding, without rounding the authored geometry.
`data-skills-active` keeps the global navigation on Skills even if a flick
has physically passed its spacer. The keyed `skills` world-occlusion owner
suppresses hidden world draws only while the stage is fully opaque, and clears
on departure, mode change, and unmount. Section-local handover cues remain
behind Skills; global navigation remains above it. Its white chapter-ink mirror
is attenuated by the Skills plate's actual opacity, not the green geometry
hidden underneath. About/Education surfaces hidden by `data-projects-covered`
cannot paint that mirror either; Projects claim/release refreshes the ink even
when scrolling has stopped. The obscured main content is inert only while Skills owns
the stage, so keyboard navigation cannot wander into hidden project controls.
The shared ownership-aware section-entrance hook waits for both About/Education
and Skills to release. It remeasures current viewport coverage, including the
existing entrance inset, instead of spending later headings or Contact's
entrance on an intersection cached underneath either stage.

### Motion, type, and fallback

React Bits' SplitText, DecryptedText, BlurText, TextType, ScrollReveal and
TiltedCard are adapted locally
in `SkillsMotion.tsx`. `skillTextMotion.ts` gives each capability its own score;
there are no competing per-text ScrollTriggers. React-owned word/character
masks wrap naturally as the self-hosted Space Grotesk font loads, without font
measurements or DOM replacement. The cipher is a clipped, generated paint,
not a React state interval or text that pollutes copy/paste. Supporting copy
and tool names receive quieter, capability-specific reveals. Inner labels
retain stable text and accessible list-item names; typing does not relayout
the list, run a React interval, or leave a perpetual blinking cursor.

Future text/detail tweens initialize lazily from scoped hidden poses instead
of doing SVG/text layout work for every offscreen capability. The instrument's
fine-pointer tilt uses GSAP `quickTo`, cached bounds, and no pointer-driven
React renders. It yields while the camera moves and reacquires bounds at the
new pose. Full quality uses the original vector sculpture and compatible
Bezier attribute interpolation, without a separate morph plugin.

Low-tier hardware keeps the same composition and morph, with fewer compatible
contour segments. Its material is batched into a single 720x580 Canvas 2D paint
in a compositor-friendly HTML layer alongside the SVG details, using the same
geometry and cached theme colors. This
avoids repeatedly laying out multiple SVG surface copies while the material
changes. Supporting labels and details remain vector-based. No WebGL context,
video, shader, image-generation service, or animation dependency is added.
Low quality omits pointer tilt, unused perspective/depth contexts, headline blur,
duplicate draft/rim strokes and detail-scale effects. Its headline grammars use
word-sized units instead of individual glyphs, and supporting labels use plain
text with restrained row motion instead of mounting hidden character masks.
Ground parallax and the asset transformations remain.
If Canvas 2D is unavailable, a warning is emitted and SVG remains the renderer.
Quality is fixed for the mounted material and text so contour topology and
animation units cannot change under an in-flight tween.

Button tracers under the inert main content pause while Skills owns the opaque
stage; invisible border loops must not keep invalidating style behind it.
The shared reversible chapter-cover helper also hides the covered composited
HTML and old pinned overlays once Skills is fully opaque, without changing
their geometry or hiding the native scrollport. It restores their original
visibility and markers before a transparent departure, on tab suspension, and
on unmount. Global navigation and the Skills stage remain outside that cover.

There are no ambient animation loops. The movement clock stops at completion
and pauses in hidden tabs. The active artifact can respond to the pointer;
inactive artifacts do no animation work. GSAP contexts, frame requests,
media-query/theme listeners, the optional material painter, and ownership are
cleaned up together.

The stage fits viewports at least 900px wide and 560px tall. Smaller windows
and `prefers-reduced-motion` receive the entire toolkit in normal document
flow with static, fully readable SVG instruments; this fallback needs no canvas.
Both preferences are reactive.
The separate mobile portfolio and the desktop's existing mobile redirect are
unchanged. Skills has scoped light/dark material tokens and a fluid composition
up to 4K; its self-hosted font does not change any neighboring section.

React Bits' application-use license and attribution ship at
`public/licenses/react-bits.txt`. The font's SIL Open Font License ships at
`public/fonts/OFL.txt`. Do not redistribute these adapted components as a kit.

### Local regression coverage

`Skills.playback.test.tsx` exercises persistent geometry/opacity and parallax
in addition to slow/flick timing, continued wheel/touch/held-key input,
completion gates, direct progress selection, reverse playback, both terminal exits, explicit
navigation, Education ownership, hidden and stalled frames, idle writes,
live reduced-motion/viewport changes, and cleanup. `Skills.test.tsx` retains
the complete CV content and verifies the canvas-free fallback. Geometry and
typography tests assert compatible topology and different actual animation
mechanisms, not merely different preset names. Browser checks
must also traverse Education -> Skills -> Projects and reverse, both themes,
low-height desktop layouts, 4K, keyboard controls, and no-WebGL mode.
Review transition recordings and intermediate frames: passing functional
checks alone cannot establish continuity, motion variety, or design quality.

## 7. Contact: the cloud clearing above the island

Contact keeps its existing heading, form, contact details, social destinations
and submission flow in one semantic DOM subtree. The scene moves toward the
reader's next task; the form is not a 3D texture or duplicated portal, and its
native reading/input surface is not pinned. Form state is not reset when
camera ownership changes.

The Projects Contact request replaces its former 1400ms outward approach with
one 2000ms TV-to-clearing flight. `useProjectsPlayback` remains the input and
visible-time owner; `contactScene` carries its frame-readable progress and final
camera receipt. `CinematicCameraController` is still the sole camera writer.
`ContactFlight` captures the actual offset TV pose, clears the cabinet, rises
above the island and tilts up toward a quiet opening. FOV stays at 50 degrees.
There is no additional orbit, transport sequence, input cooldown or scroll scrub.
The TV controls recede on that same progress, rather than covering the sky.

During the flight's final easing (progress 0.66 through 0.92), the actual
Contact subtree overrides only its inherited cover visibility. Its existing
heading and form entrances are pre-settled while their shared outer paint
reveals on the flight clock. A priority-0.75 painter counter-translates that
one section after Drei's HTML update; it never moves native scroll or clones
fields. The complete form is visible before the camera endpoint, not followed
by another 0.8-second arrival. Other kinetic-heading consumers keep their defaults.

Projects retains its existing cover, projection and inert ownership through
the final drawn sky pose, then clears the temporary Contact paint and settles
the native/Drei Contact landing once. Editing becomes native at that release;
navbar bypass exposes it immediately. A pending endpoint receipt is cancelled on explicit navigation,
preference changes and cleanup. Hidden time is excluded; stalled visible frames
spend at most 50ms. Natural reverse waits for the measured Projects boundary,
captures the real current sky pose and retraces the flight to the fitted display.
The following TV-local retreat still uses its original framed shot.
The existing return-owed and outside-Drei held-key policies remain intact.
Field focus/input invalidates old scene intent; field keys and wheel/touch input
inside Contact editables do not request camera travel or queue a later return.
A subsequent page-wheel event outside those editables may return normally even
while the textarea retains focus. Do not blur a field or make focus a global
camera lock.

Explicit `source: 'navbar'` Contact navigation parks the sky and exposes the
heading/form immediately without playing intermediate chapters or waiting for
cloud textures. Reduced motion uses settled poses too. Compact flat readers
remain normally scrollable; no-WebGL Contact uses the same form with a static,
non-interactive cloud treatment. Low tier uses fewer static banks. These are
degradations of decoration, not gates on reading or sending a message.

The cloud group reuses the baked Home assets without altering Home. It adds no
Canvas, atmospheric loop, light, shadow, postprocess or reflection pass.
Contact uses main-camera layer 2, leaving the horizon's layer 1 untouched and
the water mirror on its existing default layer. Cleanup restores only the
cloud layer's previous bit and disposes only owned resources, including late
texture arrivals. Optional asset failure is reported and cannot block the form.
`ChapterGrading` alone blends the existing fog/lights on flight progress;
the scene's background `Color` and `Fog` objects remain intact. At rest the
clouds and grade perform no repeated writes. Theme-aware local reading surfaces
replace full-viewport blur, retaining native text sizes and a bounded content
width through 4K.
On a first navbar Contact visit without a captured TV grade, reverse targets
the existing scroll-mapped grade, not the nominal Projects table index. The
committed return frame and subsequent normal grade must agree without recoloring
the prior TV design.

Regression coverage includes captured/parallax endpoints and intermediate
reverse poses, fixed flight duration, final-frame ownership, navbar cancellation,
held keys, form draft preservation, protected editables, hidden/resumed frames,
reduced motion, optional assets and owned-resource cleanup. Browser review must
also inspect both themes, compact desktop/4K framing, visible cloud continuity
and the real native form. Submission checks must mock or block EmailJS; never
send a real message as a visual or navigation test.
