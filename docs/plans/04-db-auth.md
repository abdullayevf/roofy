# Phase 3 — Database, Auth, Tenancy and Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Run it the way `docs/plans/RUNBOOK.md` says (thin conductor, briefs of pointers, reviewer + spec-reviewer per task, budgets in §5).

**Goal:** A real Postgres database behind the Phase 2 contracts for sign-up, sign-in, the set-up wizard and members: every table in the architecture, tenant isolation enforced twice (services and row-level security), audit and locked-log triggers, Better Auth with Owner 2FA, a server-side permission matrix, and email for verification, reset and invites. A new owner can sign up, verify, build a workspace and add crew against the real DB on all three viewports.

**Architecture:** `src/server/db` holds the Drizzle schema, hand-checked SQL migrations, and the `withActor` transaction wrapper. `withActor` sets `app.workspace_id`, `app.user_id` and `app.role` with `SET LOCAL`, and RLS policies and triggers read them. The app connects as `roofy_app`, which does not own any table, cannot bypass RLS, and every tenant table forces RLS. Better Auth connects as `roofy_auth`, which only has grants on the auth tables plus `workspace`, `member` and `invitation`. `src/server/authz` owns the role × action matrix and the role-shaped DTO functions. `src/server/services` implements the existing `src/data/contracts.ts` interfaces for real.

`src/data` still may not import `@/server`. Instead, `src/instrumentation.ts` registers the server's provider into a small registry in `src/data` when `ROOFY_DATA=db`. Then `getData()`, `getAuth()` and `getOnboarding()` serve real data. `ROOFY_DATA=fake` stays the default for every Phase 2 e2e, visual and capture run. In db mode, services that later phases build throw `DataError("unavailable")`.

**Tech Stack:** PostgreSQL 17 (dev container `ops/compose.dev.yml`, port 5440), drizzle-orm + drizzle-kit (SQL migrations in `src/server/db/migrations`), `pg` (node-postgres), Better Auth (organization, twoFactor and nextCookies plugins, Drizzle adapter), nodemailer (SMTP adapter; console transport in dev/test), uuid v7, zod 4, Vitest 5 (new `integration` project), Playwright 1.63 (new `db-*` projects). Before writing Next.js code read `node_modules/next/dist/docs/` (AGENTS.md). Before writing Better Auth code read the installed package's docs/types in `node_modules/better-auth`, because the API names below must be checked against the pinned version.

**Spec:**

- `docs/specs/03-architecture.md`: §3 (layout and import rules), §4 (request flow), §5 (data model), §6 (security), §10 ("Services" row).
- `docs/specs/01-product-spec.md`: §3 (roles), §5.1 (onboarding), and §5.8 / §7 lines on 2FA.
- `docs/design/flows.md`: line 224 (the 2FA approval block).
- `docs/plans/00-master-plan.md`: "## Phase 3".

## Global Constraints

- Money is `bigint` cents in the DB and integer cents in TS. Quantities and hours are `numeric(12,2)` in the DB and integer hundredths in TS, converted only in `src/server/db/convert.ts`. Percentages are basis points. No floats for money, and no money maths outside `src/domain`.
- Dates are `date` columns that round-trip as `YYYY-MM-DD` strings (`mode: "string"`), never JS `Date`. Work dates come from `todayIn(workspace.timezone, now)`, never the server's local date.
- IDs are `uuid` v7. Better Auth is configured to generate v7 UUIDs too. Every table except the auth tables (`user`, `session`, `account`, `verification`, `two_factor`, `rate_limit`) has `workspace_id uuid not null`, `created_at` and `updated_at`. The one exception is `workspace` itself: its own `id` is the tenant key, and its RLS policy matches on `id`.
- `src/domain` imports only `@/domain/*` and `@/lib/*`. `src/components`, `src/offline` and `src/data` never import `@/server/*` (eslint rules stay as they are).
- Foreman-shaped data never contains rates, amounts, budgets, margins or balances (`src/data/dto.ts` `MONEY_KEY` / `MONEY_TEXT`).
- Secrets live only in `.env` (git-ignored). `.env.example` documents every variable with dev-only values.
- Docker: only `ops/compose.dev.yml` (container on 127.0.0.1:5440). Never touch other projects, other containers, or ports 3000, 3005, 5434, 5439 or 8080.
- UI: only DESIGN.md tokens and components, `pnpm lint:design` clean, plain words, sentence case, verbs on buttons, none of the DESIGN.md §7 jargon.
- TDD: failing test first in every task. Implementers run `pnpm verify` and commit with the CLAUDE.md trailer. The conductor runs e2e.

## Decisions (recorded here; copy any change to PROGRESS.md "Decisions and deviations")

1. **Data mode `db`.** `ROOFY_DATA=db` selects the real layer. Wiring goes through `src/instrumentation.ts` → `registerDbData()` (no `src/data` → `src/server` import). The fake mode and all Phase 2 tests stay as they are.
2. **Two DB login roles, one owner.**
   - `roofy` owns the schema and runs migrations.
   - `roofy_app` (NOBYPASSRLS, NOSUPERUSER, not an owner) serves every service query.
   - `roofy_auth` (NOBYPASSRLS) serves only Better Auth, with grants limited to auth tables, `workspace`, `member` and `invitation`.
   - Migrations create both roles NOLOGIN if missing. `pnpm db:roles` sets LOGIN and the passwords from `.env`.
