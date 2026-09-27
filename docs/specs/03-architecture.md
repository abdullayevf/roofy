# Roofy — Architecture

**Status:** Draft for review · **Date:** 2026-09-28
Covers stack, code layout, data model, security, offline outbox, hosting, backups, testing and the build process. Product behaviour: `01-product-spec.md`. Money maths: `02-pay-rules.md`.

---

## 1. Constraints that shape everything

1. Self-hosted on the owner's VPS (Contabo, France): 4 CPU, 7.8 GB RAM, shared with other Docker projects; nginx already on 80/443. **Roofy's budget: ~1.5 GB RAM total.**
2. No paid platforms (no Vercel Pro, no paid Supabase). Free tiers only where unavoidable.
3. Must move to a Sydney VPS before paying customers → everything in Docker Compose, one-command restore.
4. Mostly used on phones, often with poor signal → installable PWA, outbox for field entries.
5. Money must be exact and traceable → integer cents, pure tested domain code, audit trail.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) everywhere | One language client/server; shared validation |
| App framework | **Next.js 16** (App Router), Node runtime, `output: "standalone"` | Server-rendered pages + API in one container; standalone build is small |
| UI | **Tailwind CSS v4** + **shadcn/ui** components (Radix), **vaul** bottom sheets, lucide icons | Accessible primitives, we own the code, easy to theme; bottom sheets for phone |
| PWA | **Serwist** (`@serwist/next`) | Maintained successor of next-pwa; works with Turbopack |
| Database | **PostgreSQL 17** (own container) | Row-level security, strong constraints, one store for data, auth, jobs, audit |
| ORM / migrations | **Drizzle ORM** + drizzle-kit | Typed SQL, plain SQL migrations we can read |
| Auth | **Better Auth** (organization + twoFactor plugins, Google OAuth, email+password) | Self-hosted, users stored in our DB, orgs/roles built in, free |
| Validation | **zod** schemas shared by client and server | Same rules on phone and server |
| On-phone storage | **Dexie** (IndexedDB) | Durable outbox + reference cache |
| Background jobs | **pg-boss** (queue inside Postgres) | No Redis; retries, cron schedules |
| PDF | **@react-pdf/renderer** (server) | Crew statements, report PDFs |
| Email | SMTP adapter; provider = Resend free tier (3k/month) | Verification, reset, invites, Monday summary |
| Files | Local disk volume behind a `FileStore` interface (S3-compatible later) | Free; swappable |
| Image handling | Compress on phone before upload (max 1600 px, ~300 KB JPEG/WebP) | Small uploads on 4G, small backups |
| Errors | Sentry free tier (PII scrubbed) — optional, off by default in pilot | Crash visibility |
| Tests | **Vitest** (unit/integration), **Playwright** (e2e, WebKit + Chromium mobile, screenshots), **@axe-core/playwright** (accessibility) | See §10 |
| Package manager | pnpm | Fast, strict |

Not used (and why): self-hosted Supabase (≈12 containers, 2–4 GB RAM), Redis (pg-boss is enough), a separate API server (Next.js route handlers are enough at this scale), full offline sync engines (not needed; §7).

## 3. Code layout

```
src/
  app/                  Next.js routes: pages (UI) + route handlers under app/api
  components/ui/        design-system primitives (shadcn-based, themed by tokens)
  components/           app-level components (CrewDayGrid, MoneyCell, StageChip…)
  domain/               PURE TypeScript: money, split, rates, pay, gst, costing,
                        progress, segments, flags, ledger. No DB, no IO, no dates-from-clock.
  server/
    db/                 drizzle schema, migrations, RLS policies, audit triggers
    auth/               Better Auth config, session → actor
    authz/              role checks + role-shaped DTOs (foreman never gets money fields)
    services/           one module per area: projects, stages, crew, logs, progress,
                        expenses, payruns, ledger, reports, exports, files, sync
    jobs/               pg-boss workers (emails, Monday summary, statement link expiry)
  offline/              outbox (Dexie), sync client, reference-data cache, SW glue
  lib/                  zod schemas, formatting (AUD, dates, units), shared types
tests/
  e2e/                  Playwright specs + fixtures
  integration/          service tests against a real Postgres
ops/
  compose.yml, compose.dev.yml, nginx/roofy.conf, backup/, restore.md
docs/specs, docs/design, docs/plans
```

