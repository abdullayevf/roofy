# Progress

## Current

- Phase: 1 — Pay engine (complete; merged to master)
- Next: Phase 2 — Design system and full prototype (`docs/plans/03-design-prototype.md`, write at phase start).

## Log

- 2026-09-28 — Specs, DESIGN.md, master plan, Phase 0/1 plans written.
- 2026-09-28 — Phase 0 shipped: Next.js scaffold (strict TS ~6.0.3), import-boundary lint (`src/domain` pure, `src/components`/`src/offline` barred from `src/server`), Vitest 5 unit tests, dev Postgres (Docker Compose), Playwright with 3 projects (iphone/android/desktop), design lint enforcing DESIGN.md anti-patterns, Claude Code harness (CLAUDE.md, hooks, spec reviewer, progress log), and a git pre-commit gate (typecheck + unit tests).
- 2026-09-28 — Phase 1 shipped: pure domain core in `src/domain/` (money, split, rates, lines, piece, gst, costing, dates, segments, progress, floor, adjustments, flags, attendance, periods, payrun, ledger) plus `src/lib/format.ts`. Every pay-rules example (E1.1–E15.1) is a named test and matches to the cent; `scripts/check-examples.ts` proves none is missing; `verify` now runs coverage (100% on `src/domain`) and `check:examples`.

## Decisions and deviations

- TypeScript pinned to ~6.0.3 (TS 7 native compiler not yet supported by Next.js tooling).
- Dev server bound to `127.0.0.1` (not all interfaces).
- `eslint-config-prettier` wired last in `eslint.config.mjs` so it can turn off conflicting stylistic rules.
- Next's generated `AGENTS.md` kept, with `@AGENTS.md` as the first line of `CLAUDE.md`.
- Files staged by explicit list in commits (git 2.43's `:!` pathspec exclusion form doesn't work here).
- `.gitignore`/`.env` policy: ignore `.env*`, keep `!.env.example`.
- Playwright viewports: iPhone 390×844, Android 412×915, per DESIGN.md.
- Pre-commit hook added (`.githooks/pre-commit`: typecheck + unit tests), activated via `"prepare": "git config core.hooksPath .githooks"`.

- Phase 1: tsconfig `target` ES2017 → ES2020 (BigInt literals in exact money maths; tsconfig is noEmit so runtime is unaffected).
- Phase 1: `pieceRateLines` gives a zero-quantity share $0.00 instead of throwing (e.g. 1 "each" split between 2 people).
- Phase 1: "possible duplicate" flag includes time-only logs (spec §9 has no exception; two grids would double-count floor-check hours).
- Phase 1: "paused/done stage" flag also fires for logs dated before a stage's first segment (non-blocking warning).
- Phase 1: `formatMoney` formats without float division; `formatDays` keeps "½ day"/"1 day" for negative values.
- Phase 1: `check:examples` only counts an example id that starts an `it(`/`test(` title.
- Phase 1: eslint ignores generated `coverage/`.
- Phase 2 Task 6: `ROOFY_DATA` defaults to `fake` when unset only outside production (`pnpm dev`); in production (`pnpm start`, NODE_ENV=production) unset/empty throws "real data layer arrives in Phase 3" and `/prototype/role` 404s — set `ROOFY_DATA=fake` explicitly (playwright webServer does; `.env.example` sets it). Any other value throws.
- Phase 2 Task 6: `server-only` isn't installed; `src/data/session.ts` has a runtime `window` guard instead.
- Phase 2 Task 6: `?demo=loading` → pages return their skeleton (`demo.loading`) rather than a never-resolving Suspense child, which would keep the HTML response open and hang `page.goto`/capture.
- Phase 2 Task 6: layouts get `?demo=` via the `x-roofy-demo` request header set by `src/proxy.ts`, which runs on every page request (not static files/icons) and always strips a client-sent copy. Soft navigations that keep the layout don't re-read it.
- Phase 2 Task 6: Owner 2FA is ON in the seed (Karen Holt), so approval is possible once the missing rate is fixed; `?demo=blocked` reads it as off. Seed names are reused for the actors (owner Karen Holt, manager Dan Holt, foreman Craig Dunn, accountant Priya Shah).
- Phase 2 Task 6: Home "Needs attention" follows product spec §5.9 order: over budget (red) → trending over (amber) → paused > 5 working days → last week's gaps → outbox needs attention → unpaid too long → below floor; within a kind, bigger amount / longer pause / older debt first. Only over budget is red. Only `?demo=attention` adds an outbox item in fake mode (on the device from Phase 5).
- Phase 2 Task 6: "Same as yesterday" copies the first crew-day grid entry on the previous logged day among the actor's jobs (seed: Fri 25 Sep, Smith sheet install, Sam and Dima). Job detail's "crew this week" is the rolling last 7 days. Pay run totals: employees/contractors = sum of person totals (incl. GST and reimbursements).
- Phase 2 Task 6: outbox items carry the entry as `input` (the key `payload` reads as money to the foreman key scan). Domain gained `ratios.ts` (over marker, margin %, cost per unit, per crew-day) and `stageExpectedLabour`, so `src/data` never divides money; `src/lib/format.ts` gained `formatDecimal` for CSV.
- Phase 2 Task 6: UI/offline code may not import `@/data` or `@/data/session` (lint); types come from `@/data/contracts`.
- Phase 2 Task 6: `safeNextPath` checks the normalised and decoded path (refuses `//`, backslashes, `%2F`/`%5C`); prototype cookies get `Secure` over https (URL or `x-forwarded-proto`). Foreman log lists leave out adjustment rows (pay-run artefacts).