3. **Cross-tenant references are blocked by composite foreign keys.** Every parent table has `unique (workspace_id, id)`, and every child references `(workspace_id, <parent>_id)`. This is needed because Postgres does not apply RLS to FK checks.
4. **`workspace.onboarding_step`** (text, default `'business'`) and `workspace.trade` are added beyond architecture §5 so the wizard resumes after a reload, like the fake does.
5. **Roofing defaults** (templates, expense categories, crew levels) move from the fake seed into `src/lib/roofing-defaults.ts`. Fake and real both read them.
6. **Integration tests** live in `tests/integration/**/*.int.test.ts` as the Vitest project `integration`, against `roofy_test` (dropped and re-migrated once per run). They are part of `vitest run`, so `pnpm verify` and `pnpm test:coverage` need the dev DB up (`pnpm db:up`) and a `.env` copied from `.env.example`; `pnpm test:unit` (`--project unit`) does not (Task 1 fix 8342c29). Coverage stays 100% on `src/domain` only.
7. **Email in dev/test.**
   - The console transport prints each message.
   - When `ROOFY_MAIL_LOG` is set, it also appends one JSON line per message (`{to, subject, text, links}`) to that file. Db-mode e2e reads verification and invite links from there.
8. **Google sign-in** is configured and unit-tested (the button returns Google's authorize URL when `GOOGLE_CLIENT_ID` is set, and shows "Google sign-in is not set up" when it isn't). The real Google click-through is checked by hand in Phase 9 with production credentials. The exit e2e uses email + password.
9. **Owner 2FA.** Signing up and setting up a workspace work without 2FA. The authz matrix denies `payRun.approve` to an Owner without 2FA (flows.md line 224), and the members screen shows Owner 2FA status. The matrix encodes the rule now; the pay-run screen uses it in Phase 7.

## Review Focus

1. **A tenant table without RLS, or a query outside `withActor`.**
   - Every public table with a `workspace_id` column must have RLS enabled and forced, and must have a policy.
   - The only tables without `workspace_id` are the six auth tables and `workspace` (its policy matches on `id`).
   - A pooled connection reused after `withActor` sees no rows.
   - Pinned in Task 4 (catalogue test plus a cross-tenant read/insert/update/delete on every table).
2. **Cross-tenant references.** An insert in workspace A that points at workspace B's crew member, stage, project, category or pay run must fail. Pinned in Task 2 and Task 3 (composite FK tests).
3. **Foreman money leakage from real services.** Every foreman-reachable real service result passes `expectNoMoney`. Pinned in Task 9 (shapers) and Task 11 (real-service scan).
4. **Locked logs edited outside the approve/reopen path.**
   - UPDATE, DELETE, soft-delete or unlock of a `work_log` with `pay_run_id` set is rejected.
   - The bypass flag string appears in exactly one source file.
   - Pinned in Task 6.
5. **Role changes that lock the business out.**
   - Demoting or removing the last Owner is refused.
   - A Manager cannot change the Owner.
   - Inviting an email that is already a member is a plain refusal.
   - An Owner without 2FA cannot approve.
   - Pinned in Task 9 (matrix) and Task 11 (service).

---

## File map

| Path                                                                                                      | Responsibility                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `drizzle.config.ts`                                                                                       | drizzle-kit config (schema path, `src/server/db/migrations`, owner URL)                                          |
| `src/server/db/client.ts`                                                                                 | `pg` pools for `roofy_app` and `roofy_auth`; `getDb()`, `getAuthDb()`                                                   |
| `src/server/db/schema/*.ts`                                                                               | Drizzle tables: `auth.ts`, `workspace.ts`, `jobs.ts`, `crew.ts`, `field.ts`, `money.ts`, `system.ts`, `index.ts` |
| `src/server/db/migrations/*.sql`                                                                          | Generated plus hand-written SQL (roles, grants, RLS, triggers)                                                   |
| `src/server/db/convert.ts`                                                                                | numeric(12,2) ↔ hundredths, bigint ↔ cents (pure, unit-tested)                                                   |
| `src/server/db/with-actor.ts`                                                                             | `withActor(actor, fn)`, transaction with `SET LOCAL`                                                             |
| `src/server/db/locked.ts`                                                                                 | `withLockedWrite(tx)`, the only place the locked-log bypass flag is set                                          |
| `src/server/db/audit.ts`                                                                                  | `AUDITED_TABLES` list (used by the migration test)                                                               |
| `src/server/db/tenancy.ts`                                                                                | `TENANT_TABLES`, `AUTH_TABLES` lists                                                                             |
| `src/server/email/*.ts`                                                                                   | `Mailer` interface, SMTP and console transports, templates                                                       |
| `src/server/auth/auth.ts`                                                                                 | Better Auth instance (adapter, plugins, rate limit, cookies)                                                     |
| `src/server/auth/actor.ts`                                                                                | `actorFromHeaders(headers)`, session → `Actor` or redirect                                                       |
| `src/app/api/auth/[...all]/route.ts`                                                                      | Better Auth route handler                                                                                        |
| `src/server/authz/matrix.ts`                                                                              | `Action` union, `can(actor, action, ctx)`, `assertCan`                                                           |
| `src/server/authz/shape.ts`                                                                               | Role-shaped DTO functions (foreman variants carry no money)                                                      |
| `src/server/services/workspace.ts`                                                                        | Real `WorkspaceService`                                                                                          |
| `src/server/services/onboarding.ts`                                                                       | Real `OnboardingService`                                                                                         |
| `src/server/services/auth.ts`                                                                             | Real `AuthService`                                                                                               |
| `src/server/services/index.ts`                                                                            | `createDbServices(actor)`: real services plus `unavailable` stubs                                                |
| `src/server/data.ts`                                                                                      | `dbDataProvider`, registered by instrumentation                                                                  |
| `src/instrumentation.ts`                                                                                  | Registers the provider when `ROOFY_DATA=db` (nodejs runtime)                                                     |
| `src/data/db-registry.ts`                                                                                 | `DbDataProvider` type, `registerDbData`, `dbData`                                                                |
| `src/data/index.ts`                                                                                       | `DataMode = "fake" \| "db"`; dispatch in `getData` / `getAuth` / `getOnboarding*` / write contexts               |
| `src/data/contracts.ts`                                                                                   | AuthService additions (verify, reset, 2FA challenge, invite accept); `AuthSession.next` widened                  |
| `src/lib/roofing-defaults.ts`                                                                             | Default templates, categories and levels (fake and real)                                                         |
| `src/app/(entry)/check-email`, `verify`, `forgot-password`, `reset-password`, `two-factor`, `invite/[id]` | New entry screens                                                                                                |
| `src/app/(app)/settings/members`, `two-factor`                                                            | Wired to real services                                                                                           |
| `scripts/db-roles.ts`, `scripts/db-reset-test.ts`                                                         | Set role passwords; drop and re-migrate `roofy_test`                                                             |
| `tests/integration/`                                                                                      | `setup.ts` (global setup), `helpers.ts` (workspaces, actors), `*.int.test.ts`                                    |
| `tests/e2e-db/`                                                                                           | Db-mode Playwright specs and the mail-log helper                                                                 |
| `playwright.config.ts`                                                                                    | `db-iphone`, `db-android`, `db-desktop` projects and a second webServer with `ROOFY_DATA=db` on port 3101        |