**Rules:** UI never imports `server/`. `domain/` never imports anything outside `domain/` and `lib/`. Services call domain functions for every calculation — no money maths anywhere else.

## 4. Request flow

- **Reads:** Server Components call services directly (session → actor → workspace scoped transaction).
- **Writes from field screens** (logs, progress, no-work, pause/resume, expenses): go through the **outbox** → `POST /api/sync/push` (§7).
- **Writes from admin screens** (settings, rates, projects, pay runs, payouts): route handlers `POST/PATCH /api/...`, online only; screens show "needs connection" when offline.
- Every request runs in one DB transaction that first sets `app.workspace_id`, `app.user_id`, `app.role` (`SET LOCAL`) — used by RLS policies and audit triggers.

## 5. Data model

All tables: `id uuid` (UUIDv7, client-generatable), `workspace_id uuid not null` (except auth tables), `created_at`, `updated_at timestamptz`. Money = `bigint` cents. Quantities/hours = `numeric(12,2)`, converted to integer hundredths in the domain layer. Dates = `date`.

| Table | Key columns | Notes |
|---|---|---|
| `workspace` | name, abn, gst_registered, timezone, pay_period (weekly/fortnightly), pay_week_start (0–6), working_days (int[]), standard_day_hours, on_cost_pct | Better Auth "organization" 1:1 |
| `member` | user_id, role (owner/manager/foreman/accountant) | Better Auth managed |
| `project_assignment` | member_id, project_id | Foreman scope |
| `client` | name, phone, email, address | |
| `project` | client_id, site_address, nickname, job_type, contract_value_cents, status, start_date, target_finish | |
| `stage_template` / `stage_template_item` | job_type · name, position, default_unit, labour_share_pct, materials_share_pct | |
| `stage` | project_id, name, position, status, unit, budget_qty, labour_budget_cents, materials_budget_cents, lump_sum_cents, manual_pct, completed_on | |
| `stage_segment` | stage_id, start_date, end_date (null = open), pause_reason, pause_note | Half-open ranges |
| `stage_completion_share` | stage_id, crew_member_id, share_bp (basis points) | Lump-sum split confirmed at Done |
| `crew_level` | name, floor_rate_cents | |
| `crew_member` | name, phone, type (employee/contractor), level_id, abn, gst_registered, active_from, active_to, default_basis | |
| `rate` | crew_member_id, basis, unit, amount_cents, effective_from, project_id (null = default) | Unique (crew, basis, unit, project, effective_from) |
| `progress_entry` | stage_id, date, quantity, entered_by, photo_file_id | |
| `progress_share` | progress_entry_id, crew_member_id, share_bp | Sum = 10000 |
| `work_log` | date, crew_member_id, project_id, stage_id, basis (hourly/daily/per_unit/lump_sum/time_only), unit, quantity, hours, multiplier, rate_cents, amount_cents, source (grid/progress/lump_sum/adjustment), adjusts_log_id, progress_entry_id, pay_run_id (set = locked), entered_by, mutation_id, deleted_at | Locked rows immutable (trigger-enforced) |
| `no_work` | crew_member_id, date, reason, note | Unique (crew, date) |
| `expense_category` | name, position | |
| `expense` | project_id, stage_id, category_id, supplier, date, amount_ex_gst_cents, gst_cents, paid_by (company_card/cash/crew), crew_member_id, receipt_file_id, reimbursed_in_pay_run_id | |
| `pay_run` | period_start, period_end, status (draft/approved/exported), approved_by/at, exported_at | Unique period per workspace |
| `pay_run_line` | pay_run_id, crew_member_id, kind (log/reimbursement/gst), ref_id, snapshot jsonb, amount_cents | Frozen at approval |
| `ledger_entry` | crew_member_id, date, kind (payrun_credit/advance/payment), amount_cents, method, note, pay_run_id | |
| `statement_link` | pay_run_id, crew_member_id, token_hash, expires_at, revoked_at | Public read-only page |
| `file` | storage_key, mime, bytes, sha256, entity_type, entity_id | |
| `client_mutation` | id (from phone), user_id, type, received_at, result jsonb | Idempotency (§7) |
| `audit_event` | table_name, row_id, action, before jsonb, after jsonb, actor_user_id, at | Written by triggers |

