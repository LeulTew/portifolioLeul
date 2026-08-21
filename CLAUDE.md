# 🚀 Portfolio Projects Development Rules & Guidelines

> [!IMPORTANT]
> **MULTI-PROJECT WORKSPACE CONTEXT**:
> - **Main Project (Desktop)**: Root directory (`./` - `portifolioLeul`). Interactive 3D Portfolio built with React, TypeScript, Three.js / React Three Fiber, Tailwind CSS, Vite.
> - **Sub Project (Mobile)**: `./portifolioXLeul`. Mobile-optimized portfolio site built with React, TypeScript, View Transitions API, Tailwind CSS, Vite.

---

## 🎨 Skills & Design System Gateway
Loaded modular skills are available in `.agent/skills/` (and `.claude/skills/`):
- **`gateway`**: Master Skill Gateway orchestrating Three.js, Framer Motion, GSAP, Anime.js, and Impeccable.
- **`impeccable`**: Design quality, anti-slop vocabulary, visual polish, and critique tools.
- **`threejs`**: 3D web graphics, R3F, Drei, shader materials, WebGL lifecycle & disposal.
- **`gsap`**: GSAP v3 core, timelines, ScrollTrigger, Flip, Draggable, and `@gsap/react`.
- **`motion-framer`**: Motion & Framer Motion components, variants, layout animations, spring physics.
- **`animejs`**: Anime.js v4 timeline sequences, SVG morphing, and staggered animations.
- **`agent-efficiency-and-mcp-workflows`**: Dynamic reasoning allocation, context hygiene, line-bounded reads, surgical patching, and 100% local Bun closed-loop verification.

---

## 📋 Rule Categories
Detailed rule modules are located in `.agent/rules/`:
- [`workflow.md`](./.agent/rules/workflow.md): Commit conventions, WSL fish GitHub CLI (`gh`), issue pipelines, **Local Bun Verification (Zero CI Waiting)**.
- [`ui-design.md`](./.agent/rules/ui-design.md): 90/10 color distribution, WCAG contrast, mobile touch targets (48x48px), anti-slop rules.
- [`animations-3d.md`](./.agent/rules/animations-3d.md): WebGL memory disposal, 60fps budget, GPU transforms, reduced motion a11y.
- [`review.md`](./.agent/rules/review.md): 16-Phase Production-Grade Code Review Contract (100% Local Bun Verification).
- [`PRODUCTION_GRADE_REVIEW_PROMPT.md`](./.agent/rules/PRODUCTION_GRADE_REVIEW_PROMPT.md): Canonical review standard.

---

## ⚡ Local Verification Mandate (ZERO CI WAITING)
- **GitHub Actions is OVER LIMIT**: Do NOT wait for or check remote GitHub Actions CI.
- **Always verify locally via Bun**:
  - `bun test` (Unit & branch tests)
  - `bun run build` (Vite build)
  - `bun run lint` (ESLint)
  - `bun x tsc --noEmit` (TypeScript typechecking)

---

## 🛠️ GitHub CLI Mandate (WSL Fish)
- Execute all `gh` commands, issues, and PR workflows inside WSL Fish: `wsl fish -c "gh <command>"`.
