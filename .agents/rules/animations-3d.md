# 3D Graphics & Animation Engineering Rules

## 1. Three.js & WebGL Context Lifecycle
- **Strict Disposal**: Always dispose geometries (`geometry.dispose()`), textures (`texture.dispose()`), and materials (`material.dispose()`) when unmounting 3D components to prevent WebGL memory leaks and context loss.
- **Frame Loop Optimization**: Never allocate new objects (`new THREE.Vector3()`, `new THREE.Matrix4()`) inside `useFrame` or animation tick loops. Reuse pre-allocated scratch objects.
- **Model Compression**: All 3D assets (`.glb` / `.gltf`) must be optimized with DRACO or Meshopt compression and texture downscaling.

## 2. GSAP & Timeline Rules
- **Context & Cleanup**: Always wrap animations in `useGSAP` (from `@gsap/react`) with proper scoping, or clean up with `ctx.revert()` on unmount.
- **Transforms over Layout**: Animate GPU transforms (`x`, `y`, `scale`, `rotation`, `autoAlpha`) instead of layout properties (`top`, `left`, `width`, `height`).
- **ScrollTrigger Refresh**: Always call `ScrollTrigger.refresh()` after dynamic DOM or layout changes.

## 3. Framer Motion & Motion Rules
- **AnimatePresence Mode**: Wrap exiting elements in `<AnimatePresence mode="wait">` with defined `initial`, `animate`, and `exit` variants.
- **Shared Layout Transitions**: Use `layoutId` for smooth morphing transitions between navigation tabs and card expansions.

## 4. Anime.js v4 Rules
- **Modular Imports**: Import only required functions (`import { animate, createTimeline, stagger } from 'animejs'`).
- **Timer Management**: Cancel or pause anime timelines on component unmount to block background CPU drain.

## 5. Accessibility (A11y)
- **Reduced Motion**: Respect `prefers-reduced-motion`. Provide subtle fade transitions instead of large transforms or rapid 3D camera rotations for sensitive users.
