---
name: agent-efficiency-and-mcp-workflows
description: "Optimizes agentic speed, reasoning budgets, context window hygiene, surgical code modifications, and 100% local Bun closed-loop test-driven execution for the Portfolio React, Three.js, and Vite architecture."
---

# Agent Efficiency, Context Hygiene & Verification Standard (Portfolio Architecture)

This skill establishes operational protocols for autonomous agents working on the Portfolio (React, Vite, Three.js / React Three Fiber, Framer Motion, GSAP, Tailwind CSS) to maximize execution speed, eliminate hallucinations, protect the context window, and guarantee 100% local verification.

---

## GROUP A — Adaptive Reasoning & Context Window Hygiene

### 1. Dynamic Reasoning Budgeting
- **High-Budget Mode (3D Math, Shaders & Architectural Debugging)**: Allocate deep reasoning tokens exclusively during 3D scene lifecycle architecture, WebGL shader math, matrix transformations, asset loading bottlenecks, and root-cause debugging.
- **Low/Zero-Budget Mode (Execution & Tool Calling)**: Drop reasoning overhead when applying surgical CSS/JSX diffs, running local Vite/Bun test commands, or formatting output.

### 2. Context Window Hygiene & Token Efficiency
- **Line-Bounded Reads**: Never dump entire component or 3D asset files into context when inspecting localized hooks or styles. Enforce targeted grep and line-bounded reads (`StartLine` / `EndLine`).
- **Log Pruning**: Parse Vitest, TypeScript, and ESLint outputs, retaining ONLY the failing stack traces, error markers, and line numbers. Avoid polluting context with passing logs.

---

## GROUP B — 3D & Frontend Anti-Slop Precision

1. **WebGL Lifecycle & GPU Safety**:
   - Always verify that geometries, materials, and textures are properly disposed of on unmount to prevent WebGL memory leaks.
   - Maintain a rigid 60 FPS performance budget: favor CSS transforms / GPU-accelerated properties over continuous heavy CPU re-renders.
2. **Quantitative Dominance & Tabular Layouts**:
   - Use tabular numbers (`tabular-nums` / `font-mono`) for numerical values, stats, and coordinates to prevent layout shifts.
3. **Touch Targets & WCAG Compliance**:
   - Enforce 48x48px minimum touch targets on mobile viewports.
   - Maintain minimum 4.5:1 contrast ratios on dark backgrounds.

---

## GROUP C — Atomic Execution & 100% Local Verification Loop

For every code modification, adhere strictly to this closed-loop cycle:

```text
[1. REPRODUCE/LOCATE] -> [2. PLAN SURGICAL DIFF] -> [3. IMPLEMENT DIFF] -> [4. LOCAL BUN VALIDATE] -> [5. SELF-CORRECT]
```

1. **Surgical Patching Over File Replacement**:
   - Apply localized search-and-replace patches instead of rewriting complete source files to protect 3D canvas references, state bindings, and event handlers.
2. **100% Local Verification via Bun (Zero CI Waiting)**:
   - `bun test` or `bun x vitest run` (Unit & branch tests)
   - `bun run build` (Vite production bundle compilation)
   - `bun run lint` (ESLint verification)
   - `bun x tsc --noEmit` (TypeScript strict typecheck)
3. **Automated Self-Correction**:
   - If tests or builds fail, inspect the exact error line and apply targeted patches in an automated verify-fix loop (up to 3 retries) before requesting user guidance.

---

## GROUP D — Safety & Boundary Constraints

- **Never Disable Tests**: Never comment out or weaken failing test assertions.
- **Never Break 3D Scenes**: Do not remove existing 3D features, camera paths, or animation controllers to force a passing build.
