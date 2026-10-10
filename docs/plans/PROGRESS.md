# Progress

## Current

- Phase: 2 — Design system and full prototype. Branch `phase/2-design-prototype` (local on the VPS, not pushed, not merged). Plan: `docs/plans/03-design-prototype.md`.
- Ledger: `.superpowers/sdd/03-design-prototype/progress.md` (per-run lines; read its tail for where a task stands).
- Done and reviewed: Tasks 1–15 (Task 15 = 60f8f5d..063b072, crew design loop accepted by the owner at iteration 2, avg 83.5; open P3 rows in ISSUES.md; task e2e 3 projects at 063b072: 122 pass, 0 fail).
- **Now: Task 16** (Expenses list 16, add/edit 17), plan line 176. Brief `.superpowers/sdd/03-design-prototype/task-16-brief.md`. Done: run A list (b57722b), run B Add expense + add-receipt flow (cfb6c73, c72eebe). Budget used: 4 runs / 136 tool uses of 28 / 800.
- **Next:** dispatch run C (opus, cap 30; brief "Runs → C": `/expenses/[id]` edit, approved-pay-run warning, history link, expense-edit flow ≤ 6 taps, states, e2e; also make the reimbursement wording match flows.md 186 "Paid by Dima — reimbursed next pay run" on both the row and the form — see `task-16-run-b2-report.md`). Report `task-16-run-c-report.md`. Then reviewer + spec-reviewer on 1003c57..HEAD, then design loop `expenses`. Rerun verify before the phase gate (one unit test flaked once under load).
- Then: Tasks 17–23 in order.
- Known flaky (iphone, passed on re-run): flows/no-work-marker.spec.ts:6, log-progress.spec.ts:135, design-page.spec.ts:45 on a cold server.
- Environment: real WebKit works on the VPS. Never stop the server with `pkill -f "next start"`; kill the PID from `ss -ltnp | grep 3100`.

### Run rules

`docs/plans/RUNBOOK.md` (2026-10-01) replaces the 2026-09-30 token budget rules 1–10 and keeps their substance: critics read slices only and split by lens, opus only where it earns it, focused e2e while iterating, short briefs by file, 3-iteration design-loop cap. New: step caps, conductor stays thin, changed-slices-only critics, capture by script.

## Log
- Detail moved out of Current on 2026-10-01 (so session start reads less):
  - Done and reviewed: Tasks 1–12.
    - Task 7: spec review (opus) settled the open question — re-pricing $0.00 missing-rate logs when a rate is added is spec-compliant (it is the only "fix" before approval). Fixed: re-pricing skipped adjustments (crash + half-saved rate), `FakeStore.write` is all-or-nothing, seed perf guard measures thread CPU time. Re-review clean.
    - Task 9: shell, nav, PWA manifest, placeholders for every nav target, error/not-found/no-permission. Review fixes: Workspace export Owner-only, tab bar side insets, theme colours generated at build time. Re-review clean.
  - Done and reviewed: Task 8 (2026-09-30). Loop stopped at the 6-iteration cap at 87/87 (0 P0/P1); owner accepted 87. Review fixes `797f9e8`.
  - Done and reviewed: Task 10 (2026-09-30). Home (manager) and Log crew-day built in Galvanised (`src/components/screens/`). D2 A/B round 1 was a split, so Galvanised was revised (pinned Save day in thumb reach, ink edges, radii 6/8/12); round 2 with a fresh blind mapping: Galvanised 83–72 (design) and 79–67 (field). Challenger deleted. See DECISIONS.md.
  - Done and reviewed: Task 11 (2026-10-01). Home manager + Home foreman in every state; foreman now has a Home at `/` (nav Home · Jobs · Log · Outbox); `tests/e2e/taps.ts` created. Design loop hit the 6-iteration cap at 82 (72.5 → 78 → 82 → 83 → 82 → 82); owner accepted 82 after one final unscored fix round (see DECISIONS.md). Open field-1 rows stay in ISSUES.md.
  - Done and reviewed: Task 12 (2026-10-01). Log crew-day states, Progress, No-work, Outbox; tap flows (crew-day 4/6, same as yesterday 3/3, progress 7/8, no-work 5/5, outbox 5/5). Design loop 70 → 77 → 80, accepted at 80 under the 3-iteration cap (token rule 10).