## Model choice per task

- **opus:** Tasks 2, 3, 4, 5, 6, 8, 9, 10, 11 and 12 (schema, RLS, audit, locked logs, auth, authz, real services). Any of these can leak money or tenants.
- **sonnet:** Tasks 1, 7, 13 and 14 (toolchain, email, screens, e2e).
- **opus:** The phase gate spec-reviewer.

Each task is one implementer run of at most 30 steps. A task marked "2 runs" is split where its first paragraph says, from the start.

---

### Task 1: DB toolchain and integration test harness (sonnet)

**Files:**

- Create: `drizzle.config.ts`, `src/server/db/client.ts`, `src/server/db/schema/index.ts` (empty barrel), `scripts/db-roles.ts`, `scripts/db-reset-test.ts`, `tests/integration/setup.ts`, `tests/integration/helpers.ts`, `tests/integration/smoke.int.test.ts`.
- Modify: `package.json`, `vitest.config.ts`, `.env.example`.

**Interfaces:**

- Produces:
  - `getDb()` and `getAuthDb()` (lazy, return drizzle `NodePgDatabase`; were `db`/`authDb`, changed in Task 1 fix 8342c29).
  - `pool(role: "app" | "auth" | "owner")` for tests.
  - Scripts `db:generate` (drizzle-kit generate), `db:migrate`, `db:roles`, `db:reset-test`, `test:integration` (`vitest run --project integration`).
  - Env: `DATABASE_URL` (app role), `AUTH_DATABASE_URL`, `MIGRATE_DATABASE_URL` (owner), and `TEST_*` twins of all three, plus `ROOFY_APP_DB_PASSWORD` and `ROOFY_AUTH_DB_PASSWORD`.

- [x] Add `drizzle-orm`, `pg`, `uuid` (if absent) and dev deps `drizzle-kit` and `@types/pg`. Pin exact versions.
- [x] Failing test first: `smoke.int.test.ts` connects with the owner test URL and asserts `select current_database()` = `roofy_test` and `server_version_num >= 170000`.
- [x] Add the Vitest project `integration`:
  - `include: ["tests/integration/**/*.int.test.ts"]`, `environment: "node"`, `fileParallelism: false`, `globalSetup: ["tests/integration/setup.ts"]`.
  - Make sure `unit` does not pick these files up.
- [x] Global setup:
  - Fail fast with "Test database not reachable on 127.0.0.1:5440. Run pnpm db:up." when it can't connect.
  - Run `db-reset-test` (drop schema public cascade, recreate, migrate as owner), then `db-roles` against `roofy_test`.
- [x] `client.ts` builds two lazily created pools from env and throws a plain error naming the missing variable.
- [x] Done when `pnpm test:integration` passes the smoke test, `pnpm verify` is green (the integration project is included), and `.env.example` lists every new variable with dev values.

### Task 2: Schema part A — workspace, auth, people and jobs (opus)

**Files:**

- Create: `src/server/db/schema/{auth,workspace,jobs,crew}.ts`, `src/server/db/convert.ts` + `convert.test.ts`, `src/server/db/tenancy.ts`, `tests/integration/schema-a.int.test.ts`.
- Generated: the first migration.

**Interfaces:**

