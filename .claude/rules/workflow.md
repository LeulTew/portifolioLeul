# General Development & Task Workflow Rules

## 1. Context & Task Onboarding
- **Read First**: Always read existing files in the domain you are editing before writing new code.
- **Preserve Behavior**: Never silently remove existing 3D features, animations, or portfolio sections.

## 2. Commit Message Standards
Use prefix-based commit messages: `<prefix>(<scope>): <description>`
- `feat(...)`: New features, 3D scenes, or portfolio sections.
- `fix(...)`: Bug fixes, layout corrections, or animation fixes.
- `perf(...)`: Asset compression, FPS optimization, bundle splitting.
- `style(...)`: Visual styling, theme updates, UI polish.
- `refactor(...)`: Code restructuring without functional changes.
- `test(...)`: Unit, integration, or visual regression tests.

## 3. GitHub CLI (`gh`) Execution (WSL Fish)
- GitHub CLI authentication and tokens (`LeulTew`) reside inside WSL Fish (`Ubuntu 24.04` / `fish`).
- Execute all GitHub CLI operations using `wsl fish -c "gh <command>"`.

## 4. Local Bun Verification Mandate (ZERO CI WAITING)
- **NO GitHub Actions / CI Waiting**: GitHub Actions is over limit. Never wait for, check, or block on remote GitHub Actions CI workflows.
- **100% Local Verification via Bun**:
  - `bun test` or `bun x vitest run` (Unit & branch tests)
  - `bun run build` (Vite production bundle compilation)
  - `bun run lint` (ESLint verification)
  - `bun x tsc --noEmit` (TypeScript strict type safety)
- Verify locally with Bun before completing any task, issue, or PR.
- Never run destructive git commands like `git reset --hard` without explicit user instruction.

## 5. Agent Operational Efficiency & Verification Loop
- **Surgical Patching Over Full File Replacement**: Apply localized diffs rather than rewriting complete source files. Preserves 3D canvas references, state bindings, and complex math.
- **Context Window Hygiene**: Enforce line-bounded reads (`StartLine`/`EndLine`) and targeted grep. Filter compiler/test logs to retain only failing stack traces and line markers.
- **Closed-Loop Self-Correction**: When local verification fails, inspect the error trace and apply targeted patches in an automated verify-fix loop (up to 3 retries) before escalating.
