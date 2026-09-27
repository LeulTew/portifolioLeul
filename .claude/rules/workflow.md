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
  - `bun x vitest run` (Unit & branch tests; `bun test` is Bun's own runner and cannot load this suite)
  - `bun run build` (Vite production bundle compilation)
  - `bun run lint` (ESLint verification)
  - `bun run typecheck` (app and tooling configs; bare `tsc --noEmit` reads the empty solution tsconfig and checks nothing)
  - `bun run perf:budget` after `bun run build` for any change to per-frame work, rendering, scroll choreography or loading (median of three 4x-throttled journeys from Home to a usable Contact, parked Contact and typing, against `scripts/perf-budget.json`; a sample that does not travel the whole story fails the run). Add `--cold` for any change to loading or first use: it gates startup on fresh profiles. See README > Performance budget.
- `bun run native:scroll` after `bun run build` for any change to scroll ownership, chapter hand-offs or programmatic scrolling: a headed Chrome presses the real scrollbar thumb, in light and dark, and asserts every hand-off and held-thumb journey. jsdom has no scrollbar to hold. See README > Native scrollbar check.
  - Harness changes live in `scripts/perf/` with their adverse-path tests (`scripts/**/*.test.ts` runs with the suite).
- Verify locally with Bun before completing any task, issue, or PR.
- Never run destructive git commands like `git reset --hard` without explicit user instruction.

## 5. Vercel Deployment Rule (owner directive, 2026-09-27)
- The Vercel account is shared with other projects and capped at 100 deployments per rolling 24 hours. In the 24 hours to 2026-09-27 04:35Z it reached 104 and every project was rate-limited.
- Deploy only when (a) the owner explicitly tells you to, or (b) the work is finished: every metric at 10/10, everything merged, migrations applied. Then deploy once.
- Branch pushes, PRs, merges to `main`, `vercel deploy` and redeploys, deploy hooks and scheduled automations all count as deployments. Until (a) or (b), keep work in local commits and verify locally.
## 6. Agent Operational Efficiency & Verification Loop
- **Surgical Patching Over Full File Replacement**: Apply localized diffs rather than rewriting complete source files. Preserves 3D canvas references, state bindings, and complex math.
- **Context Window Hygiene**: Enforce line-bounded reads (`StartLine`/`EndLine`) and targeted grep. Filter compiler/test logs to retain only failing stack traces and line markers.
- **Closed-Loop Self-Correction**: When local verification fails, inspect the error trace and apply targeted patches in an automated verify-fix loop (up to 3 retries) before escalating.