- Produces:
  - Drizzle tables: `user`, `session`, `account`, `verification`, `twoFactor`, `rateLimit`, `workspace`, `member`, `invitation`, `projectAssignment`, `client`, `project`, `stageTemplate`, `stageTemplateItem`, `stage`, `stageSegment`, `stageCompletionShare`, `crewLevel`, `crewMember`, `rate`.
  - `toHundredths(numeric: string): number`, `fromHundredths(n: number): string`, `toCents(bigint: string | bigint): number`, `fromCents(n: number): string`.
  - `TENANT_TABLES` and `AUTH_TABLES` (`readonly string[]`, kept in sync by a test).

- [x] Failing unit tests first for `convert.ts`:
  - "12.50" → 1250, "0.01" → 1.
  - Reject more than 2 decimals.
  - Cents outside `Number.MAX_SAFE_INTEGER` throws.
- [x] Columns and enums per architecture §5 for these tables, plus decision 4.
  - The auth table shapes come from the Better Auth version installed in Task 8. Generate them now with its CLI (`npx @better-auth/cli generate` or the installed equivalent) and reconcile them with uuid ids.
  - `workspace` is the organization model, `member.workspace_id` is the organization id, and `invitation` carries `workspace_id`.
- [x] Every tenant table gets `unique (workspace_id, id)`, and child FKs are composite (decision 3).
- [x] `rate` unique is `(workspace_id, crew_member_id, basis, unit, project_id, effective_from) NULLS NOT DISTINCT`.
- [x] Date columns use `date(..., { mode: "string" })`. Money columns are `bigint({ mode: "number" })` with a CHECK that fits the safe range, or `mode: "bigint"` through `convert.ts`; pick one and use it everywhere.
- [x] Failing integration tests, then generate the migration and pass:
  - (a) A crew member in workspace A with `level_id` from workspace B is rejected.
  - (b) A rate with null project and null unit inserted twice for the same effective date is rejected.
  - (c) `date '2026-09-28'` reads back as the string `"2026-09-28"` with `TZ=Pacific/Kiritimati` set in the test process.
  - (d) `stage_segment` rejects `end_date < start_date`.
- [x] Done when the tests above pass, `pnpm db:generate` produces no further diff, and `pnpm verify` is green.

### Task 3: Schema part B — field, money and system tables (opus)

**Files:**

- Create: `src/server/db/schema/{field,money,system}.ts`, `tests/integration/schema-b.int.test.ts`.
- Generated: a migration.
- Modify: `tenancy.ts`.

**Interfaces:**

- Produces: Drizzle tables `progressEntry`, `progressShare`, `workLog`, `noWork`, `expenseCategory`, `expense`, `payRun`, `payRunLine`, `ledgerEntry`, `statementLink`, `file`, `clientMutation`, `auditEvent`.

- [x] Columns, enums and uniques per architecture §5:
  - `no_work` unique on (workspace, crew, date).
  - `pay_run` unique on (workspace, period_start, period_end).
  - `client_mutation.id` is the phone's uuid.
- [x] Indexes: `(workspace_id, date)` on `work_log`, `progress_entry`, `expense`, `no_work`; `(workspace_id, stage_id)` on `work_log`, `progress_entry`, `expense`; `(workspace_id, crew_member_id, date)` on `work_log`; `(pay_run_id)` on `work_log`, `pay_run_line`, `ledger_entry`.
- [x] CHECKs:
  - `share_bp between 0 and 10000`.
  - `amount_ex_gst_cents >= 0`, `gst_cents >= 0`.
  - `work_log.basis` and `source` enums.
  - `quantity`/`hours` `>= 0` except `source = 'adjustment'`.
- [x] Failing integration tests, then the migration:
  - (a) A cross-workspace composite-FK attempt for `work_log.crew_member_id`, `work_log.stage_id`, `expense.category_id` and `pay_run_line.pay_run_id` fails.
  - (b) A duplicate no-work for the same crew and date fails.
  - (c) An overlapping pay run with the same period fails.
  - (d) An index catalogue query finds each index listed above.
  - (e) The `TENANT_TABLES ∪ AUTH_TABLES` set equals the set of public tables.
- [x] Done when the tests pass, the generated SQL is reviewed (no `DROP` of Task 2 objects), and `pnpm verify` is green.

### Task 4: DB roles, row-level security and `withActor` (opus)

**Files:**

- Create: a hand-written migration `NNNN_roles_rls.sql`, `src/server/db/with-actor.ts`, `tests/integration/rls.int.test.ts`, `tests/integration/with-actor.int.test.ts`.

**Interfaces:**

- Consumes: `TENANT_TABLES`, `AUTH_TABLES`, `pool()`.
- Produces:
  - `withActor<T>(actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T>`, which runs one transaction on `getDb()` that first sets `set_config('app.workspace_id', actor.workspaceId, true)`, then `app.user_id` and `app.role`.
  - `type Tx`.
  - Test helper `makeWorkspace(): Promise<{ workspaceId, ownerActor }>`, run through the owner pool.

- [x] Failing tests first:
  - **Catalogue test:** every table in `TENANT_TABLES` has `relrowsecurity` and `relforcerowsecurity` true and at least one policy for `roofy_app`.
  - **Ownership test:** `roofy_app` and `roofy_auth` own no tables, and `rolbypassrls` is false for both.
  - **Cross-tenant test:** for every tenant table, as actor A on the app pool,
    - selecting B's seeded row returns 0 rows;
    - inserting a row with `workspace_id = B` raises;
    - updating or deleting B's row affects 0 rows.
  - **Pooled connection:** after a `withActor` transaction, a raw query on the same pool client sees 0 rows from any tenant table.
  - **Auth role scope:** `roofy_auth` has no privileges on any tenant table except `workspace`, `member` and `invitation`.
