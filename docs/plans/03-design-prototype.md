# Phase 2 — Design System and Full Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every screen in the product-spec inventory runs as a real Next.js route on a fake data layer, in every state, on phone and desktop, passes the self-checking design loop (D1–D7), and is locked by visual baselines. No backend.

**Architecture:** Pages are Server Components that call `getData()` (`src/data`), which returns the **fake** implementation of the service contracts when `ROOFY_DATA=fake`. The fake keeps one in-memory store per demo session (cookie), seeded deterministically, and computes every figure with `src/domain` — no money maths anywhere else. Field entries post to a fake `POST /api/sync/push` with the architecture §7 mutation shape (client UUIDv7, applied/rejected/retry) so Phase 5 only swaps the transport and the server. Admin forms use Server Functions against the same contracts. Design states (empty, loading, error, offline, waiting, needs attention, no permission) are forced in fake mode with `?demo=<state>`; the role is switched with the prototype role cookie.

**Tech Stack:** Next.js 16.3 App Router, React 19, Tailwind CSS 4 (tokens via `@theme`), Radix primitives (shadcn-style, owned code), vaul, @phosphor-icons/react, self-hosted fonts via `next/font/local` (Barlow Semi Condensed, Atkinson Hyperlegible Next from @fontsource), zod 4, uuid v7, Vitest 5 + Testing Library (jsdom) for components, Playwright 1.63 + axe-core.

