# Progress

## Current

- Phase: 2 — Design system and full prototype. Branch `phase/2-design-prototype` (local on the VPS, not pushed, not merged). Plan: `docs/plans/03-design-prototype.md`.
- Paused 2026-09-30 (usage limit). Head `20d77fe` plus this docs commit. Tree clean. Task ledger (git-ignored, local only): `.superpowers/sdd/03-design-prototype/progress.md` — every ruling, deferred minor and fix round is there; the files `implementer-rules.md` and `reviewer-rules.md` beside it are reused by every dispatch.
- Done and reviewed: Tasks 1–7 and 9.
  - Task 7: spec review (opus) settled the open question — re-pricing $0.00 missing-rate logs when a rate is added is spec-compliant (it is the only "fix" before approval). Fixed: re-pricing skipped adjustments (crash + half-saved rate), `FakeStore.write` is all-or-nothing, seed perf guard measures thread CPU time. Re-review clean.
  - Task 9: shell, nav, PWA manifest, placeholders for every nav target, error/not-found/no-permission. Review fixes: Workspace export Owner-only, tab bar side insets, theme colours generated at build time. Re-review clean.
- **Task 8 (design system page) — waiting on the owner.** Loop scores (design / field): i1 72/69 · i2 75/70 · i3 90/87 · i4 82/82 · i5 87/87 · i6 87/87 (0 P0/P1, checks green). The 6-iteration cap was reached below 90. Logged in `docs/design/loop/DECISIONS.md` (2026-09-30), with 19 open i6 rows in `ISSUES.md` (P2: i6-D1, D2, F1, F2). Owner page (private): https://claude.ai/artifact/FpXvidGzcdPtNsWrUx3hGY
  - Owner options: A accept 87 and carry i6-F1 (undo toast after one-tap pause) and i6-F2 (landscape row width) into the screen tasks; B one more fix round (iteration 7); C pause.
  - After the decision: one sonnet task review of Task 8's code (`git diff 7faba77^..HEAD -- src tests scripts`), then Task 10.
- Then: Tasks 10–23 in order (D2 A/B, nine screen groups, tap-budget suite, foreman sweep, baselines + PWA, phase gate).
- Environment: real WebKit works on the VPS (`pnpm test:e2e` all three projects green). `ROOFY_NO_WEBKIT` / `ROOFY_CHROMIUM_EXECUTABLE` are not needed here. Never stop the server with `pkill -f "next start"` (it matches the calling shell); kill the PID from `ss -ltnp | grep 3100`.

### Token budget rules (owner request 2026-09-30 — follow every session)

Quality gates stay the same (TDD, per-task review, design loop ≥ 90 with no P0/P1, spec review, phase gate). What changes is how much each step reads and re-runs:

1. **Critics read slices, not full pages.** Give critics `shots/<group>/slices/` + `checks.md` + the installed/keyboard/landscape/tablet top-level shots. Never the full-page PNGs (they render as unreadable thumbnails; critics already judge from slices).
2. **Split critic coverage by lens.** Field critic: phone viewports (iphone, android) light + dark, installed, keyboard, landscape. Design critic: iphone light + dark, desktop light + dark, tablet, installed. Android and iphone are near-identical layouts, so each critic skips what the other covers. Both still see dark mode and both see iphone.
3. **Critics return only scores + issue table** (no per-image narration). Ask for ≤ 40 lines.
4. **Opus only where it earns it:** money/pay/ledger, foreman hiding, sync/idempotency, timezone, spec reviews, critics, final phase review. Sonnet for screens, components, scripts, seeding, per-task reviews and every scoped re-review.
5. **e2e once per task, focused while iterating.** Implementers iterate on unit tests + the one e2e spec they touch (`--project=iphone`); run their task's e2e specs on all three projects once before the final commit. Fix rounds re-run only the affected spec files. The full `pnpm test:e2e` runs at the phase gate.
6. **One implementer run per design iteration does fix + capture + checks** (never a separate capture agent). Critics run in parallel with each other only.
7. **Resume the same implementer for fix rounds while its context is small;** if its last report said it was large (≈ 200k+), start a fresh sonnet implementer pointed at the report file instead.
8. **Controller hands over files, not pasted text:** briefs, critic tables and review packages live in `.superpowers/sdd/03-design-prototype/`; dispatch prompts stay under ~25 lines and point at `implementer-rules.md` / `reviewer-rules.md`.
9. **Screen groups: the capture manifest already lists only states that differ;** don't add a state capture unless it looks different from one already captured (e.g. no separate capture per `?demo=` state that renders the same shell).

## Log