**Size check:** 15 crew × 250 days × ~2 logs × 2 years ≈ 15k `work_log` rows per workspace. Every dashboard query is trivially fast with indexes on `(workspace_id, date)`, `(workspace_id, stage_id)`, `(workspace_id, crew_member_id, date)`, `(pay_run_id)`.

## 6. Security

- **Tenant isolation, two layers:** (1) every service query filters by the actor's workspace; (2) Postgres **row-level security** on every tenant table using `current_setting('app.workspace_id')`. The app connects as a non-owner role that cannot bypass RLS. An integration test tries cross-workspace reads/writes on every table and must fail.
- **Roles:** checked in `server/authz` per action (matrix in product spec §3). **Foreman DTOs** are separate types with no money fields; a test asserts no foreman endpoint/page payload contains `rate`, `amount`, `budget`, `margin`, `balance` keys.
- **Locked logs:** DB trigger rejects UPDATE/DELETE on `work_log` rows with `pay_run_id` set (except by the approve/reopen service path via a session flag).
- **Audit:** generic trigger on money-relevant tables writes `audit_event` with before/after JSON and `app.user_id`.
- **Auth:** Better Auth sessions (httpOnly, secure, SameSite=Lax cookies), Google OAuth, email+password with verification, TOTP 2FA mandatory for Owner, rate limiting on auth routes.
- **Files:** served only through an authorised route (never public paths); statement links use random 32-byte tokens, stored hashed, expire in 90 days, revocable.
- **Secrets:** `.env` on server only, never committed. Backups encrypted (§9).
- **Headers:** CSP, HSTS, frame-ancestors none (set in Next.js + nginx).

## 7. Offline: the outbox ("keep it, send later")

**Scope.** Field entries only: crew-day logs, progress entries, no-work markers, stage pause/resume, expenses (with photo). Admin screens are online-only.

**Principles**
1. **One save path.** Field entries always go into the outbox first, online or not. The UI updates from the outbox immediately. There is no separate "offline mode" code.
2. **Durable.** Outbox lives in IndexedDB (Dexie); app requests persistent storage (`navigator.storage.persist()`). Survives app close, phone restart, app update. On iOS, installed home-screen apps are exempt from Safari's 7-day storage wipe; the install guide pushes installation for foremen.
3. **Exactly once.** Each mutation gets a UUIDv7 at creation. Server stores it in `client_mutation`; a repeat returns the stored result without re-applying.
4. **Ordered per device.** Mutations are sent in creation order, in batches (≤ 25). A mutation depending on an earlier one (e.g. photo upload → expense) waits for it.
5. **Never silently dropped.** Server answers per mutation: `applied` · `rejected {code, message}` · `retry`. Rejected items stay on the phone as **Needs attention** with the reason and actions: *Edit & resend* or *Discard*.
6. **Visible.** Global badge "N waiting to send"; per item: Waiting · Sending · Sent · Needs attention. Outbox screen lists everything.
7. **Only new things offline.** Offline you can create entries and edit/delete entries **still in the outbox**. Editing already-synced records needs a connection → no two-way conflicts to resolve.

**State machine (per mutation)**
`queued → sending → sent` · `sending → queued` (network error, backoff 2 s, 5 s, 15 s, 60 s, max 5 min) · `sending → needs_attention` (rejected) · `needs_attention → queued` (edited) · `needs_attention → discarded` · `queued → auth_required` (401; resumes after sign-in, nothing lost).

