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

---

## 3. The exit

The exit is one shared transform, applied to the whole section, derived from
coverage as it falls:

```
amount = 1 - clamp01(coverage / EXIT_THRESHOLD)   // 0 while focused, 1 when gone
```

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