- [x] Migration:
  - Create the roles if missing (NOLOGIN).
  - Grant `roofy_app` SELECT/INSERT/UPDATE/DELETE on tenant tables, except `audit_event`, which gets SELECT only.
  - Enable and force RLS.
  - One policy per table for `roofy_app`: `USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK (same)`.
  - `roofy_auth` policies on `workspace`, `member` and `invitation`: `USING (true)`, because Better Auth's own queries have no workspace. Record this in a SQL comment.
- [x] Done when every table passes the cross-tenant test (the test loops over `TENANT_TABLES`, not a hand list) and `pnpm verify` is green.

### Task 5: Audit trigger and `audit_event` (opus)

**Files:**

- Create: a migration `NNNN_audit.sql`, `src/server/db/audit.ts`, `tests/integration/audit.int.test.ts`.

**Interfaces:**

- Produces: `AUDITED_TABLES = ["workspace","member","crew_level","crew_member","rate","project","stage","stage_completion_share","progress_entry","progress_share","work_log","no_work","expense","pay_run","pay_run_line","ledger_entry","statement_link"] as const`.

- [x] Failing tests first:
  - Inside `withActor`, an insert, update and delete on `rate` writes 3 `audit_event` rows. Each has `table_name`, `row_id` and `action`, `before`/`after` jsonb (null on the missing side), `actor_user_id` = the actor's user id, and the row's `workspace_id`.
  - The trigger is attached to exactly `AUDITED_TABLES` (catalogue query).
  - `roofy_app` cannot UPDATE or DELETE `audit_event` (permission error).
  - Actor A cannot read B's audit rows.
  - `statement_link.token_hash` is left out of `before`/`after`.
- [x] Implement:
  - A `SECURITY DEFINER` function owned by `roofy` with `search_path` pinned. It reads `app.user_id`, writes `audit_event`, and drops secret columns.
  - One `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` trigger per table in `AUDITED_TABLES`.
- [x] Done when the tests pass and `pnpm verify` is green.

### Task 6: Locked-log immutability trigger (opus)

**Files:**

- Create: a migration `NNNN_locked_logs.sql`, `src/server/db/locked.ts`, `tests/integration/locked-log.int.test.ts`, `src/server/db/locked.test.ts` (source scan).

**Interfaces:**

- Produces: `withLockedWrite<T>(tx: Tx, fn: () => Promise<T>): Promise<T>`, which sets `app.locked_write = 'on'` with `set_config(..., true)` and resets it to `''` afterwards. Only the Phase 7 approve/reopen service calls it.

- [x] Failing tests first. With a `work_log` whose `pay_run_id` is set:
  - UPDATE of `hours` raises SQLSTATE `RF001` with the message "This log is in an approved pay run".
  - Setting `deleted_at` raises.
  - DELETE raises.
  - Setting `pay_run_id = null` raises.
  - Setting `pay_run_id` on an unlocked row without the flag raises.
  - The same changes inside `withLockedWrite` succeed and are audited (Task 5).
  - After `withLockedWrite` returns, an update in the same transaction is rejected again.
  - Unit source scan: the string `app.locked_write` appears only in `locked.ts` and the migration.
- [x] Implement a `BEFORE UPDATE OR DELETE` row trigger. It rejects when `OLD.pay_run_id IS NOT NULL` or `NEW.pay_run_id IS DISTINCT FROM OLD.pay_run_id`, unless `current_setting('app.locked_write', true) = 'on'`.
- [x] Done when the tests pass and `pnpm verify` is green.

### Task 7: Email adapter (sonnet)

**Files:**

- Create: `src/server/email/{mailer.ts,console.ts,smtp.ts,templates.ts,index.ts}` + tests.
- Modify: `.env.example` (`ROOFY_MAIL=console|smtp`, `SMTP_URL`, `MAIL_FROM`, `ROOFY_MAIL_LOG`).

**Interfaces:**

- Produces:
  - `interface Mailer { send(m: { to: string; subject: string; text: string; html: string }): Promise<void> }`.
  - `getMailer(): Mailer`.
  - `verificationEmail(url)`, `resetEmail(url)`, `inviteEmail({ workspaceName, inviterName, role, url })`, each returning `{ subject, text, html }`.

- [x] Failing tests first:
  - Each template contains its link in both `text` and `html`, uses plain sentence-case copy, and contains no money.
  - The console transport writes one JSON line `{to, subject, text, links}` to `ROOFY_MAIL_LOG` when it is set.
  - `ROOFY_MAIL=smtp` without `SMTP_URL` throws at first send with a plain message.
  - The SMTP transport is exercised with a nodemailer `jsonTransport` stub.
- [x] Add nodemailer and `@types/nodemailer`, then implement.
- [x] Done when the tests pass and `pnpm verify` is green.

### Task 8: Better Auth (opus)

**Files:**