**When it sends:** app start, `online` event, app returns to foreground (`visibilitychange`), every 15 s while items are queued and the app is open. Android bonus: Background Sync registration via Serwist. iOS has no background sync; we don't depend on it.

**Server side (`POST /api/sync/push`)**
- Each mutation handled in its own transaction: idempotency check → zod validation → authorisation (role, project assignment) → business checks (stage exists, person active, etc.) → apply → store result.
- Business outcomes that aren't errors are *applied with a flag*, not rejected (e.g. log on a paused stage, late entry into an approved period, possible duplicate). Rejections are for things that genuinely can't be saved (no permission, project deleted, invalid data).
- Each mutation carries `appVersion` and `schemaVersion`; server keeps accepting the previous schema version for at least one release.

**Reference cache (pickers work without signal)**
`GET /api/sync/snapshot` returns what the user needs to create entries: active/assigned projects, stages (status, unit), crew (names, type, default basis — **no rates for foremen**), expense categories, workspace settings. Stored in Dexie with `fetchedAt`; refreshed on app start and every 5 min online. UI shows "Lists updated 2 h ago" when older than 1 h.

**App shell offline:** Serwist precaches the app shell and the field-entry routes so the app opens with no signal. Pages are network-first with cached fallback; API responses are not cached by the service worker (the app manages its own cache).

**Photos offline:** compressed image stored as a Blob in Dexie; uploaded via `PUT /api/files/:id` (idempotent by id + sha256) before the mutation that references it.

## 8. Hosting and deployment

**Containers (`ops/compose.yml`, project name `roofy`)**
| Service | Image | Memory limit | Ports |
|---|---|---|---|
| `app` | Next.js standalone (Node 24 LTS, non-root) | 768 MB | 127.0.0.1:3100 |
| `db` | postgres:17 (tuned: shared_buffers 128 MB) | 768 MB | 127.0.0.1:5440 (admin only) |
| `backup` | small Alpine image with pg_dump, age, curl, supercronic | 128 MB | — |

Volumes: `db-data`, `files`, `backups`. Workers (pg-boss) run inside the `app` process in MVP.

**nginx** (existing): new vhost `roofy.<domain>` → `127.0.0.1:3100`, HTTPS via certbot, gzip/brotli for static, `client_max_body_size 15m`. **Prerequisite:** a domain name pointing at the server.

**Deploy:** build image on the server (`docker compose build app`) → run migrations (`pnpm db:migrate` in a one-off container) → `docker compose up -d app`. Health check `GET /api/health` (DB reachable, migrations current).

**Environments:** `dev` (local compose, seeded demo data), `preview` (same server, separate DB and subdomain, used for design review on real phones), `prod`.

**Moving to Sydney:** new VPS → install Docker + nginx → copy `ops/` + `.env` → restore latest backup (§9) → switch DNS. Target < 2 h. Rehearsed once before paying customers.

## 9. Backups (Telegram)

- **Nightly 02:00 (workspace tz):** `pg_dump -Fc` → encrypt with **age** (public key on server; private key kept offline by the owner) → send to the owner's Telegram chat via Bot API `sendDocument`.
- **Files:** nightly archive of files added that day + weekly (Sunday) full archive. Archives over 45 MB are split into 45 MB parts (Bot API limit is 50 MB per file).
- **Retention:** last 7 nightly sets kept on the server; Telegram keeps its copies (encrypted, so harmless).
- **Alerts:** any failure → Telegram message with the error. Success → short daily summary (sizes).
- **Restore test (monthly, automatic):** restore the latest dump into a throwaway Postgres container, run migrations check + row counts, report result to Telegram.
- **Runbook:** `ops/restore.md` — step-by-step restore from Telegram files on a fresh server.
- **Uptime:** free external monitor (e.g. UptimeRobot) on `/api/health` → alerts by email/Telegram.

## 10. Testing and verification

