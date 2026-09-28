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
- [`scroll-choreography.md`](./.claude/rules/scroll-choreography.md): **The scroll animation contract.** One trigger per beat, position triggers and time paces, never cancel input, beats serialised by completion, gesture + cooldown before the next, nothing skippable, nothing pops, reverse mirrors forward. Read before touching any scroll-driven animation.
- [`review.md`](./.agent/rules/review.md): 16-Phase Production-Grade Code Review Contract (100% Local Bun Verification).
- [`PRODUCTION_GRADE_REVIEW_PROMPT.md`](./.agent/rules/PRODUCTION_GRADE_REVIEW_PROMPT.md): Canonical review standard.

---

## 🚦 Vercel Deployment Rule (owner directive, 2026-09-27)
- This site deploys on Vercel, on an account shared with other projects and capped at **100 deployments per rolling 24 hours**.
- Deploy **only** when (a) the owner explicitly tells you to, or (b) the work is finished: every quality metric at 10/10, everything merged, migrations applied, nothing pending. Then deploy once.
- A deployment is anything that makes Vercel build: pushing any branch or opening/updating a PR (each builds a preview), merging to `main`, `vercel deploy` / `--prod` / redeploys, deploy hooks, empty redeploy commits, or a scheduled automation that does any of these.
- Until then, commit locally, verify with `bun run build` and a local `vite preview`, and batch everything into one final deployment.

---
## ⚡ Local Verification Mandate (ZERO CI WAITING)
- **GitHub Actions is OVER LIMIT**: Do NOT wait for or check remote GitHub Actions CI.
- **Always verify locally via Bun**:
  - `bun x vitest run` (Unit & branch tests; `bun test` is Bun's own runner and cannot load this suite)
  - `bun run build` (Vite build)
  - `bun run lint` (ESLint)
  - `bun run typecheck` (app and tooling configs; bare `tsc --noEmit` reads the empty solution tsconfig and checks nothing)

---

## 🛠️ GitHub CLI Mandate (WSL Fish)
- Execute all `gh` commands, issues, and PR workflows inside WSL Fish: `wsl fish -c "gh <command>"`.
