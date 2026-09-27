# Roofy MVP — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each phase plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This master plan orders the phases and defines every gate; each phase has (or gets) its own detailed task-by-task plan.

**Goal:** Ship a pilot-ready, mobile-first Roofy MVP whose UI and pay maths are both verified — no "pretty screens with broken logic", no "working logic with a broken UI".

**Architecture:** Next.js 16 (App Router) + PostgreSQL 17 + Better Auth, self-hosted in Docker on the owner's VPS behind nginx. Pure TypeScript domain core for all money maths. Installable PWA with an on-phone outbox for field entries. UI built first on a fake data layer that implements the same interfaces as the real services, then wired slice by slice.

**Tech Stack:** TypeScript 6.0 (pinned), Next.js 16.3, React 19, Tailwind CSS 4, shadcn/ui, vaul, Phosphor icons, Drizzle ORM, PostgreSQL 17, Better Auth, zod 4, Dexie 4, Serwist 9, pg-boss 12, @react-pdf/renderer, Vitest 5, Playwright 1.63, axe-core, fast-check, pnpm 10.

**Spec:** `docs/specs/01-product-spec.md`, `docs/specs/02-pay-rules.md`, `docs/specs/03-architecture.md`, `docs/specs/04-design-process.md`, `docs/design/DESIGN.md`. Every phase plan argues from these; executors read the relevant spec sections before each task.

## Global Constraints

- Money is integer cents; quantities/hours/days/multipliers are integer hundredths; percentages are basis points. No floating-point money anywhere.
- All money maths lives in `src/domain` (pure, no IO); nothing else computes pay, GST, costs or splits.
- `src/domain` imports only `@/domain/*` and `@/lib/*`; `src/components` and `src/offline` never import `@/server/*` (lint-enforced).
- Every calculation example E1.1–E15.1 in `02-pay-rules.md` is a named, passing test.
- Foreman-facing payloads, pages, exports and errors never contain rates, amounts, budgets, margins or balances.
- Field entries (logs, progress, no-work, pause/resume, expenses) always go through the outbox; each carries a client UUIDv7 and is applied exactly once.
- Dates are local calendar dates in the workspace timezone (default `Australia/Sydney`); the server clock is UTC in France — never derive a work date from server local time.
- UI uses only DESIGN.md tokens, fonts (Barlow Semi Condensed, Atkinson Hyperlegible Next) and components; `pnpm lint:design` must pass.
- Touch targets ≥ 48 px on phone; WCAG 2.1 AA; supports iOS Safari 17+ installed and in-browser, Android Chrome, desktop browsers.
- Roofy containers stay within ~1.5 GB RAM total on the shared VPS; app listens on `127.0.0.1:3100`, dev DB on `127.0.0.1:5440`.
- Copy is plain, sentence case, no jargon; buttons are verbs.
- Out of scope (do not build): chat import, Xero/MYOB, TPAR, OCR, billing, push notifications, full offline sync.

## Review Focus

1. **Work date across timezones** — a manager in Sydney logging at 6 a.m. Monday gets a Monday log and Monday's pay period, even though the server's UTC date is still Sunday. Pinned in Phase 1 Task 8 (`todayIn`) and Phase 5 (grid default date e2e with a mocked clock at 2026-09-27T20:00Z).
2. **The same entry arriving twice** (retry after timeout, double tap, app killed mid-send) — exactly one row, same result returned. Pinned in Phase 5 sync-push integration tests and offline e2e.
3. **Rates changing after work was logged** — existing logs and approved pay runs never change; new logs use the new rate from its effective date. Pinned in Phase 1 Task 3 and Phase 4 rate-change integration test.
4. **Foreman money leakage** through any channel (page HTML, snapshot JSON, CSV, PDF, statement link, validation error text). Pinned in Phase 3 DTO test and Phase 5/7 payload scans.
5. **Split rounding for arbitrary crews and totals** — per-person shares always sum exactly to the total, never negative, stable order. Pinned in Phase 1 Task 2 property test.

---

## How every phase is executed (the self-checking workflow)

The owner is not a reviewer. Quality comes from checks that run themselves and from independent reviewers with fresh context.

**Per phase**
1. Start a **fresh Claude Code session** on a branch `phase/<n>-<name>`. Read: this master plan, the phase plan, `docs/plans/PROGRESS.md`, and only the spec sections the phase cites.
2. If the phase has no detailed plan yet, write it first with the `superpowers:writing-plans` skill, from this master plan's phase section and the specs; commit it.
3. Execute tasks with `superpowers:subagent-driven-development`: one fresh implementer subagent per task (TDD: failing test → minimal code → green → commit), then a fresh reviewer subagent checks the task against its plan and the spec before the next task starts.
4. **Phase exit gate** (all must pass, evidence pasted into `PROGRESS.md`):
   - `pnpm verify` (typecheck, lint, design lint, unit tests, domain coverage 100%).
   - Integration tests against real Postgres (from Phase 3).
   - E2E on iPhone (WebKit), Android (Chromium), desktop (from Phase 2).
   - Design loop for any screen touched (`04-design-process.md` §2): automated checks + two critics, score ≥ 90, no P0/P1, ≤ 6 iterations.
   - **Spec review:** the `spec-reviewer` subagent reviews the whole phase diff against the cited spec sections and the Review Focus; it reports only correctness/requirement gaps. Fix, re-run until clean.