- Create: `src/server/auth/auth.ts`, `src/server/auth/actor.ts`, `src/app/api/auth/[...all]/route.ts`, `tests/integration/auth.int.test.ts`.
- Modify: `.env.example` (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

**Interfaces:**

- Consumes: `getAuthDb()`, the Task 2 auth schema, `getMailer()` and the templates.
- Produces:
  - `auth` (the Better Auth instance).
  - `actorFromHeaders(h: Headers): Promise<{ kind: "actor"; actor: Actor; timezone: string; workspaceName: string } | { kind: "signed-out" } | { kind: "no-workspace"; userId: string }>`.
  - `ROLES_AC`: the organization access-control roles `owner | manager | foreman | accountant`.

- [x] Check the API names below against the installed `better-auth` types first.
- [x] Failing integration tests first, calling `auth.api.*` directly against `roofy_test`:
  - Sign-up with email sends one verification mail (captured by a test mailer), and sign-in before verification is refused.
  - Verifying the token, then signing in, returns a session cookie with `HttpOnly`, `SameSite=Lax`, and `Secure` when `BETTER_AUTH_URL` is https.
  - Password reset sends a mail, and the new password works.
  - Creating an organization makes the creator `owner`, and `actorFromHeaders` maps the session's active organization and member role to `Actor`.
  - TOTP enable → verify → sign-in requires the second factor.
  - The 6th wrong password within the window is rate-limited (429).
  - User ids are uuid v7.
  - With Google env unset, the social provider list is empty. With it set, `signInSocial` returns an `accounts.google.com` URL.
- [x] Configure:
  - The Drizzle adapter on `getAuthDb()` with model names mapped (`organization` → `workspace`, `organizationId` → `workspace_id`).
  - Email+password with `requireEmailVerification` and auto sign-in after verification.
  - The organization plugin with custom roles, `sendInvitationEmail` and no creator-limit surprises.
  - `twoFactor` with issuer "Roofy".
  - `rateLimit` with database storage on auth routes.
  - `nextCookies()` last.
  - v7 id generation.
- [x] The route handler exports `GET` and `POST` via the Next.js adapter that Better Auth documents for the installed version.
- [x] Done when the tests pass, `curl -s localhost:3100/api/auth/ok` answers when `pnpm dev` runs with `ROOFY_DATA=db`, and `pnpm verify` is green.

### Task 9: Permission matrix and role-shaped DTOs (opus)

**Files:**

- Create: `src/server/authz/matrix.ts` + `matrix.test.ts`, `src/server/authz/shape.ts` + `shape.test.ts`.

**Interfaces:**

- Consumes: `Actor`, `Role`, `Member` and the foreman DTO types from `src/data/contracts.ts`, and `expectNoMoney` from `src/data/dto.ts`.
- Produces:
  - `type Action` is a string union grouped by area:
    - `workspace.read|edit|delete|billing`
    - `member.read|invite|setRole|remove|changeOwner`
    - `assignment.edit`
    - `project.read|edit`
    - `stage.edit|markDone|pauseResume`
    - `crew.read|edit`
    - `rate.read|edit`
    - `log.write`
    - `progress.write`
    - `expense.write|readAll`
    - `payRun.read|edit|approve|export`
    - `payout.read|edit`
    - `report.read`
    - `export.run`
    - `money.read`
    - `twoFactor.manage`
  - `can(actor: Actor & { twoFactorEnabled: boolean }, action: Action, ctx?: { projectId?: string; assignedProjectIds?: readonly string[] }): boolean`.
  - `assertCan(...)`, which throws `DataError("forbidden", "You don't have access to this.")`.
  - `shapeMember(actor, m)` and `shapeAccess(actor): Access`.

- [x] Failing table test first. One `it.each` row per role × action, with the expected allow/deny from product spec §3. The named rows are:
  - Manager is denied `workspace.billing`, `workspace.delete` and `member.changeOwner`.
  - Foreman is denied `stage.markDone`, `money.read`, `rate.read` and `payRun.read`.
  - Foreman `log.write` is allowed only when `ctx.projectId` is in `assignedProjectIds`.
  - Accountant is allowed `payRun.read`, `payRun.export`, `payout.read`, `report.read` and `export.run`, and denied every `*.edit`/`*.write`.
  - Owner without 2FA is denied `payRun.approve`; Owner with 2FA is allowed.
  - Manager `payRun.approve` is allowed.
- [x] Exhaustiveness test: every `Action` × every `Role` has a row (built from the union's runtime list).
- [x] The shapers return foreman variants that pass `expectNoMoney`. Fixtures that carry every money field prove they are stripped.
- [x] Done when the tests pass and `pnpm verify` is green.

### Task 10: Data mode `db` and session → actor wiring (opus)

**Files:**

- Create: `src/data/db-registry.ts` + test, `src/server/data.ts`, `src/server/services/index.ts`, `src/instrumentation.ts`.
- Modify: `src/data/index.ts` + `index.test.ts`, `src/data/contracts.ts` (AuthService additions below), `src/data/fake/services/auth.ts` (fake implementations of the additions), `src/lib/roofing-defaults.ts` (moved from the fake seed; the fake imports it).

**Interfaces:**

- Produces:
  - `interface DbDataProvider { context(h: Headers): Promise<DataContextCore | { redirect: "/sign-in" | "/onboarding" }>; auth(): AuthService; onboarding(h: Headers): Promise<{ actor: Actor; service: OnboardingService } | { redirect: "/sign-in" | "/" }> }`, where `DataContextCore = { actor; data: DataServices; today: LocalDate; workspaceName: string }`.
  - `registerDbData(p)` and `dbData()`. `dbData()` throws "The database data layer is not registered" if unset.
  - `ROOFING_DEFAULTS: { templates; categories; levels }` from `src/lib/roofing-defaults.ts`, with the same values the fake seed has today.
  - `createDbServices(actor)`: real workspace service (Task 11); every other `DataServices` method rejects with `DataError("unavailable", "This part isn't ready yet.")`.
  - AuthService additions:
    - `verifyEmail(token)`, `requestPasswordReset(email)`, `resetPassword(token, password)`, `verifyTwoFactor(code)`, `acceptInvite(invitationId)`.
    - `AuthSession.next` widens to `"/" | "/onboarding" | "/check-email" | "/two-factor"`.
    - `continueWithGoogle` may return `{ redirectTo: string }`.
- [x] Failing unit tests first:
  - `dataMode()` accepts `db`.
  - In db mode, `getData()` calls `redirect("/sign-in")` for `signed-out` and `redirect("/onboarding")` for `no-workspace`, using a registered stub provider.
  - In db mode, `demo` flags are all false and `?demo=` is ignored.
  - Fake mode behaviour is unchanged (existing tests stay green).
  - The fake AuthService additions behave like the prototype (`requestPasswordReset` always answers the same sentence, so it never reveals whether an email exists).
- [x] `src/instrumentation.ts` `register()` imports `@/server/data` only when `process.env.NEXT_RUNTIME === "nodejs"` and `ROOFY_DATA === "db"`. Confirm the hook in `node_modules/next/dist/docs` first.
- [x] In db mode, `today` = `todayIn(timezone, new Date())`.
- [x] Done when unit tests pass, `pnpm build` succeeds, `ROOFY_DATA=db pnpm start -p 3101` redirects `/` to `/sign-in` (curl `-I`), and `pnpm verify` is green.

### Task 11: Real workspace service — settings, members, invites, roles, assignments (opus, 2 runs)

Run 1 covers settings, levels, categories and templates. Run 2 covers members, invites, roles, assignments, 2FA status and the foreman scan.

**Files:**

- Create: `src/server/services/workspace.ts`, `tests/integration/workspace-service.int.test.ts`, `tests/integration/foreman-scan.int.test.ts`.

**Interfaces:**

- Consumes: `withActor`, `assertCan`, the shapers, `auth.api` organization calls, and `getMailer()`.
- Produces: `createWorkspaceService(): WorkspaceService` (every method in `contracts.ts` `WorkspaceService`).

- [x] Failing integration tests first, per method, against `roofy_test`:
  - `settings`/`updateSettings` round-trip timezone, pay period, working days, standard hours (hundredths) and on-cost (basis points).
  - `inviteMember` creates an invitation and one invite mail. Inviting an existing member's email is refused with "This person is already in your team.".
  - `setMemberRole`: demoting the last Owner is refused with "Your business needs at least one owner.". A Manager setting anyone to or from Owner is forbidden.
  - `setAssignments` limits a foreman's `projectIds`.
  - `turnOnTwoFactor` reflects Better Auth's TOTP state.
  - `levels`/`saveLevel`, `categories`/`saveCategory` and `templates`/`saveTemplate` persist and are audited where listed.
  - Every method called as a member of workspace B on A's ids rejects `not_found`.
  - Accountant writes reject `forbidden`.
  - **Foreman scan** (`foreman-scan.int.test.ts`): a registry of every foreman-reachable real service method (workspace and onboarding now; later phases append) runs as a foreman actor, and each result passes `expectNoMoney`. A unit-level guard fails if a `WorkspaceService` method is missing from the registry.
- [x] Implement on `withActor`. Every query also filters `workspace_id = actor.workspaceId` (the first layer of tenant isolation).
- [x] Done when the tests pass and `pnpm verify` is green.

### Task 12: Real onboarding and auth services (opus)

**Files:**

- Create: `src/server/services/onboarding.ts`, `src/server/services/auth.ts`, `tests/integration/onboarding-service.int.test.ts`, `tests/integration/auth-service.int.test.ts`.
- Modify: `src/server/data.ts`, `src/app/actions/auth.ts` and `src/app/actions/onboarding.ts` (handle `redirectTo` and the new `next` values; no prototype cookies in db mode).

**Interfaces:**

- Consumes: `auth`, `withActor`, `ROOFING_DEFAULTS`, and `crewRowProblems`/`businessProblems` from `src/lib/onboarding-input`.
- Produces: `createDbOnboarding(actor | { userId }): OnboardingService` and `createDbAuth(): AuthService`.

- [x] Failing tests first:
  - `saveBusiness` for a user with no workspace creates the workspace (organization) with the user as Owner, sets it active, and stores name/ABN/GST with timezone default `Australia/Sydney`.
  - `chooseTrade` → `acceptDefaults` copies the roofing templates, categories and levels once (calling it twice adds no duplicates).
  - `addCrew` writes one `crew_member` and one `rate` (`effective_from` = today in the workspace timezone, project null).
  - Bad rows return the same field issues as the fake.
  - `back` and a reload resume at `workspace.onboarding_step`; `finish` → `done`.
  - A second user cannot call these on the first user's workspace.
  - `signUp` → `next: "/check-email"`.
  - `signIn` for an unverified user is refused with the fake's copy.
  - `signIn` with TOTP on → `next: "/two-factor"`.
  - `requestPasswordReset` answers the same for unknown emails.
  - `acceptInvite` joins with the invited role.
- [x] Run the existing `src/data/fake/services/onboarding.test.ts` expectations against both implementations through a shared contract test (`tests/integration/onboarding-contract.ts`), if they can share it without rewriting the fake.
- [x] Done when the tests pass and `pnpm verify` is green.

### Task 13: Entry screens and members screen, wired (sonnet, design loop)

**Files:**

- Create: `src/app/(entry)/{check-email,verify,forgot-password,reset-password,two-factor,invite/[id]}/page.tsx` plus their client forms.
- Modify:
  - `src/app/(entry)/sign-in/page.tsx` ("Forgot password?" link) and `sign-up/page.tsx`.
  - `src/app/(app)/settings/members/page.tsx` (invite, change role, remove, Owner 2FA status) and `settings/two-factor/page.tsx` (QR code + code entry in db mode).
  - `docs/design/flows.md` (new flows: verify email, reset password, sign-in with two-factor, accept invite; tap budgets).
  - `tests/e2e/screens.ts` (new group `auth`).

- [x] Brief carries the RUNBOOK §4 state checklist for each new screen (normal, filled, validation error, error, offline, expired link, already used link), the members screen for owner/manager/accountant, the foreman no-permission state, long names, and a pointer to `docs/design/loop/lessons.md`.
- [x] Failing component tests first for each form: validation messages, button verbs ("Send link", "Set password", "Check code", "Join team"), and no enumeration copy on reset.
- [x] Screens run in fake mode for capture through the Task 10 fake additions.
- [x] Design loop on group `auth` and the changed members screen (`scripts/capture-group.sh auth`): `design-critic` + `field-critic`, exit at average ≥ 90 and no P0/P1, 3-iteration cap.
- [x] Done when the component tests pass, the loop has exited and is recorded in `docs/design/loop/SCORES.md`, fake-mode e2e for the touched routes is green on iphone/android/desktop, and `pnpm verify` is green. (Done 2026-10-15: loop accepted at the 3-iteration cap, avg 83, no P0; e2e green on fake projects; visual diffs carried to Task 15.)

### Task 14: Db-mode e2e — sign up to crew, members, tenancy in the browser (sonnet)

**Files:**

- Create: `tests/e2e-db/{mail.ts,onboarding.db.spec.ts,members.db.spec.ts,signin.db.spec.ts}`.
- Modify: `playwright.config.ts`.

- [ ] Projects `db-iphone`, `db-android` and `db-desktop` (same devices as iphone/android/desktop, `testDir: tests/e2e-db`). A second webServer runs `ROOFY_DATA=db ROOFY_MAIL=console ROOFY_MAIL_LOG=.superpowers/run/mail.jsonl` on port 3101, with `db:reset-test`-style setup against a dedicated `roofy_e2e` database. Create it the way `ops/dev/init.sql` creates `roofy_test`; the migration step does it if missing. The fake projects are unchanged.
- [ ] `onboarding.db.spec.ts`:
  - Sign up with a unique email, open the verification link from the mail log, then complete business → trade → defaults.
  - Add 2 crew (an employee hourly and a contractor daily), go through install, and reach done.
  - Assert the crew appear in Settings and a direct DB query finds 2 `crew_member` and 2 `rate` rows in the new workspace.
  - Time the run from sign-up to done and log it (target in §5.1).
- [ ] `members.db.spec.ts`: the Owner invites a foreman, and the invite link from the mail log lets a second browser context join. The foreman sees no money on any page it can reach (reuse `tests/e2e/money-scan.ts`) and cannot open `/settings/members`.
- [ ] `signin.db.spec.ts`:
  - Wrong password shows the plain error.
  - A reset link works.
  - With TOTP on, sign-in asks for the code (generate it with the test's TOTP helper from the secret shown on the setup screen).
  - A user of workspace A who opens a URL with workspace B's member id gets the not-found page.
- [ ] The conductor runs `pnpm exec playwright test --project=db-iphone --project=db-android --project=db-desktop`.
- [ ] Done when green on all three db projects, and `pnpm verify` is green.

### Task 15: Phase gate

- [ ] `pnpm db:up`, then `pnpm verify` green in full (typecheck, lint, design lint, tokens, contrast, unit + integration with coverage 100% on `src/domain`, examples).
- [ ] Full e2e by the conductor:
  - `pnpm test:e2e` (fake projects iphone, android, desktop, unchanged from Phase 2).
  - Db-mode projects `db-iphone`, `db-android`, `db-desktop` against the real DB, all green. Known flaky tests from PROGRESS.md are re-run once before being counted.
- [ ] `pnpm test:visual` shows no unexpected diffs. Diffs on the screens changed in Task 13 are reviewed and baselines updated in one commit.
- [ ] `pnpm test:coverage`: domain stays at 100%. Record the integration test count.
- [ ] Master-plan Phase 3 test list ticked with evidence (file and test name):
  - cross-tenant attempts on every table (Task 4)
  - role × action matrix (Task 9)
  - audit before/after (Task 5)
  - locked log rejected (Task 6)
  - foreman DTO scan (Tasks 9 and 11)
- [ ] `spec-reviewer` (opus) on `git diff master...HEAD` against architecture §3–§6, product spec §3 and §5.1, and this plan. Fix findings (at most 2 rounds), then re-review only those findings.
- [ ] Update `docs/plans/PROGRESS.md`: "## Current" (at most 12 lines: phase 3 done, gate evidence, next is Phase 4) and the Log, plus decisions 1–9 under "Decisions and deviations". Commit the docs. Merge and push are the owner's call.