- 2026-09-28 — Specs, DESIGN.md, master plan, Phase 0/1 plans written.
- 2026-09-28 — Phase 0 shipped: Next.js scaffold (strict TS ~6.0.3), import-boundary lint (`src/domain` pure, `src/components`/`src/offline` barred from `src/server`), Vitest 5 unit tests, dev Postgres (Docker Compose), Playwright with 3 projects (iphone/android/desktop), design lint enforcing DESIGN.md anti-patterns, Claude Code harness (CLAUDE.md, hooks, spec reviewer, progress log), and a git pre-commit gate (typecheck + unit tests).
- 2026-09-28 — Phase 1 shipped: pure domain core in `src/domain/` (money, split, rates, lines, piece, gst, costing, dates, segments, progress, floor, adjustments, flags, attendance, periods, payrun, ledger) plus `src/lib/format.ts`. Every pay-rules example (E1.1–E15.1) is a named test and matches to the cent; `scripts/check-examples.ts` proves none is missing; `verify` now runs coverage (100% on `src/domain`) and `check:examples`.

- 2026-09-28/29 — Phase 2 in progress (cloud session): plan written; Tasks 1–6 shipped and reviewed; Task 7 implemented (review pending); Task 8 through design-loop iteration 3 (+ iteration 4 fixes); Task 9 partial.
- 2026-09-30 — Task 8 iteration 6 scored 87/87; loop stopped at the cap, owner accepted 87; Task 8 code review fixed. Task 10 done: Home + Log built, Galvanised won the blind A/B on its second round.
- 2026-10-01 — Task 12 done: Log/Progress/No-work/Outbox, accepted at 80 (new 3-iteration cap).
- 2026-10-01 — Task 11 done: Home manager + foreman, 6 design iterations (cap) + final fix, owner accepted 82.
- 2026-09-29/30 — Phase 2 on the VPS: Task 7 reviewed and fixed; Task 9 finished and reviewed; Task 8 loop iterations 4–5 scored (82, 87) and iteration 6 fixed + captured (critics cut off by the usage limit). Token budget rules added. See Current.

## Decisions and deviations

- Task 16 (2026-10-10): supplier is optional on Add expense — the receipt flow (flows.md 169–195, ≤ 10 taps) has no supplier step and the product spec does not require it.
- Task 14 (2026-10-08): a stage paused on the same day it was started by a log gets an empty segment, so that day's log is flagged `paused_stage` (pay rules §9 check, a warning, not a block). Kept as spec-valid under §13 half-open ranges; a test will pin it. Revisit if field feedback says a same-day rain pause should keep the day.
- Task 14: the forecast working line sits on stage detail, not behind tap 2, until the `/history?job=` list exists (Task 18).
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

- Phase 2 Task 9 decisions: owner and manager share the manager nav; a foreman opening Home is redirected to Log (no Home tab). (Superseded in Task 11: the foreman has a Home at `/`.) Access rules in `src/components/shell/access.ts` (spec §3): foreman gets jobs, log, outbox, expenses, install; accountant gets home, jobs, pay, reports, expenses, more, install; other pages show the no-permission state. Accountant More = Expenses, Install guide (Pay and Reports are tabs; settings, history, export are edit or admin).
- Phase 2 Task 9: `Button` and `List` links now `prefetch={false}` like the nav (aborted RSC prefetches log a WebKit console error on navigation). Page title template `%s | Roofy` lives in the `(app)` layout only (`/design` keeps "Design system"). Placeholder pages handle `?demo=noperm` and `?demo=error` via `PlaceholderPage`; screen tasks keep that pattern. Layout reads the workspace name through `data.workspace.settings` and falls back to "Roofy" if that throws.
- Phase 2 Task 9: `error.tsx` uses Next 16.3's `retry` prop. The root layout reads the theme cookie (whole app is dynamic, as the proxy already required). Left and right safe-area padding is on the content column only; the fixed tab bar pads bottom only.
- Phase 2 Task 9 (review fixes): Workspace export is Owner-only (spec §5.11): hidden from the manager's More and `/export` shows no-access to a manager; the owner shares the manager nav otherwise. Manifest has no `orientation`. Manifest and `theme-color` colours come from `src/app/theme-colors.json`, generated from tokens.css by `scripts/gen-theme-colors.ts` (part of `tokens:gen` / `tokens:check`), so nothing reads `src/` at run time. The tab bar pads left and right insets too.
- Phase 2 Task 9 (recorded for review): the desktop sidebar adds a "Manage" section for managers (Expenses, Pay runs, Reports, Settings) beyond the tab-bar items. `prefetch={false}` on Button, List and nav links (WebKit aborted-prefetch console errors); revisit in Phase 5. A foreman at `/` redirects to `/log`. (Superseded in Task 11.) Accountant More = Expenses + Install guide.
- Phase 2 Task 8 (loop): input values use Atkinson with tabular figures (DESIGN.md §3); Atkinson's slashed zero is accepted (i4-D6 won't fix). Pause sheet puts the optional note above the reason chips; a reason tap pauses (4 taps). New tokens `over-fill`, `bar`; `tablet: 600px` breakpoint for the 2-column crew grid (DESIGN.md §8); active desktop sidebar item is filled icon + galv background + ink edge bar (no chalk fill). Foreman tab bar is Jobs · Log · Outbox with Log centred. (Superseded in Task 11: Home · Jobs · Log · Outbox, Log raised in place.)

