---
name: motion-framer
description: Modern animation library for React and JavaScript. Create smooth, production-ready animations with motion components, variants, gestures (hover/tap/drag), layout animations, AnimatePresence exit animations, spring physics, and scroll-based effects. Use when building interactive UI components, micro-interactions, page transitions, or complex animation sequences.
---

# Motion & Framer Motion

## Overview
Motion (formerly Framer Motion) is a production-ready animation library for React and JavaScript that enables declarative, performant animations with minimal code.

**When to use this skill:**
- Building interactive UI components (buttons, cards, menus, docks, hero cards)
- Creating micro-interactions and hover effects
- Implementing page transitions and route animations
- Adding scroll-based animations and parallax effects
- Animating layout changes (resizing, reordering, shared element transitions with layoutId)
- Physics-based spring animations and gestures (hover, tap, drag)

## Core Concepts & Patterns
- **Motion Components**: `<motion.div>`, `<motion.button>`, `<motion.path>`
- **Animate / Initial**: `initial={{ opacity: 0, y: 20 }}`, `animate={{ opacity: 1, y: 0 }}`
- **Spring Physics**: `transition={{ type: 'spring', stiffness: 400, damping: 25 }}`
- **Variants**: Container stagger and child propagation
- **Layout & LayoutId**: Morphing components across layout shifts or tab bars
- **AnimatePresence**: Exit transitions on component unmount
- **Scroll Hooks**: `useScroll`, `useTransform`, `useSpring`, `useInView`
