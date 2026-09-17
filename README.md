<div align="center">

# ✨ Leul Tewodros Agonafer - Interactive 3D Portfolio ✨

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React Three Fiber](https://img.shields.io/badge/React_Three_Fiber-8.x-049EF4?style=for-the-badge&logo=three.js&logoColor=white)](https://docs.pmnd.rs/react-three-fiber/)
[![Test Coverage](https://img.shields.io/badge/Test_Coverage-100%25-success?style=for-the-badge&logo=vitest&logoColor=white)]()
[![Status](https://img.shields.io/badge/Status-Deployed-success?style=for-the-badge&logo=vercel&logoColor=white)](https://portifolio-leul.vercel.app)

**[🔴 LIVE DEMO: portifolio-leul.vercel.app](https://portifolio-leul.vercel.app)**

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Highlights](#-key-highlights)
- [Performance Optimization](#-performance-optimization)
- [Tech Stack](#-tech-stack)
- [Local Development](#-local-development)

---

## 🚀 Overview

Welcome to my **Interactive 3D Portfolio**. This project is more than just a showcase of my work; it's a demonstration of modern web engineering capabilities. Built with a focus on **performance**, **interactivity**, and **clean architecture**, it features a fully navigable 3D environment where users can explore my skills and projects in an immersive space.

## 🏆 Key Highlights

- **Immersive 3D Experience**: A fully interactive 3D world powered by **React Three Fiber**, featuring a custom-optimized avatar and dynamic environment that pushes the boundaries of web performance.
- **Engineering Excellence**: A bulletproof codebase with **100% Test Coverage** across all metrics, ensuring rock-solid reliability and maintainability.
- **Performance Masterclass**: Achieved a massive **97% payload reduction** (130MB → 3.3MB) through aggressive asset optimization, delivering a lightning-fast experience even on mobile.
- **Modern & Scalable Architecture**: Built with the latest tech stack—**React 18, TypeScript, Tailwind CSS**—and designed for scalability, accessibility, and developer experience.

## ⚡ Performance Optimization

I achieved a **97% reduction** in initial load payload through aggressive asset optimization.

| Asset Type   | File Name           | Original Size | Optimized Size | Reduction |
| :----------- | :------------------ | :------------ | :------------- | :-------- |
| **3D Model** | `me.glb`            | **18 MB**     | **1.3 MB**     | **~93%**  |
| **3D Model** | `terrain-1k.glb`    | **83 MB**     | **19 MB**      | **~77%**  |
| **Video**    | `Significant.mp4`   | 27 MB         | 4.4 MB         | ~84%      |
| **Video**    | `Spy_Movie...mp4`   | 1.6 MB        | 713 KB         | ~55%      |
| **Image**    | `Clustering.png`    | 6.1 MB        | 272 KB         | ~95%      |
| **Image**    | `IrisDatasetML.png` | 5.7 MB        | 256 KB         | ~95%      |
| **Image**    | `leul-profile.png`  | 1.6 MB        | 41 KB          | ~97%      |
| **Image**    | `pharmacy.jpg`      | 527 KB        | 45 KB          | ~91%      |

_> Total payload reduced by over **150MB**._\_

### Island outline and scene edge continuation

The source terrain is a tilted 60-unit heightfield tile. `bun run bake:island`
reshapes only its outer fringe into unequal headlands and recesses, preserving
the core and every triangle touching the avatar's complete foot-contact zone,
the padded TV footprint, or the prism. This changes the actual top edge and land
volume, not just the faces of the old rectangular tile. Interior position and
normal streams, original UV coordinates, embedded texture bytes, mesh counts and
vertex/triangle counts are preserved. One outer diagonal is flipped in the
optimized asset to prevent a measured 3D reversal in a long, thin source face;
its two replacement faces carry the existing vertices and UVs. No protected
or unchanged vertex participates. Meshopt is used for lossless buffer encoding without global
requantization. Both optimized and software assets are baked independently.
Original terrain heights and the already submerged forward fringe are retained.

`SceneEdgeContinuity` joins each final decoded boundary with its matching static,
faceted shoulder and sloped submerged foot. It borrows Terrain's already-uploaded
albedo and material response, keeps the boundary's original UVs, and samples
inward on the lower rings instead of stretching one border texel down a wall.
The existing 512-square shore field is rebaked from the final
terrain **and** the skirt at waterline -4, with the same origin `[-90, -110]`,
180-unit span and 48-unit distance range. `bun run bake:shore` can regenerate
only that field; neither command changes the wave algorithm.

Pristine inputs are pinned to commit
`6a02c49edb33b30e4f0c6d416a5a32fb3f43e03d` and checked by SHA-256. A shallow clone
missing that object must run `git fetch origin 6a02c49edb33b30e4f0c6d416a5a32fb3f43e03d`
before baking. The baker never feeds already-shaped output back into the
transform. Edit `src/lib/scene/terrainOutline.ts`, then run `bun run bake:island`;
commit both GLBs, `terrainRim.ts`, `terrain-outline-bake.json`, and
`public/images/shore-field.png` together. The generated manifest records actual
counts, hashes, byte sizes and measured shore-registration error and supplies
the existing loader's byte estimates.

A separate 32-segment horizon strip still feathers
the fully fogged sea into the actual background at radii 320-900. It matches the
existing theme's water alpha and Three's output-color-space fog; fragments before
full fog are discarded. The existing swell ends at radius 70 and is untouched.

The continuation still uses **2 draws in the main view and 1 in the existing
reflection**. Optimized terrain has 684 skirt triangles (748 with the horizon;
1,432 on a reflection-update frame). Software terrain has 656 (720 with the
horizon; 1,376 on a reflection-update frame). The original terrain triangle counts
remain 113,858 and 75,158. It owns two geometries and two materials, adds no
textures, transparent fill, render targets, shadow passes, or animation loops.
Layer 1 is reserved for the main-only horizon; the skirt remains on layer 0.
Effect-owned resources survive StrictMode's rehearsal and dispose independently
of Terrain's borrowed texture. These are geometry/draw budgets, not an FPS guarantee.

### Floor-standing TV speaker cabinet

`CRTSpeakerCabinet` replaces the two narrow supports with one integral graphite
lower enclosure, a broad recessed perforated grille, a restrained satin brow and
a closed, full-width ground plinth. It inherits the upper receiver's materials
without changing `CRTHousing`, the 0.55 x 0.32 display aperture, screen transform,
reading-camera fit, project reader or broadcast/input behavior.

The lower cabinet uses **264 static triangles / 3 draws** per view and 600 stored
vertices, with no added lights, shadow casting, render pass, animation loop or
Canvas. When all three batches are visible to the existing water mirror, a
reflection-update frame can submit **528 triangles / 6 draws** across both views;
there are no cabinet shadow submissions. Its opaque 32 x 32 RGBA grille tile is
4,096 bytes before mipmaps (5,460 bytes with the complete mip chain), shared by
the material's color and bump inputs. R3F owns the three declared geometries/materials; the grille
material disposes only its own generated texture. Ground tests raycast both
actual terrain variants and the cabinet buffers, including the full underside
and grille clearance, rather than inferring contact from the former feet. The
terrain has pre-existing voids, independently confirmed in the loaded scene.
A strict 561-cell footprint mask records those original gaps; every gap must
have measured soil on opposite sides within 0.7 world units, beneath the
continuous closed cabinet. New misses fail. The grille clears actual terrain
hits and the measured edges of voids, with no invented ground or terrain edits.

## 🛠️ Tech Stack

| Category           | Technologies                                  |
| :----------------- | :-------------------------------------------- |
| **Core**           | React 18, TypeScript, Vite                    |
| **3D & Animation** | React Three Fiber, Drei, Framer Motion, GSAP, Anime.js |
| **Styling**        | Tailwind CSS, CSS Modules                     |
| **Testing**        | Vitest, React Testing Library (100% Coverage) |
| **Deployment**     | Vercel                                        |

About's paired squares unfold into their corresponding text blocks, left first,
then right, on the existing arrival/swap/clear clock. Shape transforms and text
clipping share geometry measured only on layout changes; reverse travel folds
the second statement back into its square. There is no separate scroll exit,
animation loop, or added rest. Inside the morph, the left thesis hinges open
before its ink reveal; the right lead resolves from its exposed edge, with
quieter supporting copy and opposing-axis metadata. These derived text windows
finish and reverse on the same phase values. Readable desktop copy remains
selectable and forwards wheel travel to the real scrollport without cancelling
input or doubling native document scrolling. Narrow and reduced-motion layouts omit the
decorative geometry. Passive highlight labels use shared surface/ink tokens,
compact typography and square corners rather than blurred button-like pills.
Project filters retain their rounded control shape, use the same theme tokens
and type scale, and expose 48px targets, visible keyboard focus and pressed state.

Education uses a paused Anime.js timeline for split typography and credential
artwork, driven by the existing GSAP chapter clock. Each record transition is
authored as one second, with no independent animation loop or post-animation
cooldown. Text starts late enough to remain visibly animated as the incoming
record enters, in either direction. About retains navigation
ownership until Education releases the
viewport; natural departure lands on Skills rather than spending later sections
behind the reader. Narrow and reduced-motion layouts expose every record in
normal document flow.
Explicit Home/About navigation starts a fresh Education chapter; natural upward
return from Skills preserves the trailing record. Shared kinetic headings and
Contact panels use ownership-aware one-shot entrances, so crossing their
geometric bounds under the covered chapter does not consume their animations.

Certification totals use explicit lower bounds in `cvData`, independent of the
featured course lists. The displayed years describe those selections, not the
completion date of every credential in the total.

The credential artwork adapts [React Bits TiltedCard](https://reactbits.dev/components/tilted-card)
to the existing Framer Motion runtime: pointer-local springs, cached geometry,
and immediate reset when a record stops being interactive. The typography takes
its splitting approach from [SplitText](https://reactbits.dev/text-animations/split-text),
but its finite glyphs are authored in React and animated by Anime.js rather than
adding another scroll trigger. Each institution has its own text profile and
cue order, including different treatments within the course lists:

- HiLCoE pairs a folded heading/award with lateral assemblies and
  a decimal [CountUp](https://reactbits.dev/text-animations/count-up) GPA.
- Saint Joseph alone uses center-out letterpress and smooth word-level ink reveals.
- Boot.dev decodes its name and selected metadata, types its build titles using
  [TextType](https://reactbits.dev/text-animations/text-type), and varies the
  coursework with discrete terminal scans and resolving text.
- freeCodeCamp alone uses alternating letter/word waves and
  [BlurText](https://reactbits.dev/text-animations/blur-text).

These motion families are exclusive to each institution, including its metadata
and individual course rows; repetition is allowed within one record, not across
records. Pairwise ownership and actual intermediate trajectories are covered by
regression tests.

These adaptations retain the chapter clock instead of adding one-shot observers,
independent timers, or per-frame React state. The one soft-focus phrase uses one
small filter, never per-word blur surfaces. Typing keeps whole-word layout slots
so partial words do not jump between lines. The source text remains accessible
and selectable while aria-hidden paint layers change. Cipher frames are bounded
to ten steps; typing and counting use at most 24 precomputed steps and preserve
exact final values. All text and transient perspective finish inside the same
one-second crossing and are restored to plain, unpromoted text before input
becomes ready.
Reveal painting is bounded to 60fps on high-refresh displays; the existing track
clock remains unchanged and the exact completed frame is never skipped.
The [React Bits license](public/licenses/react-bits.txt)
is MIT plus Commons Clause, not unrestricted MIT. Bricolage Grotesque is
self-hosted with its [SIL Open Font License](public/fonts/OFL-BricolageGrotesque.txt).

While the Education stage is opaque, the covered HTML and old pinned overlays
stop painting; the scrollport and layout remain available. They are restored
before the stage uncovers them. Their temporary `data-education-covered` marker
also pauses invisible button tracers, avoiding animation-driven style work.
The same tracer guard applies when Skills makes `main` inert; visible button
motion is unchanged. Settled Drei translations cache CSSOM's rounded
serialization, avoiding repeated layout reads and false progress publications
on high-refresh displays.
Anime timelines are assembled without intermediate composition and initialized
once, so adding glyphs and rows does not repeatedly seek partially built motion.
Every incoming record replays its text and artwork, including backward crossings
and re-entry from Skills. Reverse arrivals mirror the glyph direction and decode
order, not the semantic text. Completed reveals are disposed immediately, so
reading retains no text filters, transforms or cipher work. Frame departure stays
simple and uses the same completion gate.

Boot.dev's supplied color and white artwork is cropped into small transparent
WebP assets, with no rectangular backing: white at rest, color only on hover.
Hover owns the image crossfade; the arrival clock only animates their wrapper.
Its desktop record is a two-tone editorial layout using the same mineral paper
and pine ink: a larger display title, readable build ledger, and full-height
curriculum column. The white mark sits on that contrasting curriculum surface,
not loose on the paper. Rows share the available space without adding an inner
scroll area, fake project links, invented totals, or a longer animation lock.
Saint Joseph keeps its green disc at rest and removes it in the colored hover
state. Academic artwork assets are unchanged. The two freeCodeCamp records carry lightweight
algorithm-flow and responsive-layout SVG illustrations, not invented issuer
badges. These draw on the same reveal clock and add no pointer or scroll traps.

## ⚙️ Local Development

```bash
# 1. Clone
git clone https://github.com/LeulTew/portifolioLeul.git
cd portifolioLeul

# 2. Install
bun install

# 3. Configure Environment
# Create .env.local and add your EmailJS credentials:
# VITE_EMAILJS_SERVICE_ID=...
# VITE_EMAILJS_TEMPLATE_ID=...
# VITE_EMAILJS_PUBLIC_KEY=...

# 4. Run
bun run dev
```

All three EmailJS settings are required for contact-form delivery. Missing or
incomplete configuration shows the existing send-error message and preserves
the entered fields; the form does not simulate successful delivery.

---

<div align="center">
  <p>Made with ❤️ by Leul Tewodros Agonafer</p>
</div>
