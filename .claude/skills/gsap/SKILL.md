---
name: gsap
description: GreenSock Animation Platform (GSAP v3) master skill. Use when creating advanced animation sequences, complex timelines, ScrollTrigger pinning/scrubbing, Flip layout animations, Draggable UI, SVG morphing (MorphSVG), and high-performance framework-agnostic web animations.
---

# GreenSock Animation Platform (GSAP)

## Overview
GSAP is a high-performance JavaScript animation platform suitable for complex timeline sequencing, scroll-driven interactions, and SVG manipulation.

## Core Capabilities
- **GSAP Core**: `gsap.to()`, `gsap.from()`, `gsap.fromTo()`, `gsap.set()`
- **Timelines**: Precise sequencing, relative positioning (`'+=0.2'`, `'-=0.1'`, `'<'`), labels
- **ScrollTrigger**: Scroll scrubbing, pinning, snapping, responsive triggers via `ScrollTrigger.matchMedia()`
- **React Integration**: `useGSAP(() => { ... }, { scope: containerRef })` with automatic context reversion
- **Plugins**: Flip, Draggable, ScrollTo, SplitText, MorphSVG (all 100% free)