## Gate evidence

- Phase 1: `pnpm verify` exits 0 — 21 test files, 122 tests; coverage 100% statements 283/283, branches 203/203, functions 120/120, lines 210/210; "Every pay-rules example has a named test." `pnpm test:e2e` 3/3. Whole-branch review + phase spec review (opus): every example hand-checked to the cent; every rule in §0–§16 has code or a later-phase owner; its fixes applied and re-reviewed.
- Phase 0: `pnpm verify` exits 0 (12 unit tests passing).
- `pnpm test:e2e` 3/3 (iphone, android, desktop).
- Stop hook (`scripts/hooks/stop-check.mjs`) blocks on a type error (exit 2) and exits 0 when `stop_hook_active` is set.

## Open issues (carried forward)

- Phase 4: add a unique DB constraint on rates (crew member, basis, unit, project, effective_from) — `resolveRate` picks the first of two rates with the same date.
- Phase 7: `buildPayRun` includes every unlocked log dated ≤ period end; only build the next draft once every earlier run is approved (else logs appear in two drafts). Consider a "no hours" warning when an employee's net hours are ≤ 0 (reversal-only run).
- Phase 7: a pay-run credit can be negative (reversal-only period); ledger maths handles it.
- No target phase: lint rule for bare `new Date()`/`Date.now()` in `src/domain` (currently followed, not enforced); `formatDate` does not validate its input.
- Phase 2 Task 1: design lint gaps — bare `bg-radial`/`bg-conic`, `tracking-[2px]`, px/rem `letter-spacing`, case-insensitive `geist`/`GeistSans`/`from "geist/font/…"`, `href="#faded"` false positive, raw-colour exemption must be exact path `src/app/tokens.css`; unused `--surface` token replaced by real tokens.
- Phase 2: Playwright `reuseExistingServer` stale-server risk; axe scoped to WCAG 2.1 AA tags; vitest `include` widened to `*.test.tsx`.
- Phase 3: vitest `include` widened to `tests/integration/**`.
- Phase 9: CI gating of `reuseExistingServer`; dev compose password comment.
- No target phase: stop-check treats git-quoted paths as code (fails safe, acceptable); stop-check throws outside a git repo.