5. Update `docs/plans/PROGRESS.md` (what shipped, decisions, deviations from spec with reasons, next phase), merge the branch into `master`.

**Escalate to the owner only when:** a design loop fails to converge in 6 iterations, a spec rule is contradictory or impossible, or something would cost money or touch other projects on the VPS.

---

## Phase 0 — Foundation
**Plan:** `docs/plans/01-foundation.md` (detailed).
**Delivers:** Next.js app scaffold with strict TypeScript, import-boundary lint, Vitest, Playwright with 3 device projects, dev Postgres container, design lint (`pnpm lint:design`), Claude Code harness (CLAUDE.md, format/verify hooks, `spec-reviewer` agent, PROGRESS.md).
**Exit:** `pnpm verify` green; smoke e2e green on 3 projects; hooks demonstrably block a type error.

## Phase 1 — Pay engine (domain core)
**Plan:** `docs/plans/02-pay-engine.md` (detailed).
**Spec:** `02-pay-rules.md` (all).
**Delivers:** `src/domain/*` — exact money maths, splits, rate lookup, line amounts, piece-rate and lump-sum lines, GST, job costing, dates/segments, progress/forecast/alerts/margins, floor check, adjustments, flags, gaps/utilisation, pay periods, pay-run builder, ledger; `src/lib/format.ts`; example-coverage check.
**Exit:** every E-id tested (`pnpm check:examples`), 100% branch coverage on `src/domain`, property tests green.

## Phase 2 — Design system and full prototype (D1–D7)
**Plan:** `docs/plans/03-design-prototype.md` (write at phase start).
**Spec:** `04-design-process.md`, `DESIGN.md`, product spec §5–§6.
**Delivers:**
- `docs/design/brief.md`, `docs/design/flows.md` (every core job, tap budgets).
- Tokens (`src/app/tokens.css`), self-hosted fonts, Tailwind theme, component primitives, `/design` page (all components × states × light/dark).
- **Data interfaces** `src/data/contracts.ts` — one TypeScript interface per service area (projects, stages, crew, logs, progress, expenses, payruns, ledger, reports, sync, settings) using domain types; **fake implementation** `src/data/fake/*` with seeded realistic roofing data (12 crew, 5 active jobs, 2 years history), selected by `ROOFY_DATA=fake`.
- Every screen in product spec §6 inventory, all states, phone + desktop, foreman variants.
- Design-loop tooling: `scripts/design-capture.ts` (Playwright screenshots matrix), `scripts/check-contrast.ts`, tap-budget e2e tests, `.claude/agents/design-critic.md`, `.claude/agents/field-critic.md`, `docs/design/loop/{ISSUES,DECISIONS}.md`.
- D2 "prove the direction" A/B, recorded in DECISIONS.md.
- Visual baselines in `tests/visual/`.
**Exit:** all screen groups pass the design loop; tap budgets pass; baselines committed; PWA installs on iOS/Android (manifest, icons, standalone, safe areas verified in WebKit screenshots).

## Phase 3 — Database, auth, tenancy, audit
**Plan:** `docs/plans/04-db-auth.md`.
**Spec:** architecture §4–§6; product spec §3, §5.1.
**Delivers:** Drizzle schema + SQL migrations for all tables (architecture §5); RLS policies on every tenant table; app DB role without bypass; `withActor(tx)` transaction wrapper setting `app.workspace_id/user_id/role`; audit trigger + `audit_event`; locked-log immutability trigger; Better Auth (Google, email+password, verification, TOTP 2FA required for Owner, organization roles); `server/authz` action matrix; role-shaped DTO types; email via an SMTP adapter (console transport in dev/test; production provider configured in Phase 9) for verification, password reset and member invites; members & roles settings screen; onboarding wizard wired (real services replace fakes for workspace/crew quick-add).
**Tests:** cross-tenant read/write attempts on every table fail; each role × action allowed/denied per matrix; audit rows written with before/after; locked log update rejected; foreman DTO key scan.
**Exit:** phase gate + onboarding e2e (sign up → workspace → crew) green on 3 viewports against real DB.

## Phase 4 — Jobs, stages, crew, rates (wired)
**Plan:** `docs/plans/05-jobs-crew.md`.
**Spec:** product spec §5.2–§5.4; pay rules §1, §12–§13.
**Delivers:** services + route handlers for clients, projects, templates (pre-fill from last same-type project), stages (start/pause/resume/done with segments; auto-start on first log), files (FileStore on disk, authorised download, phone-side compression), crew, levels & floor rates, rates with history and project overrides; settings screens (business, pay period & working days, on-cost, templates, expense categories, foreman project assignments); record history (audit) view; screens swapped from fake to real.
**Tests:** rate change after logs (snapshots untouched), segment creation per transition, template pre-fill, file access denied cross-tenant.
**Exit:** phase gate; visual baselines unchanged (or re-passed through loop).