| Layer | Tool | What | Gate |
|---|---|---|---|
| Domain | Vitest | Every rule + every example E1.1–E15.1 in `02-pay-rules.md` as named tests; property tests for splits (sum always exact) | 100% branch coverage of `src/domain` |
| Services | Vitest + real Postgres (compose test DB) | Permissions per role, RLS cross-tenant attempts, locked-log trigger, pay run approve/reopen, adjustments, idempotent sync push | All pass |
| E2E | Playwright — **WebKit (iPhone 15 viewport)**, Chromium (Pixel 8), Chromium desktop 1440×900 | Core journeys: onboarding → first log; crew-day grid; progress split; pause/resume/done + lump sum; expense with photo; pay run review → approve → CSV; statement link | All pass on all 3 |
| Offline | Playwright `context.setOffline()` | Save offline → reconnect → exactly once on server; duplicate send; server rejection → Needs attention; reload while offline keeps queue; session expiry while offline | All pass on WebKit + Chromium |
| Visual | Playwright screenshots per screen × 3 viewports × light/dark | Compared to approved baselines from the design phase | Diff reviewed |
| Accessibility | axe-core in e2e | No serious/critical violations on core flows | Pass |
| Performance | Lighthouse (mobile) on Home + Log with 2-year seed | Home usable < 2 s (Sydney) / < 3 s (France) on simulated 4G | Pass |
| Acceptance | Design partner's real week | Pay sheet matches what they actually paid (differences explained) | Before pilot |

Seed script generates a realistic 2-year workspace (5 projects running, 12 crew, mixed bases) for dev, preview, tests and performance checks.

## 11. How we build it with Claude Code

Based on current Claude Code guidance (explore → plan → implement → verify; context is the scarce resource; give Claude a check it can run).

**Order of work — design before logic, logic before wiring**
1. **Specs** (these three files) — approved.
2. **Design phase** (full process and gates: `04-design-process.md`): `docs/design/brief.md` (users, context, tone), design tokens in code (colours light/dark, type scale, spacing, radius, tap sizes), component primitives, then **every screen in the inventory built as real Next.js routes against a fake in-memory data layer** that implements the same service interfaces as the real one. Deployed to `preview` (owner can look any time, but is not a required gate). **Screens pass the self-checking design loop — automated checks + independent critic agents — before any backend work.** Passing screenshots become visual baselines. The prototype code *is* the production UI — nothing is thrown away.
3. **Domain core:** `src/domain` written test-first from `02-pay-rules.md`.
4. **Vertical slices:** each slice swaps the fake data layer for real services for a group of screens, with DB, permissions, tests and e2e — see the implementation plan.

**Every slice is "done" only when:** typecheck + lint clean · unit, integration, e2e (3 viewports) green · offline tests green where relevant · screenshots match approved design (differences listed and fixed or approved) · a fresh-context reviewer subagent checks the diff against the spec and reports only correctness/requirement gaps · evidence (test output, screenshots) shown in the session.

**Project setup for Claude**
- `CLAUDE.md` < 150 lines: commands, folder rules (§3), money rules, "never do money maths outside `src/domain`", "foreman DTOs have no money", how to run tests, pointers to specs. No tutorials.
- Detailed knowledge in on-demand files (specs, `docs/design/*`) and project skills (e.g. `pay-rules`, `ui-conventions`) instead of CLAUDE.md.
- Hooks: after edits → format + lint changed files; Stop hook → typecheck + domain tests must pass.
- Playwright MCP for visual checks against running app.
- One fresh session per slice, driven by the written plan; `/clear` between unrelated tasks.

## 12. Open technical risks

| Risk | Mitigation |
|---|---|
| iOS PWA quirks (install flow, storage, camera input) | Test on real iPhone in preview each slice; WebKit e2e; install guide |
| Shared VPS memory pressure | Container memory limits; Postgres tuned small; monitor with `docker stats`; move to own VPS (Sydney) before paid launch |
| France latency for AU users during pilot | Server-render pages, minimise round trips, outbox makes saves instant |
| Bot API file limit | 45 MB parts; DB dumps stay small (tens of MB after years) |
| Email deliverability | SPF/DKIM on the domain via provider |
| Single server = single point of failure | Nightly encrypted off-server backups, monthly restore test, < 2 h restore runbook |
