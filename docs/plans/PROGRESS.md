# Progress

## Current

- Phase: 0 — Foundation (complete; merged to master once this wave passes)
- Next: Phase 1 — Pay engine (`docs/plans/02-pay-engine.md`), whose Task 1 must start with the "Phase 1 pre-work" items below.

## Log

- 2026-09-28 — Specs, DESIGN.md, master plan, Phase 0/1 plans written.
- 2026-09-28 — Phase 0 shipped: Next.js scaffold (strict TS ~6.0.3), import-boundary lint (`src/domain` pure, `src/components`/`src/offline` barred from `src/server`), Vitest 5 unit tests, dev Postgres (Docker Compose), Playwright with 3 projects (iphone/android/desktop), design lint enforcing DESIGN.md anti-patterns, Claude Code harness (CLAUDE.md, hooks, spec reviewer, progress log), and a git pre-commit gate (typecheck + unit tests).

## Decisions and deviations

- TypeScript pinned to ~6.0.3 (TS 7 native compiler not yet supported by Next.js tooling).
- Dev server bound to `127.0.0.1` (not all interfaces).
- `eslint-config-prettier` wired last in `eslint.config.mjs` so it can turn off conflicting stylistic rules.
- Next's generated `AGENTS.md` kept, with `@AGENTS.md` as the first line of `CLAUDE.md`.
- Files staged by explicit list in commits (git 2.43's `:!` pathspec exclusion form doesn't work here).
- `.gitignore`/`.env` policy: ignore `.env*`, keep `!.env.example`.
- Playwright viewports: iPhone 390×844, Android 412×915, per DESIGN.md.
- Pre-commit hook added (`.githooks/pre-commit`: typecheck + unit tests), activated via `"prepare": "git config core.hooksPath .githooks"`.

## Gate evidence

- `pnpm verify` exits 0 (12 unit tests passing).
- `pnpm test:e2e` 3/3 (iphone, android, desktop).
- Stop hook (`scripts/hooks/stop-check.mjs`) blocks on a type error (exit 2) and exits 0 when `stop_hook_active` is set.

## Open issues (carried forward)

- Phase 1 Task 1 (pre-work): `verify` must run `test:coverage` and prove the report lists `src/domain` files (plan 02 Task 18 does this).
- Phase 2 Task 1: design lint gaps — bare `bg-radial`/`bg-conic`, `tracking-[2px]`, px/rem `letter-spacing`, case-insensitive `geist`/`GeistSans`/`from "geist/font/…"`, `href="#faded"` false positive, raw-colour exemption must be exact path `src/app/tokens.css`; unused `--surface` token replaced by real tokens.
- Phase 2: Playwright `reuseExistingServer` stale-server risk; axe scoped to WCAG 2.1 AA tags; vitest `include` widened to `*.test.tsx`.
- Phase 3: vitest `include` widened to `tests/integration/**`.
- Phase 9: CI gating of `reuseExistingServer`; dev compose password comment.
- No target phase: stop-check treats git-quoted paths as code (fails safe, acceptable); stop-check throws outside a git repo.