- Phase 2 Task 10: DESIGN.md radius hierarchy is now controls 6, groups 8, sheets 12, chips full; list groups have a 1 px `edge` outline; unticked check boxes and the date field use `ink`; long forms pin their primary action above the tab bar (Log's Save day), and the page pads its bottom by the bar's measured height.
- Phase 2 Task 10: Log never pre-ticks or saves someone with a no-work marker or already logged that day; "Same as yesterday" pointing at a Done stage leaves the stage unchosen. Home links to `/jobs/<id>`, `/crew/<id>`, `/pay/<id>` before those routes exist: `shell.spec` skips exactly those, and home.spec's "opens its detail page" is `test.fixme` until Task 14.
- Phase 2 Task 11: a foreman now has a Home at `/` (product spec §5.9 and flows screen 5): Log today, "On this phone" (outbox status line to /outbox) and Your jobs (assigned jobs, tape bar, last logged; no money in the data). The redirect to `/log` is gone; the foreman nav is Home · Jobs · Log · Outbox on the phone bar and the sidebar, in that order, Log raised in place (DESIGN.md §4 updated); `canOpen("foreman", "home")` is true. A foreman's no-access back link still says "Back to Log". Needs attention rows are 56 px on phone (was 64) and small Home text is `ink` not `ink-2` (A/B lessons). Round 1 (critics 74/71): job cards are job-scoped (% done, labour, margin) with the worst stage's flag named in its sentence and a job-level forecast marker; Ryde heritage's Re-bed stage was seeded at 82% so its job % adds up; the outbox badge sits beside the Home title ("N to send", or "N needs attention" in danger style); Home's error keeps the page; foreman Home leads with today's log status and pins Log today; "on this device" replaces "on this phone". `tests/e2e/taps.ts` (`Taps.tap()` + `assertWithin(budget)`) exists; the 30 s timing check is Task 20's. No whole-dollar option added to `formatMoney`: Home sentences keep "$775.00" (home.spec asserts it).
- Phase 2 Task 11 (round 2, critics 77/79): Home follows product spec §5.9 top to bottom (Needs attention, Active jobs, Last week with the labour figure, This pay period). Needs attention shows 7 with a "Show N more" row that opens the rest in place (`moreAttention` in the DTO). A failed outbox entry is severity `over` (red) in Needs attention, matching its badge (this refines "only over budget is red"). Foreman Home has no pinned bar: Log today is a plain button under the log-status figure. The Outbox tab/sidebar item carries a count chip. `formatRoundedQuantity` gives display-only "335.7 m²". `design-capture` clears a group's old shots and slices on a full run.
- Phase 2 (session rule): agents stop the app only with `kill <pid>` from `ss -ltnp | grep 3100`; a pattern kill (`pkill -f next-server`) on 2026-09-30 stopped another project's Next 14 server on this machine.
- Phase 2 Task 13: New job requires only Site address; Job name is optional and a blank name uses the site address (flows.md:276 has one "nickname/site address" tap; onboarding stays at 25). Playwright projects run in `en-AU` so date fields show what an Australian phone shows. Phone job rows follow the §4 list row (one figure); desktop ≥ 1024 shows a 48 px table.
- Phase 2 Task 13 (deviation): the conductor changed one string in `tests/e2e/screens.ts` (keyboard capture field → "Site address") itself, because a dispatch would have overrun the §5 budget.
- Phase 2 Task 13 (rulings R8–R11): captures run with an en-AU locale (WebKit `LANG`, Chromium `--lang`); one `jobOver` rule (src/domain) decides "over budget" for job rows, the Jobs list headline and Home (product spec §5.9 keeps "trending" separate, shown in Needs attention); after creating a job the main action is "Log today on this job"; stages edit as compact rows, one open at a time. An unreadable money field blocks Save and Accept stages.
- Phase 2 Task 13 (deviation): three implementer commits (6d9bb8b..0011fbc range) carry a "Sonnet 5.5" Co-Authored-By trailer instead of Opus 5.5. History not rewritten (destructive git needs the owner); the implementer rules now say to copy the trailer exactly.
- Phase 2 Task 13 (owner, 2026-10-02): the §5 run budget was lifted for Task 13 to finish it with every gate kept.
- 2026-10-08 Task 14: a foreman cannot mark a stage done (product spec line 49 overrides the Task 14 brief); foreman gets No access on `/jobs/<id>/stages/<stageId>/done`. CR4: figure links on screens 11/12 point at `/history?job=` and `/expenses?job=`; those pages are placeholders, so honouring `job` is an acceptance item in Tasks 16 and 18. CR5: two Task 14 commits (c8750ff, 020705f) carry a Sonnet trailer; history not rewritten (destructive git = owner).

## Gate evidence

- Phase 1: `pnpm verify` exits 0 — 21 test files, 122 tests; coverage 100% statements 283/283, branches 203/203, functions 120/120, lines 210/210; "Every pay-rules example has a named test." `pnpm test:e2e` 3/3. Whole-branch review + phase spec review (opus): every example hand-checked to the cent; every rule in §0–§16 has code or a later-phase owner; its fixes applied and re-reviewed.
- Phase 0: `pnpm verify` exits 0 (12 unit tests passing).
- `pnpm test:e2e` 3/3 (iphone, android, desktop).
- Stop hook (`scripts/hooks/stop-check.mjs`) blocks on a type error (exit 2) and exits 0 when `stop_hook_active` is set.

## Open issues (carried forward)

- Phase 2 Tasks 14/15/17: remove the `shell.spec` detail-link skips and un-fixme home.spec's detail test as each route lands.
- Phase 2 (no task): Log bar error-message state has no geometry test; `ScreenSpec` `viewports`/`lightOnly`/`noExtras` are unused since the challenger was removed.
- Phase 2 Task 21: `managerMessage` is on every OutboxItem and stripped only in the outbox page — strip it in the data layer with a foreman test.
- Phase 2 Tasks 13–19: Task 11 deferred minors (ledger): double " — " in names, foreman device row repeats the failure beside the headline, skeleton heights untested, landscape bottom padding untested.
- Phase 2 Tasks 12–19 (Home kept cents): `/design` uses a local `whole()` that trims `.00` from `formatMoney`; when a screen needs whole-dollar sentences ("$775 over"), add a whole-dollar option to `formatMoney` (drop `.00` only when cents % 100 = 0) with a test and use it in both places.
- Phase 2 (no task): Field/Select overwrite a caller's own `aria-describedby`; MoneyField's minus mark can go stale on "-0" or a cleared field; a disabled selected ChoiceChip looks enabled; Checkbox has no name/value.
- Phase 2 Task 14: pausing a stage is one tap on a reason; show a toast "<stage> paused: <reason>" with Undo (48 px) (design issue i6-F1).
- Phase 2 Tasks 11–19: grouped rows and money rows in phone landscape (844 px) need a max width of about 600 px so label and amount stay together (i6-F2).
- Phase 5: the fake push saves the entry and its repeat-id record as two separate writes; the real push must do both in one transaction. The outbox badge / offline banner in the `(app)` layout read demo state per layout render and go stale on soft navigation — drive them from a client outbox store.
- Phase 3: `(app)` layout's `workspaceNameFor` swallows every error (falls back to "Roofy"); narrow it to the demo error once real data exists.
- Phase 2 Task 12: keyboard-open capture uses the static Record payout panel on `/design`; add a live-sheet keyboard capture with the Log/expense screens.
- Phase 2 Task 18: accountant can open `/jobs` (placeholder) though spec §3 lists no jobs access; decide with the reports drill-down.
- Phase 2 Task 19: theme override has a Server Function and cookie but no Settings control yet.
- Phase 2 Task 22: tighten weak shell e2e asserts (Phosphor Fill on the active tab only checks visibility; a `top >= 0` check is trivially true); `scripts/icon.svg` hard-codes the galv/tape colours (add a drift check or generate from tokens).
- No target phase: `FakeStore.nextInstant` advances on a rolled-back write (harmless 1 ms shift); each fake write snapshots the table graph (~20 ms).
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
- 2026-09-30 — Task 11 iteration 6: spec §5.9's Needs attention list gains one red kind, `pay_blocked`: a review pay run that can't be approved because someone has no pay rate reads "<Name> has no pay rate — this pay run can't be approved." and links to `/pay/<id>`. It sorts with the red rows (after over budget), shows for owner, manager and accountant only, never a foreman. Job cards show one bold sentence per flagged stage with forecast against budget, Home's key figure is "N jobs over budget", and Last week starts with a Labour row.
