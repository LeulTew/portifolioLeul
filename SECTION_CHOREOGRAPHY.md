# Section Choreography

How every section on the 3D portfolio arrives, holds, and leaves.

The goal is that each section reads as a composed shot rather than a pile of
elements that happen to fade in together: layers arrive in a deliberate order,
hold while you read, and resolve out as you scroll past.

This document is the contract. Adding choreography to a new section means
picking its cues and wiring the two hooks below — not inventing new timing.

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
  { id: 'backdrop', at: 0,    duration: 0.90, engine: 'framer' },
  { id: 'portrait', at: 0.18, duration: 0.70, engine: 'framer' },
  { id: 'title',    at: 0.32, duration: 0.90, engine: 'gsap'   },
  ...
];
```

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
