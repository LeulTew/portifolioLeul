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

## 🛠️ Tech Stack

| Category           | Technologies                                  |
| :----------------- | :-------------------------------------------- |
| **Core**           | React 18, TypeScript, Vite                    |
| **3D & Animation** | React Three Fiber, Drei, Framer Motion, GSAP, Anime.js |
| **Styling**        | Tailwind CSS, CSS Modules                     |
| **Testing**        | Vitest, React Testing Library (100% Coverage) |
| **Deployment**     | Vercel                                        |

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
adding another scroll trigger. Supporting copy adapts
[BlurText](https://reactbits.dev/text-animations/blur-text)'s word-by-word
overshoot and focus; labels, dates and GPA adapt
[DecryptedText](https://reactbits.dev/text-animations/decrypted-text)'s sequential
original-character reveal. Both use the chapter clock instead of one-shot
observers, independent timers, or per-frame React state. Blur is bounded to one
small filter per phrase. Decryption preserves the original accessible text and
its layout while painting at most ten precomputed, record-wide cipher steps.
HiLCoE folds its title into place, Saint Joseph uses a letterpress arrival,
Boot.dev decodes its name, and freeCodeCamp uses a lateral letter wave.
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
WebP assets and resolves from white to color below its selected builds. The
academic logos are unchanged. The two freeCodeCamp records carry lightweight
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
