# Progress

## Current

- Phase: 2 — Design system and full prototype. Branch `phase/2-design-prototype` (not merged to master). Plan: `docs/plans/03-design-prototype.md`.
- Session paused 2026-09-29 by the owner to continue on the VPS. The work was pushed to `origin/claude/funny-feynman-1r94tn`; it is the same commits as `phase/2-design-prototype`. On the VPS: `git fetch origin && git checkout -b phase/2-design-prototype origin/claude/funny-feynman-1r94tn`.
- Done and reviewed: Tasks 1, 2, 3, 4, 5, 6.
- **Task 7 (fake writes and push): implemented (88b97b1…85317cb), `pnpm verify` green, e2e green, but its opus spec review was cut off by a usage limit. Next step: run `spec-reviewer` on it.** The review must decide one open question: adding a rate re-prices unapproved $0.00 missing-rate logs. Check that against pay rules §1 (snapshot) and step 3 ("fixed or waived").
- **Task 8 (primitives and `/design`): built and merged; the system design loop is in progress.**
  - Iteration 1: 72 / 69. Iteration 2: 75 / 70. Iteration 3: 90 / 87 (average 88.5, one P1: payout method unselected).
  - The iteration 4 fixes are merged (ea29b95 via 456b784) but not yet captured or scored.
  - Next step: `pnpm build && pnpm start` (ROOFY_DATA=fake), then `pnpm design:capture system`, then run the `design-critic` and `field-critic` agents on `docs/design/loop/shots/system/slices/`. Record the results in `docs/design/loop/SCORES.md` and `ISSUES.md`. Cap: 6 iterations.
- **Task 9 (app shell and PWA): partial (446bef6).** Done: icons (`scripts/gen-icons.ts`, `scripts/icon.svg`, PNGs), theme cookie action and helpers, manifest colours read from tokens.css (`src/app/theme-colors.ts`), nav active-item mapping (`src/components/shell/active.ts`). Not done: `(app)` route-group layout with TabBar/Sidebar, offline banner and outbox badge slots, `/more`, placeholder pages for every nav target, `manifest.ts`, viewport, `error.tsx`/`not-found.tsx`/no-permission, and the `shell.spec.ts` e2e. Resume from the Task 9 text in the plan.
- Then: Task 10 (D2 A/B) onward.
- Environment notes from the cloud session:
  - WebKit could not be installed, so the iphone project ran on Chromium via `ROOFY_NO_WEBKIT=1`. The cached Chromium revision differed from what Playwright expects, so runs also needed `ROOFY_CHROMIUM_EXECUTABLE`. On the VPS use real WebKit and re-run e2e and the captures.
  - The critics flagged the Chromium iPhone captures (issue `system/D9+F13`).

## Log

- 2026-09-28 — Specs, DESIGN.md, master plan, Phase 0/1 plans written.
- 2026-09-28 — Phase 0 shipped: Next.js scaffold (strict TS ~6.0.3), import-boundary lint (`src/domain` pure, `src/components`/`src/offline` barred from `src/server`), Vitest 5 unit tests, dev Postgres (Docker Compose), Playwright with 3 projects (iphone/android/desktop), design lint enforcing DESIGN.md anti-patterns, Claude Code harness (CLAUDE.md, hooks, spec reviewer, progress log), and a git pre-commit gate (typecheck + unit tests).
- 2026-09-28 — Phase 1 shipped: pure domain core in `src/domain/` (money, split, rates, lines, piece, gst, costing, dates, segments, progress, floor, adjustments, flags, attendance, periods, payrun, ledger) plus `src/lib/format.ts`. Every pay-rules example (E1.1–E15.1) is a named test and matches to the cent; `scripts/check-examples.ts` proves none is missing; `verify` now runs coverage (100% on `src/domain`) and `check:examples`.