- 2026-09-28 — Specs, DESIGN.md, master plan, Phase 0/1 plans written.
- 2026-09-28 — Phase 0 shipped: Next.js scaffold (strict TS ~6.0.3), import-boundary lint (`src/domain` pure, `src/components`/`src/offline` barred from `src/server`), Vitest 5 unit tests, dev Postgres (Docker Compose), Playwright with 3 projects (iphone/android/desktop), design lint enforcing DESIGN.md anti-patterns, Claude Code harness (CLAUDE.md, hooks, spec reviewer, progress log), and a git pre-commit gate (typecheck + unit tests).
- 2026-09-28 — Phase 1 shipped: pure domain core in `src/domain/` (money, split, rates, lines, piece, gst, costing, dates, segments, progress, floor, adjustments, flags, attendance, periods, payrun, ledger) plus `src/lib/format.ts`. Every pay-rules example (E1.1–E15.1) is a named test and matches to the cent; `scripts/check-examples.ts` proves none is missing; `verify` now runs coverage (100% on `src/domain`) and `check:examples`.

- 2026-09-28/29 — Phase 2 in progress (cloud session): plan written; Tasks 1–6 shipped and reviewed; Task 7 implemented (review pending); Task 8 through design-loop iteration 3 (+ iteration 4 fixes); Task 9 partial.
- 2026-09-30 — Task 8 iteration 6 scored 87/87; loop stopped at the cap and escalated to the owner.
- 2026-09-29/30 — Phase 2 on the VPS: Task 7 reviewed and fixed; Task 9 finished and reviewed; Task 8 loop iterations 4–5 scored (82, 87) and iteration 6 fixed + captured (critics cut off by the usage limit). Token budget rules added. See Current.

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

- Phase 2 Task 9 decisions: owner and manager share the manager nav; a foreman opening Home is redirected to Log (no Home tab). Access rules in `src/components/shell/access.ts` (spec §3): foreman gets jobs, log, outbox, expenses, install; accountant gets home, jobs, pay, reports, expenses, more, install; other pages show the no-permission state. Accountant More = Expenses, Install guide (Pay and Reports are tabs; settings, history, export are edit or admin).
- Phase 2 Task 9: `Button` and `List` links now `prefetch={false}` like the nav (aborted RSC prefetches log a WebKit console error on navigation). Page title template `%s | Roofy` lives in the `(app)` layout only (`/design` keeps "Design system"). Placeholder pages handle `?demo=noperm` and `?demo=error` via `PlaceholderPage`; screen tasks keep that pattern. Layout reads the workspace name through `data.workspace.settings` and falls back to "Roofy" if that throws.
- Phase 2 Task 9: `error.tsx` uses Next 16.3's `retry` prop. The root layout reads the theme cookie (whole app is dynamic, as the proxy already required). Left and right safe-area padding is on the content column only; the fixed tab bar pads bottom only.
- Phase 2 Task 9 (review fixes): Workspace export is Owner-only (spec §5.11): hidden from the manager's More and `/export` shows no-access to a manager; the owner shares the manager nav otherwise. Manifest has no `orientation`. Manifest and `theme-color` colours come from `src/app/theme-colors.json`, generated from tokens.css by `scripts/gen-theme-colors.ts` (part of `tokens:gen` / `tokens:check`), so nothing reads `src/` at run time. The tab bar pads left and right insets too.
- Phase 2 Task 9 (recorded for review): the desktop sidebar adds a "Manage" section for managers (Expenses, Pay runs, Reports, Settings) beyond the tab-bar items. `prefetch={false}` on Button, List and nav links (WebKit aborted-prefetch console errors); revisit in Phase 5. A foreman at `/` redirects to `/log`. Accountant More = Expenses + Install guide.
- Phase 2 Task 8 (loop): input values use Atkinson with tabular figures (DESIGN.md §3); Atkinson's slashed zero is accepted (i4-D6 won't fix). Pause sheet puts the optional note above the reason chips; a reason tap pauses (4 taps). New tokens `over-fill`, `bar`; `tablet: 600px` breakpoint for the 2-column crew grid (DESIGN.md §8); active desktop sidebar item is filled icon + galv background + ink edge bar (no chalk fill). Foreman tab bar is Jobs · Log · Outbox with Log centred.

## Gate evidence

- Phase 1: `pnpm verify` exits 0 — 21 test files, 122 tests; coverage 100% statements 283/283, branches 203/203, functions 120/120, lines 210/210; "Every pay-rules example has a named test." `pnpm test:e2e` 3/3. Whole-branch review + phase spec review (opus): every example hand-checked to the cent; every rule in §0–§16 has code or a later-phase owner; its fixes applied and re-reviewed.
- Phase 0: `pnpm verify` exits 0 (12 unit tests passing).
- `pnpm test:e2e` 3/3 (iphone, android, desktop).
- Stop hook (`scripts/hooks/stop-check.mjs`) blocks on a type error (exit 2) and exits 0 when `stop_hook_active` is set.

## Open issues (carried forward)

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