## Phase 5 — Logging and the outbox
**Plan:** `docs/plans/06-logging-outbox.md`.
**Spec:** product spec §5.5; architecture §7; pay rules §2–§4 (grid lines).
**Delivers:** crew-day grid wired (defaults from basis/standard day, same-as-yesterday, time-only logs for per-unit workers); `POST /api/sync/push` with `client_mutation` idempotency, per-mutation transactions, applied/rejected/retry results, flags instead of rejections for business warnings; `GET /api/sync/snapshot` role-shaped; Dexie outbox + state machine + backoff + triggers (start, online, visibility, 15 s); auth-expiry handling; Serwist app shell + Android background sync; outbox screen and badge; foreman flow.
**Tests:** outbox state machine unit tests; sync push integration (duplicate id, invalid, forbidden project, locked period → late entry flag); offline e2e on WebKit + Chromium (save offline → reconnect → exactly once; duplicate send; rejection → Needs attention; reload offline keeps queue; session expiry); mocked-clock default date test (Review Focus 1).
**Exit:** phase gate; crew-day grid save ≤ 6 taps (tap-budget test) and < 30 s scripted.

## Phase 6 — Progress, lump sums, no-work, expenses
**Plan:** `docs/plans/07-progress-expenses.md`.
**Spec:** product spec §5.6–§5.7; pay rules §4–§5, §7, §14.
**Delivers:** progress entry with equal/custom split through outbox → per-unit logs via domain; stage Done with lump-sum split proposal (crew who logged on the stage) and reopen reversals; no-work markers; expenses with photo (offline blob → idempotent upload), GST default total ÷ 11, categories, reimbursement linkage.
**Tests:** E4.x/E5.1 end-to-end through services; reopen after approval creates reversing adjustments; expense offline with photo arrives once.
**Exit:** phase gate.

## Phase 7 — Pay runs, ledger, statements, exports
**Plan:** `docs/plans/08-payruns.md`.
**Spec:** product spec §5.8, §5.11; pay rules §6–§10, §15–§16.
**Delivers:** pay periods (weekly/fortnightly, start day); draft view from `buildPayRun`; flags incl. blocking (missing rate, owner 2FA); approve (freeze lines, lock logs, ledger credits) and reopen; post-approval edits → adjustments; payouts; balances; crew statement PDF + share link (hashed token, 90-day expiry, revoke) + native share sheet; CSV exports (pay run, all lists, workspace export zip).
**Tests:** approve/reopen integrity; adjustment lands in next run (E8.1); statement link revoked/expired → 404; foreman cannot reach any of it; CSV columns and totals equal on-screen totals.
**Exit:** phase gate; pay run review → approve → export ≤ 2 min scripted.

## Phase 8 — Home and reports
**Plan:** `docs/plans/09-home-reports.md`.
**Spec:** product spec §5.9–§5.10; pay rules §12–§15.
**Delivers:** Monday screen (needs-attention ranking max 7, active jobs, last week, this pay period), foreman home, five reports with date filters, CSV and PDF export, tap-through from every figure to source lines; weekly Monday summary email to Owner/Managers (pg-boss schedule, opt-out in settings); 2-year seed for performance.
**Tests:** needs-attention ordering; each figure's drill-down sums to the figure; Lighthouse mobile on Home with 2-year seed (< 3 s France target).
**Exit:** phase gate.

## Phase 9 — Production on the VPS
**Plan:** `docs/plans/10-production.md`.
**Spec:** architecture §8–§9; product spec §7.
**Delivers:** `ops/compose.yml` (app, db, backup; memory limits), production Dockerfile (standalone, non-root, Node 24), nginx vhost + certbot (needs a domain — ask the owner for it at phase start), migrations on deploy, `/api/health`, Telegram backup container (age-encrypted nightly DB dump + daily/weekly files, 45 MB parts, failure alerts, 7-day local retention), monthly automated restore test, `ops/restore.md`, uptime monitor, security headers, email SMTP config, preview environment.
**Tests:** restore drill from a Telegram-delivered backup into a clean container; memory limits verified with `docker stats` under seeded load; other VPS projects unaffected (ports, networks, memory).
**Exit:** phase gate; restore drill < 2 h documented.

## Phase 10 — Pilot readiness
**Plan:** `docs/plans/11-pilot.md`.
**Delivers:** design partner onboarding; their real past week entered → pay sheet compared with what they actually paid (acceptance test, differences explained or fixed); D6 usability session (5 tasks) with fixes through the design loop; install guide verified on their phones; known-issues list.
**Exit:** acceptance week matches; usability tasks within UX targets.

---

## Progress tracking

`docs/plans/PROGRESS.md` is the cross-session memory: current phase, finished tasks, decisions, deviations, open issues, next step. Every session reads it first and updates it last.