- 2026-09-28/29 — Phase 2 in progress (cloud session): plan written; Tasks 1–6 shipped and reviewed; Task 7 implemented (review pending); Task 8 through design-loop iteration 3 (+ iteration 4 fixes); Task 9 partial. See Current.

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
- Phase 2 Task 7: admin Server Functions live in `src/app/actions/{projects,stages,crew,pay,records,settings}.ts` (no route groups yet) over one runner (`run.ts`: zod per argument → `getWriteData()` → `revalidatePath` of the affected screen groups as `layout` patterns → `ActionResult`). Unexpected errors → `unavailable` "Couldn't save this. Try again.".
- Phase 2 Task 7: foremen never get `missing_rate` or `late_entry` in an `EntryResult` (whether a day's pay run is approved is a pay fact). `FOREMAN_HIDDEN_FLAGS` in contracts.
- Phase 2 Task 7: push stores only applied results (`clientMutations`); a rejected id can be edited and resent with the same id. A repeat id from another user is rejected `conflict`, not replayed. Unexpected errors and `DataError("unavailable")` → `retry`. The push route ignores `?demo=` and always writes to the browser's own session store (setting `roofy_demo` on the response when missing).
- Phase 2 Task 7: a crew-day row's basis is the one sent (the grid defaults it with `gridBasisFor`; switching someone to time-only is allowed); daily rows with hours 0 get days × standard day. Pause on a Paused stage / resume on an Active one is applied with no change (`ids: []`); pause date must be after the open segment's start, resume date on/after the pause date. A second no-work marker for the same person and day replaces reason and note; someone already logged that day is refused (`conflict`).
- Phase 2 Task 7: `ExpenseInput.gstCents` is nullable (null = total ÷ 11 via `splitReceipt`; 0 = No GST). Editing a total without a GST keeps "No GST" if it had none, else re-defaults.
- Phase 2 Task 7: `setRate` with the same (person, basis, unit, job, start date) replaces that rate's amount (no twins); a new rate re-prices unlocked $0.00 missing-rate logs it now covers — that is how a missing rate is "fixed" before approval (pay rules §9) Only original logs are re-priced, never adjustments (an adjustment on a line approved at $0.00 with the waiver keeps $0.00, like its locked original).
- Phase 2 Task 7 (review fix): `FakeStore.write` is all or nothing — it saves a shallow copy of every object under the tables first (~20 ms) and puts them back if the change throws. The seed build-time guard measures the test thread's CPU time (`process.threadCpuUsage`), budget 500 ms, so parallel test files and V8 coverage under `pnpm verify` don't decide it.
- Phase 2 Task 7: approve takes the oldest draft first, dates ledger credits on the workspace's today, audits a missing-rate waiver on the pay-run audit row, and opens the next period's draft if none exists. Pay-run CSV: one row per line and reimbursement plus a per-person "Total" row (subtotal, GST, total); an accountant's export also marks it Exported.
- Phase 2 Task 7: reopening a Done stage reopens the segment Done closed (Active), or leaves it Paused if it was paused when marked Done; locked lump-sum logs are reversed once. `editLog`/`deleteLog` refuse progress and lump-sum lines (change the entry / reopen the stage) and adjustments can't be edited. Stage-done photos aren't stored and progress/receipt photo ids aren't checked (no uploads in Phase 2).
- Phase 2 Task 7: `FakeStore.nextInstant` keeps write order under the fixed fake clock; the LRU store test has a 30 s timeout (51 seed clones in a busier parallel suite).

- Phase 2: Playwright `iphone` project can run on Chromium via `ROOFY_NO_WEBKIT=1` (opt-in, containers without WebKit); `ROOFY_CHROMIUM_EXECUTABLE` overrides the Chromium binary (opt-in). Both unused on a normal install.
- Phase 2: type scale in rem (text zoom scales it); design-capture writes viewport slices so critics can read long pages.
- Phase 2: DESIGN.md §7 jargon rule clarified — "record" is banned as a noun for data; "Record payout"/"Record history" are fine.
- Phase 2: flows.md aligned with the seed (last logged Smith day Fri 25 Sep with Sam and Dima; progress flow uses a one-tap recent-stage chip, 7 taps).

## Gate evidence

- Phase 1: `pnpm verify` exits 0 — 21 test files, 122 tests; coverage 100% statements 283/283, branches 203/203, functions 120/120, lines 210/210; "Every pay-rules example has a named test." `pnpm test:e2e` 3/3. Whole-branch review + phase spec review (opus): every example hand-checked to the cent; every rule in §0–§16 has code or a later-phase owner; its fixes applied and re-reviewed.
- Phase 0: `pnpm verify` exits 0 (12 unit tests passing).
- `pnpm test:e2e` 3/3 (iphone, android, desktop).
- Stop hook (`scripts/hooks/stop-check.mjs`) blocks on a type error (exit 2) and exits 0 when `stop_hook_active` is set.

## Open issues (carried forward)

- Phase 7: editing an expense already reimbursed in an approved pay run keeps the old reimbursement — the difference isn't carried to a later run yet (flows "Expense edit" promises it will).
- Phase 7: changing pay frequency or start day leaves existing draft pay-run rows on their old periods.
- Phase 5: photo/receipt file ids on field entries are stored unchecked (no upload yet); the fake push's idempotency record isn't atomic with the apply across an `await` (the real push uses one transaction).
- Phase 2 (screens): `src/app/actions/*` are only compiled by `next build` once a page imports them (typecheck and unit tests cover them until then).
- Phase 4: add a unique DB constraint on rates (crew member, basis, unit, project, effective_from) — `resolveRate` picks the first of two rates with the same date.
- Phase 7: `buildPayRun` includes every unlocked log dated ≤ period end; only build the next draft once every earlier run is approved (else logs appear in two drafts). Consider a "no hours" warning when an employee's net hours are ≤ 0 (reversal-only run).
- Phase 7: a pay-run credit can be negative (reversal-only period); ledger maths handles it.
- No target phase: lint rule for bare `new Date()`/`Date.now()` in `src/domain` (currently followed, not enforced); `formatDate` does not validate its input.
- Phase 2 Task 1: design lint gaps — bare `bg-radial`/`bg-conic`, `tracking-[2px]`, px/rem `letter-spacing`, case-insensitive `geist`/`GeistSans`/`from "geist/font/…"`, `href="#faded"` false positive, raw-colour exemption must be exact path `src/app/tokens.css`; unused `--surface` token replaced by real tokens.
- Phase 2: Playwright `reuseExistingServer` stale-server risk; axe scoped to WCAG 2.1 AA tags; vitest `include` widened to `*.test.tsx`.
- Phase 3: vitest `include` widened to `tests/integration/**`.
- Phase 9: CI gating of `reuseExistingServer`; dev compose password comment.
- No target phase: stop-check treats git-quoted paths as code (fails safe, acceptable); stop-check throws outside a git repo.
