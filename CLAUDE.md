@AGENTS.md

# Roofy

Mobile-first crew and job costing PWA for Australian roofing businesses. Specs in `docs/specs/`, design system in `docs/design/DESIGN.md`, plans in `docs/plans/`. Read `docs/plans/PROGRESS.md` first; update it at the end of every session.

## Commands

- `pnpm dev` (port 3100) · `pnpm build` · `pnpm start`
- `pnpm verify` — typecheck, lint, design lint, unit tests. Must pass before any commit.
- `pnpm test:unit` · `pnpm test:coverage` (100% on src/domain) · `pnpm test:e2e` (iphone, android, desktop)
- `pnpm db:up` / `pnpm db:down` — dev Postgres on 127.0.0.1:5440 (`roofy_dev`, `roofy_test`)

## Rules

- IMPORTANT: all money maths lives in `src/domain` (pure TS). Money = integer cents; quantities/hours = integer hundredths; percentages = basis points. Never use floats for money.
- `src/domain` imports only `@/domain/*` and `@/lib/*`. UI (`src/components`) and `src/offline` never import `@/server/*`.
- Foreman-facing data never includes rates, amounts, budgets, margins or balances.
- Work dates are local dates in the workspace timezone; never use the server's local date.
- UI: only tokens, fonts and components from DESIGN.md; `pnpm lint:design` must be clean. Plain words, sentence case, verbs on buttons.
- TDD: failing test first. Pay-rule examples (E1.1…) are named tests.
- Every task ends with the `spec-reviewer` subagent; every phase ends with the phase gate in `docs/plans/00-master-plan.md`.
- Do not touch other Docker projects or nginx sites on this server. Ports 3000, 3005, 5434, 5439, 8080 belong to other projects.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- When compacting, keep: current phase and task, files changed, failing tests, open decisions.