**Spec:** `docs/specs/04-design-process.md` (all), `docs/design/DESIGN.md` (all), `docs/specs/01-product-spec.md` §3–§6, `docs/specs/03-architecture.md` §3, §4, §7 (shapes only), `docs/specs/02-pay-rules.md` (for the fake layer's figures, via `src/domain`).

## Global Constraints

- Tokens, fonts and components only from DESIGN.md; `pnpm lint:design` clean; raw colours only in `src/app/tokens.css`.
- Money is integer cents in data; formatted only by `src/lib/format.ts`. The fake layer computes money only by calling `src/domain` functions.
- Foreman-shaped data (DTOs, pages, JSON, errors) never contains rates, amounts, budgets, margins or balances — enforced by type (separate DTO types) and by a key-scan test.
- `src/components` and `src/offline` never import `@/server/*` or `@/data/fake/*` (lint). Components receive data as props.
- Work dates come from `todayIn(workspace.timezone, now)`; the fake clock is fixed at `2026-09-27T21:00:00Z` (Mon 28 Sep 2026, 7:00 a.m. Sydney) unless `ROOFY_FAKE_NOW` overrides it. Never use the server's local date.
- Touch targets ≥ 48 px on phone, WCAG 2.1 AA, key figures AAA; safe areas; no horizontal overflow at 390/412/1440 or at 200% text zoom.
- Copy: plain words, sentence case, verbs on buttons; none of the DESIGN.md §7 jargon ("entity", "sync", "mutation", "record", "submit") in UI text.
- TDD: failing test first for scripts, data layer and components with logic; screens are proven by e2e + the design loop.

## Review Focus

1. **Foreman money leakage** — no foreman page HTML, RSC payload or JSON contains money keys or `$` figures. Pinned by the Task 5 DTO key scan and the Task 21 foreman e2e HTML scan.
2. **Figures come from the domain** — every dollar on screen equals the domain function's result for the seeded data (Home, Job detail, Pay run review spot checks in Task 6 tests).
3. **Work date in the workspace timezone** — the Log grid defaults to Mon 28 Sep 2026 with the fake clock at 2026-09-27T21:00Z (Sunday in UTC). Pinned in Task 6 and Task 13 e2e.
4. **Same entry twice** — the fake push handler applies a mutation id once and returns the stored result on repeat. Pinned in Task 7.
5. **Design loop honesty** — critics only see screenshots + DESIGN.md + flows + spec + atlas, never the builder's notes; scores and issues are recorded verbatim in `docs/design/loop/`.

---

## File map

| Path                                                                              | Responsibility                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `docs/design/brief.md`                                                            | D1 brief: users, context, tone, UX targets                          |
| `docs/design/flows.md`                                                            | D4 flows: numbered steps per core job, tap budgets, offline, errors |
| `docs/design/loop/ISSUES.md`, `DECISIONS.md`, `SCORES.md`                         | Design-loop records                                                 |
| `src/app/tokens.css`                                                              | Colour tokens light/dark (generated from DESIGN.md)                 |
| `src/app/globals.css`                                                             | Tailwind 4 `@theme` mapping tokens, type scale, spacing, radii      |
| `src/app/fonts.ts` + `src/app/fonts/*.woff2`                                      | Self-hosted fonts                                                   |
| `src/components/ui/*`                                                             | Primitives (Button, Input, Stepper, Sheet, …)                       |
| `src/components/*`                                                                | App components (CrewDayGrid, TapeBar, MoneyCell, NavBar, …)         |
| `src/app/design/page.tsx`                                                         | Component gallery × states × light/dark                             |
| `src/data/contracts.ts`                                                           | Service interfaces + DTO types (role-shaped)                        |
| `src/data/index.ts`                                                               | `getData()` → implementation by `ROOFY_DATA`                        |
| `src/data/fake/*`                                                                 | Seed, store, fake services, demo states                             |
| `src/app/api/sync/push/route.ts`                                                  | Fake push endpoint (fake mode only)                                 |
| `src/offline/submit.ts`                                                           | Client-side field-entry submit (mutation shape)                     |
| `src/app/**`                                                                      | Every screen route                                                  |
| `scripts/gen-tokens.ts`, `scripts/check-contrast.ts`, `scripts/design-capture.ts` | Design tooling                                                      |
| `tests/e2e/guards.ts`                                                             | Layout guards: overflow, target size, axe, console, DOM contrast    |
| `tests/e2e/*.spec.ts`                                                             | Screen, flow and tap-budget tests                                   |
| `tests/visual/*.spec.ts` + snapshots                                              | D7 baselines                                                        |
| `.claude/agents/design-critic.md`, `.claude/agents/field-critic.md`               | Critic agents                                                       |

## Model choice per task

opus: Tasks 5, 6, 7 (data contracts, foreman DTO hiding, domain-derived figures, idempotent push, timezone), design critics, spec reviews, the final phase review. sonnet: everything else. A sonnet task that fails review twice is redone on opus.

---

### Task 1: Tooling debt from Phase 0/1 (open issues)

**Files:** `scripts/lint-design.ts`, `scripts/lint-design.test.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `vitest.config.mts`, `eslint.config.mjs`, `package.json`.

- [x] Design lint gaps (tests first, one per gap): bare `bg-radial`/`bg-conic` (no dash suffix); `tracking-[2px]` and any `tracking-[…px|rem|em]` other than `tracking-[0]`, plus `tracking-tight`/`tighter` allowed but `wide*` banned (existing); CSS `letter-spacing` in px/rem/em (non-zero); banned fonts matched case-insensitively incl. `geist`, `GeistSans`, `from "geist/font/…"`; no false positive on `href="#faded"` (raw-colour regex must require a colour context: `#` preceded by start, whitespace, `:`, `(`, `,`, `"`/`'` followed by exactly 3, 4, 6 or 8 hex digits and a non-word boundary, and not inside `href="#`); raw-colour exemption is the exact path `src/app/tokens.css`.
- [x] New rules: `shadow-*` on level-1 surfaces is out of scope for a line lint — instead ban any Tailwind `shadow-` class except `shadow-sheet` and `shadow-toast` (the two DESIGN.md §6 elevations); ban `animate-pulse`/`animate-shimmer` (no shimmer); ban `font-mono` (§7 monospace); ban hard-coded px outside the spacing scale in Tailwind arbitrary values (`p-[13px]` etc.; allowed px: 1, 1.5, 2, 3, 4, 8, 12, 16, 20, 24, 32, 40, 48, 52, 56, 64, 240) and jargon words in JSX text (`\b(entity|mutation|submit|sync)\b` inside `>…<` text or `aria-label`/`label`/`title` string props, case-insensitive).
- [x] Playwright: `reuseExistingServer: process.env.ROOFY_REUSE_SERVER === "1"` (default off, so a stale server is never reused silently); `webServer.env` passes `ROOFY_DATA=fake`; `iphone` project uses WebKit unless `ROOFY_NO_WEBKIT=1`, in which case it runs Chromium with the same iPhone device descriptor (explicit opt-in for containers without WebKit; logged as a deviation when used).
- [x] axe scoped to `withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"])` in a shared helper.
- [x] Vitest: include `src/**/*.test.{ts,tsx}`, `scripts/**/*.test.ts`, `tests/unit/**/*.test.{ts,tsx}`; `environmentMatchGlobs`/per-file `// @vitest-environment jsdom` for `.tsx` tests; add `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.
- [x] ESLint boundaries: `src/components/**` and `src/offline/**` may not import `@/data/fake/*`; `src/data/**` may not import `@/server/*`.
- [x] Verify: `pnpm verify` green; `pnpm test:e2e` green.

### Task 2: Tokens, fonts, theme and contrast (D3 foundation)

**Files:** `scripts/gen-tokens.ts` (+ test), `src/app/tokens.css`, `src/app/globals.css`, `src/app/fonts.ts`, `src/app/fonts/*.woff2`, `scripts/check-contrast.ts` (+ test), `package.json` (`tokens:gen`, `lint:contrast`; add `lint:contrast` to `verify`).

- [x] `gen-tokens.ts` parses DESIGN.md §2 light and dark tables into CSS custom properties (`--galv`, `--surface`, `--ink`, `--ink-2`, `--line`, `--edge`, `--chalk`, `--chalk-link` (dark `#8FB0FF`, light = chalk), `--tape`, `--over`, `--watch`, `--good`, plus `--on-chalk` white, `--on-tape` ink/galv). Light on `:root`; dark under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])` and under `:root[data-theme="dark"]`. Test: generator output equals the committed `tokens.css` (a drift check that runs in `verify`).
- [x] Elevation tokens (`--shadow-sheet`, `--shadow-toast`) from §6 (light only; dark has none).
- [x] `globals.css`: Tailwind 4 `@theme` maps colours (`bg-galv`, `text-ink`, …), fonts (`font-display` Barlow SC, `font-body` Atkinson), type scale utilities (`text-figure-xl`, `text-title`, `text-heading`, `text-figure`, `text-body`, `text-body-strong`, `text-meta` with phone→desktop sizes at ≥ 1024), radii (`rounded-control` 10, `rounded-group` 12, `rounded-sheet` 16), shadows (`shadow-sheet`, `shadow-toast`), spacing is Tailwind's 4 px grid restricted by the lint; `tabular-nums` helper; `prefers-reduced-motion` zeroes transitions.
- [x] Fonts: copy latin woff2 files for Barlow Semi Condensed 500/600/700 and Atkinson Hyperlegible Next 400/600 from `@fontsource/*` into `src/app/fonts/`; `next/font/local` with CSS variables; `adjustFontFallback` on. Verify `tnum` in both (e2e: computed `font-variant-numeric` on a money cell).
- [x] `check-contrast.ts`: computes WCAG ratios for every pair declared in DESIGN.md §2 (light + dark) from `tokens.css`; fails if any is below its role threshold (text 4.5, large/figure-xl 3.0 — but key figures must hit 7.0, UI borders 3.0). Unit tests for the ratio maths (known pairs: `#FFFFFF`/`#000000` = 21, DESIGN.md's `ink` on `galv` ≈ 11.3).
- [x] Verify: `pnpm verify` green; `pnpm lint:contrast` prints each pair.

### Task 3: D1 brief and D4 flows

**Files:** `docs/design/brief.md`, `docs/design/flows.md`.

- [x] `brief.md`: users (owner/manager at 7 a.m. in the ute; foreman on the roof in glare with gloves; accountant at a desk), context (sun, gloves, one hand, patchy signal, installed PWA), tone (DESIGN.md §1), and **UX targets** as a numbered, testable list, each with a budget: log a full crew-day ≤ 6 taps and < 30 s; same-as-yesterday ≤ 3 taps; progress 120 m² split two ways ≤ 8 taps; pause a stage for rain ≤ 4 taps; add a receipt paid by a crew member ≤ 10 taps (excluding typing); find the job losing money and why ≤ 3 taps from Home; review and approve a pay run ≤ 5 taps; record a payout ≤ 6 taps; first project with first log in < 10 min (onboarding ≤ 25 taps excluding typing).
- [x] `flows.md`: one section per core job (the targets above + onboarding, no-work marker, stage done with lump sum, expense edit, outbox needs attention, statement share, reports drill-down, settings changes): numbered steps with the exact control tapped, tap count, what shows offline, error cases and copy. Each flow names its tap-budget test (`tests/e2e/flows/<name>.spec.ts`).
- [x] Gate: a fresh critic subagent (sonnet) reads brief + product spec §1–§6 and reports contradictions; fix until none.

### Task 4: Design-loop tooling

**Files:** `scripts/design-capture.ts`, `tests/e2e/guards.ts` (+ `tests/e2e/guards.spec.ts` self-test page), `.claude/agents/design-critic.md`, `.claude/agents/field-critic.md`, `docs/design/loop/{ISSUES,DECISIONS,SCORES}.md`, `docs/design/atlas.md`, `package.json` (`design:capture`).

- [x] `guards.ts` exports `expectScreenHealthy(page, { phone })`: no horizontal overflow (`scrollWidth ≤ clientWidth`), every visible interactive element ≥ 48×48 on phone (checks bounding box incl. padding; inline text links inside paragraphs excepted), axe (WCAG 2.1 AA tags) no serious/critical, zero console errors/warnings collected since navigation, DOM contrast of every visible text node against its effective background ≥ 4.5 (≥ 3 for ≥ 24 px or ≥ 18.66 px bold), nothing interactive under the safe-area insets (simulated 47 px top / 34 px bottom in standalone mode capture), 200% text zoom (`html { font-size: 200% }` injected) keeps no horizontal overflow.
- [x] `design-capture.ts <group>`: reads a screen-group manifest (`tests/e2e/screens.ts`: route, states, roles, groups) and writes PNGs `docs/design/loop/shots/<group>/<screen>-<state>-<role>-<viewport>-<scheme>.png` for iPhone 390×844, Android 412×915, desktop 1440×900 × light/dark, plus an installed-mode (standalone, safe-area) iPhone shot. Shots dir is git-ignored; approved baselines live in `tests/visual/`.
- [x] Critic agents (model opus, tools Read/Glob/Grep only): inputs = screenshot folder, DESIGN.md, flows.md, product spec §5–§6, atlas, rubric (04-design-process §3). Output format fixed: per-criterion score, total /100, issues table `id | severity P0–P3 | screen/state/viewport | problem | fix`. Design critic = senior product designer lens; field critic = manager at 7 a.m. in a ute + foreman on a roof in glare with gloves. They never receive builder notes.
- [x] `atlas.md`: the §4 reference atlas as written guidance (what "at least this clear" means per benchmark for money, lists, sheets, tab bars, quick entry).
- [x] Verify: guards self-test (a fixture page with a deliberate 40 px button and overflow) fails as expected and passes on the fixed version.

### Task 5: Data contracts and deterministic seed (opus)

**Files:** `src/data/contracts.ts`, `src/data/dto.ts`, `src/data/fake/seed.ts`, `src/data/fake/rng.ts`, `src/data/fake/clock.ts`, tests `src/data/fake/seed.test.ts`, `src/data/dto.test.ts`.

- [ ] `Actor = { userId; workspaceId; role: "owner"|"manager"|"foreman"|"accountant"; name }`.
- [ ] One interface per area, every method takes `actor` first: `WorkspaceService` (settings, levels, categories, templates, members, assignments), `ProjectService` (list, get, create, update, clients), `StageService` (get, start, pause, resume, done proposal, confirm done, reopen, set manual %), `CrewService` (list, get, create, update, rates, set rate), `LogService` (crew-day defaults, same-as-yesterday, list by day/person/stage), `ProgressService`, `NoWorkService`, `ExpenseService`, `PayRunService` (list, draft/get, approve, reopen, export CSV, statement), `LedgerService` (balances, entries, record payout), `ReportService` (five reports with date range), `HomeService` (manager home, foreman home), `SyncService` (push results shape, snapshot), `AuditService` (history), `ExportService` (workspace export listing). Types use `src/domain/types`.
- [ ] **Role-shaped DTOs:** every read that a foreman can reach returns a union by role, e.g. `ProjectDetail = ProjectDetailManager | ProjectDetailForeman`; foreman types are declared without any money field. `dto.test.ts`: recursive key scan of every foreman DTO returned by the fake for every foreman-reachable method fails on keys matching `/rate|amount|cents|budget|margin|balance|cost|earn|pay|total|gst/i` and on string values matching `/\$\s?\d/`.
- [ ] Seed (seeded PRNG, fixed clock): workspace "Harbour Roofing" (GST registered, Australia/Sydney, weekly Mon, Mon–Fri, 8.0 h, on-cost 25%); levels with floor rates; the pay-rules example crew (Sam, Tom, Jake, Dima, Lee) plus 7 more (12 total; mix of employees/contractors, one inactive); rates with history and one project override; 5 active jobs (incl. "Smith job — Ryde re-roof", sheet install 400 m² at 30% and trending over by $775.00 as in E12.1), 2 on hold/complete, plus 2 years of completed jobs; stages from the §5.3 templates with segments incl. pauses (weather, materials); daily grid logs, progress entries with splits, lump-sum stage done, no-work markers, a few gaps last week, expenses (one paid by a crew member), approved pay runs for 2 years with ledger credits/payouts, the current week's draft, one person unpaid too long, one below-floor employee, one double-pay flag, one missing rate. Test: seed is deterministic (same hash twice), 12 crew, 5 active, ≥ 2 years of logs, E12.1 figures reproduced through the domain.
- [ ] Verify: `pnpm verify` green.

### Task 6: Fake services (read side) (opus)

**Files:** `src/data/fake/store.ts`, `src/data/fake/services/*.ts`, `src/data/fake/demo.ts`, `src/data/index.ts`, `src/data/session.ts`, tests beside each.

- [ ] `FakeStore` = cloned seed + mutation log; `getData()` returns fake services bound to the store for the current demo session (cookie `roofy_demo`, random id; stores kept in a bounded LRU of 50; absent cookie → shared read-only seed store).
- [ ] Every figure via `src/domain` (costing, progress, forecasts, alerts, margins, payrun builder, floor, flags, attendance, ledger, periods, segments). Tests assert Home and Job detail figures equal direct domain calls on the seed, and Home "Needs attention" is ordered most severe first, max 7.
- [ ] `demo.ts`: `?demo=` states for fake mode — `empty` (new workspace with nothing), `loading` (page renders its skeleton via a never-resolving Suspense child), `error` (service throws a typed `DataError` shown by the route's `error.tsx`), `offline` (banner shown), `waiting` (outbox has 3 waiting items), `attention` (1 rejected item), `noperm` (role lacks permission). Read only in fake mode; ignored otherwise.
- [ ] Role: cookie `roofy_role` (owner/manager/foreman/accountant; default manager), set by `GET /prototype/role?as=…` (fake mode only, 404 otherwise). Foreman actor is assigned to 2 of the 5 active jobs.
- [ ] Today: `todayIn("Australia/Sydney", fakeNow())` = `2026-09-28` at the default clock (test).
- [ ] Runtime foreman scan (from Task 5 review): `dto.test.ts` calls `expectNoMoney` on the fake's result of every foreman-reachable method (all `view: "foreman"` reads) for the seeded data and every `?demo=` state.
- [ ] Verify: `pnpm verify` green.

### Task 7: Fake writes and the push shape (opus)

**Files:** `src/data/mutations.ts` (zod schemas: `crew_day`, `progress`, `no_work`, `stage_pause`, `stage_resume`, `expense`), `src/app/api/sync/push/route.ts`, `src/offline/submit.ts`, `src/data/fake/services/*` (write methods), `src/app/**/actions.ts` (Server Functions for admin writes), tests.

- [ ] Mutation envelope `{ id: uuidv7, type, schemaVersion: 1, appVersion, createdAt, payload }`; push request ≤ 25 mutations; response per id: `{ status: "applied", result }` · `{ status: "rejected", code, message }` · `{ status: "retry" }`. Repeat id → stored result, no second apply (test). Business warnings (paused stage, late entry, possible duplicate) → applied with `flags`, never rejected (test). Foreman posting to an unassigned project → rejected `forbidden` with money-free message (test).
- [ ] `submit.ts` (client): builds the envelope (uuid v7), POSTs, returns the per-mutation result; no retries/durability in Phase 2 (Phase 5 replaces it with the Dexie outbox). Lint keeps it free of `@/server` and `@/data/fake`.
- [ ] Foreman push results never reveal pay facts: strip `missing_rate` (and any other pay-only flag) from `EntryResult.flags` for foreman actors (from Task 5 review); test.
- [ ] Crew-day writes compute amounts via `resolveRate` + `hourlyAmount`/`dailyAmount`/time-only; progress via `pieceRateLines`; stage done via `lumpSumLines`; auto-start of a Not started stage on first log; logs on Paused/Done stages flagged.
- [ ] Admin Server Functions (projects, stages done/reopen, crew, rates, settings, pay run approve/reopen/export, payouts) validate with zod and call the fake services; foreman calls to money actions → typed `forbidden`.
- [ ] Verify: `pnpm verify` green.

### Task 8: UI primitives and the /design page (D3)

**Files:** `src/components/ui/{button,input,field,stepper,select,segmented,checkbox,sheet,dialog,toast,skeleton,status-chip,list,money-cell,icon}.tsx`, `src/components/{tape-bar,crew-chip,needs-attention-item,empty-state,outbox-badge,offline-banner}.tsx`, `src/app/design/page.tsx`, tests `*.test.tsx`.

- [ ] Each primitive exactly per DESIGN.md §4 (sizes, radii, borders, focus ring 3 px chalk outside, error state with fix message, disabled state). Sheet = vaul on phone (< 1024) and Radix Dialog on desktop, same content; primary action pinned above the home bar.
- [ ] TapeBar: 12 px track, 1 px ink outline, tape fill, ticks every 10% (taller at 50%), % printed beside, optional over marker at forecast point; `role="progressbar"` with `aria-valuenow`.
- [ ] Component tests (jsdom): Stepper steps (hours 0.25, days 1/½) and bounds; CrewChip toggles `aria-pressed`; MoneyCell renders `formatMoney` with true minus; StatusChip always renders icon + word; Sheet traps focus and restores it.
- [ ] `/design` shows every component × state (default, hover-free focus, pressed, disabled, error, loading) in light and dark side by side (`data-theme` wrappers).
- [ ] Design loop on `/design` (group "system"): capture, guards, contrast, both critics ≥ 90, no P0/P1 (≤ 6 iterations).

### Task 9: App shell, navigation and PWA

**Files:** `src/app/(app)/layout.tsx`, `src/components/nav/{tab-bar,sidebar,top-bar}.tsx`, `src/app/manifest.ts`, `src/app/icon*.png`/`apple-icon.png` (generated from an SVG mark by `scripts/gen-icons.ts` using Playwright rendering), `src/app/(app)/more/page.tsx`, theme override in settings (`data-theme` cookie), `viewport` export (`themeColor` galv per scheme, `viewportFit: "cover"`), tests.

- [ ] Phone: bottom tab bar Home · Jobs · **Log** (raised chalk circle) · Crew · More; foreman: Log · Jobs · Outbox; accountant: Home · Pay · Reports · More. Desktop ≥ 1024: 240 px sidebar, same items. Active tab uses Phosphor Fill.
- [ ] Offline banner and outbox badge slots in the layout (driven by demo state now, by the outbox in Phase 5).
- [ ] Manifest: name Roofy, `display: standalone`, `start_url: "/"`, `background_color`/`theme_color` galv, icons 192/512 + maskable, `apple-touch-icon`; `appleWebApp` metadata (capable, status bar style default).
- [ ] Safe areas: layout pads with `env(safe-area-inset-*)`; tab bar sits above the home indicator.
- [ ] e2e: manifest served and valid; standalone capture on iPhone shows nothing under the insets; tab bar targets ≥ 48 px.

### Task 10: D2 — prove the direction (A/B)

**Files:** `src/app/design/challenger/{home,log}/page.tsx` (temporary), challenger tokens under `[data-direction="challenger"]` in `tokens.css`, `docs/design/loop/DECISIONS.md`.

- [ ] Build Home (manager) and Log crew-day first in Galvanised (they are Task 12/13's screens — build them here to production quality), then a deliberately different challenger ("Docket": paper white, black ink, one signal-red accent, dense table-like rows, top-aligned actions) using the same components with challenger tokens.
- [ ] Capture both (phone + desktop, light), label A/B randomly, give both critics the pair blind; each picks a winner per rubric criterion with reasons.
- [ ] Galvanised must win; otherwise revise DESIGN.md and repeat. Record the outcome in DECISIONS.md, then delete the challenger code and tokens.

### Tasks 11–19: Screen groups (D5), each through the design loop

Each group task: build every screen × every state (normal, empty, loading, error, offline/waiting, no permission, foreman variant where the role can reach it) from flows.md; e2e per screen (renders, key content, guards on 3 viewports, foreman HTML money scan where reachable); tap-budget tests for its flows; then the design loop (capture → automated checks → both critics → fix, ≤ 6 iterations, ≥ 90 average, no P0/P1), recording scores in `SCORES.md` and issues in `ISSUES.md`.

- [ ] **Task 11 — Field (1/2): Home manager (4), Home foreman (5).** Needs attention (max 7, severity icon + sentence, tap-through), active jobs rows (stage, TapeBar %, labour vs budget, forecast margin, days since last log), last week, this pay period; foreman home = assigned jobs + "Log today" + outbox status, no dollars.
- [ ] **Task 12 — Field (2/2): Log crew-day grid (6), Progress entry (7), No-work marker (8), Outbox (24).** Grid: date (defaults to workspace today), project, stage, crew chips pre-ticked by same-as-yesterday, basis defaults, exceptions (½ day, hours stepper, overtime ×1.5/×2), per-unit workers noted as time-only, Save day → signature motion (≤ 400 ms, reduced-motion instant); desktop keyboard (arrows, space, Enter). Progress: quantity with decimal keypad, crew, equal/custom split summing to 100%, foreman sees no $. No-work: person(s), date, reason. Outbox: Waiting · Sending · Sent · Needs attention with Edit and resend / Discard. Tap budgets: crew-day ≤ 6, same as yesterday ≤ 3, progress split ≤ 8.
- [ ] **Task 13 — Jobs (1/2): Jobs list (9), New/edit job (10).** List with status filter; new job with client pick/quick-add, job type → stages pre-filled from last same-type job or template → Accept or Edit.
- [ ] **Task 14 — Jobs (2/2): Job detail (11), Stage detail (12), Stage done + lump-sum split (13).** Detail: stage list with chips and TapeBar, labour/materials budget vs actual, forecast margin, crew this week, recent logs, expenses, files; every figure taps through to source lines. Stage: Start/Pause (reason sheet)/Resume/Done, segments timeline, progress history, lost days. Done: completion date, note, photo, lump-sum equal split proposal editable to 100%. Tap budget: pause for rain ≤ 4.
- [ ] **Task 15 — Crew: Crew list (14), Crew member detail (15), Record payout (20).** Detail: rates with history and overrides, recent logs, balance with ledger entries, statements. Payout sheet: date, amount, Advance/Payment, method, note. Tap budget: record payout ≤ 6.
- [ ] **Task 16 — Expenses: list (16), add/edit (17).** Photo (camera/library input, preview), date, supplier, total with decimal keypad, GST default total ÷ 11 via `gstIncludedIn` or "No GST", project, stage, category, paid by (crew → reimbursement note). Tap budget: receipt paid by a crew member ≤ 10.
- [ ] **Task 17 — Pay: Pay runs list (18), Pay run review (19), Crew statement page (21).** Review: flags first (blocking vs warning), per-person groups (lines with basis, qty, hours, rate, amount; late/adjustment labels; contractor subtotal/GST/total; reimbursements), Approve (blocked by missing rate / Owner 2FA), Export CSV, Reopen. Statement: public page `/s/[token]` per pay-rules §16 incl. contractor footer, share button (Web Share API, copy link fallback). Tap budget: review → approve ≤ 5.
- [ ] **Task 18 — Reports (22) and Record history (25) and Workspace export (26).** Five reports with date range filter, phone summary cards, desktop tables, CSV/PDF export buttons (CSV built from fake data; PDF = a print-styled page printed with the browser, server PDFs arrive in Phase 7/8), drill-down to source lines. Tap budget: find the job losing money and why ≤ 3 from Home.
- [ ] **Task 19 — Entry and settings: Sign in/up (1), Onboarding wizard (2), Install guide (3), Settings (23: business, pay period & working days, on-cost, levels & floor rates, templates, expense categories, members & roles, foreman project assignments), More menu.** Onboarding tap budget ≤ 25 excluding typing; install guide detects iOS/Android/desktop.

### Task 20: Tap-budget and timing suite (D6)

**Files:** `tests/e2e/flows/*.spec.ts`, `tests/e2e/taps.ts`.

- [ ] `taps.ts` counts taps via a wrapper (`tap(locator)`), fails when a flow exceeds its budget from flows.md; crew-day flow also asserts < 30 s scripted wall time with a 500 ms human think-time per tap.
- [ ] Every flow in flows.md has a passing spec on iphone, android and desktop.

### Task 21: Foreman leakage sweep

- [ ] e2e as foreman visits every foreman-reachable route and every `?demo=` state; asserts the HTML (incl. inlined RSC payload) contains no `$` followed by a digit and no money keys from the Task 5 list; direct navigation to money routes (pay, crew detail rates, reports, settings money) shows the no-permission state with no figures.

### Task 22: Visual baselines (D7) and PWA verification

**Files:** `tests/visual/screens.spec.ts`, snapshot dirs, `playwright.config.ts` (visual project settings: animations disabled, fonts loaded, fixed clock).

- [ ] One screenshot per screen × state × viewport (light; dark for the core field screens and Home), taken from the approved design-loop state, committed.
- [ ] PWA: manifest + icons + standalone + safe areas verified in the WebKit (or Chromium fallback, recorded) standalone capture; Lighthouse-style installability checks via Chromium DevTools protocol (`Page.getInstallabilityErrors` returns none).

### Task 23: Phase gate

- [ ] `pnpm verify` green (paste output).
- [ ] `pnpm test:e2e` green on iphone, android, desktop (paste summary; note WebKit fallback if used).
- [ ] Every screen group: design loop passed (scores table in SCORES.md, no open P0/P1 in ISSUES.md).
- [ ] Exit line: tap budgets pass; baselines committed; PWA installs (manifest, icons, standalone, safe areas).
- [ ] `spec-reviewer` (opus) on `git diff master...HEAD` against this plan, 04-design-process, DESIGN.md, product spec §3–§6; fix and re-run until "No blocking issues".
- [ ] Update PROGRESS.md (Current, Log, Decisions and deviations, Gate evidence, Open issues with target phases); merge into master.
