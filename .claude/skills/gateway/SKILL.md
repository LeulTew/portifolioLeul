---
name: skill-gateway
description: Central orchestrator and routing gateway for all animation and design skills (Three.js, Framer Motion, GSAP, Anime.js, Impeccable). Use as the primary gateway to select, combine, and execute the optimal animation engine for any UI component, 3D scene, or interactive interaction with 60fps performance and zero library conflict.
---

# 🚀 Master Animation & Design Skill Gateway

## 1. Skill Selection Matrix (When to Use Which Engine)

| Capability / Use Case | Primary Skill | Secondary Skill | Why? |
| :--- | :--- | :--- | :--- |
| **3D World, Models, Shaders, Water, Terrain** | `threejs` | `gsap` | Three.js / R3F manages WebGL scene graph, geometry, and GLSL shaders. |
| **UI Components, Cards, Docks, Tabs, Modals** | `motion-framer` | `impeccable` | Framer Motion handles React layout animations (`layoutId`), enter/exit, gestures. |
| **Complex Scroll Timelines, Scrubbing, Pinning** | `gsap` (ScrollTrigger) | `threejs` | GSAP ScrollTrigger provides the most reliable scroll scrubbing and timeline coordination. |
| **SVG Path Morphing, Canvas Particles, Number Tickers** | `animejs` | `impeccable` | Anime.js v4 provides lightweight zero-overhead SVG morphing and stagger choreographies. |
| **Design Quality, 90/10 Colors, Contrast, Anti-Slop** | `impeccable` | - | Impeccable defines visual hierarchy, spacing, typography, and clean aesthetic standards. |

---

## 2. Cross-Skill Integration Patterns (The 4 Gateways)

### 🌉 Gateway 1: 3D Scene + React DOM HUD Orchestration
- **Three.js (`Canvas`)**: Renders background 3D models, water shaders, ambient lighting.
- **Framer Motion (`<motion.div>`)**: Renders reactive HUD overlays, navigation docks, and interactive project cards with spring gestures.

### 🌉 Gateway 2: Scroll Orchestration & Timeline Sync
- **GSAP ScrollTrigger**: Controls camera orbit/pan coordinates and scene rotation based on page scroll position.
- **React State / Drei `useScroll`**: Feeds normalized scroll progress `[0..1]` into R3F `useFrame` loops without layout recalculations.

### 🌉 Gateway 3: Micro-Interactions & SVG Morphing
- **Anime.js v4**: Drives intricate SVG shape morphing, loader progress rings, and fast particle physics.
- **Impeccable Design Token System**: Enforces 90/10 color distribution (`#00ff9d` / emerald-400 accent) with 4.5:1 WCAG contrast.

### 🌉 Gateway 4: Performance & Memory Disposal Guard
- WebGL GPU cleanup: Always invoke `.dispose()` on geometries, textures, and custom shaders.
- Animation Context cleanup: Always wrap GSAP in `useGSAP` scope and Framer Motion in `<AnimatePresence>`.
- Frame Loop Budget: Zero memory allocation inside `useFrame` / tick loops.
- Accessibility: Respect `prefers-reduced-motion` across all engines.
