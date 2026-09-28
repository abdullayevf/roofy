# Roofy — Flows (D4)

**Status:** Draft for review · **Date:** 2026-09-28
Gate (`04-design-process.md` D4): every UX target in `docs/design/brief.md` has a flow here; each flow becomes a tap-budget test under `tests/e2e/flows/`.

Today in the prototype is **Mon 28 Sep 2026** (Australia/Sydney). Workspace: **Harbour Roofing**. Crew used in examples: **Sam, Tom, Jake, Dima, Lee** (rates and levels in `02-pay-rules.md` §0). Example job: **"Smith job — Ryde re-roof"**, stage **"Sheet install"**, budget 400 m², measured 120 m² (30%), trending over by **$775.00** (`02-pay-rules.md` E12.1).

---

## How taps are counted

- A **tap** is one pointer activation of a control: a button, chip, row, tab, toggle, or a field tapped to focus it.
- **Typing** into a focused field, and the device keyboard's own keys, **do not count**. (Tapping the field once to focus it does count, as above.)
- Unless a flow says otherwise, the **starting point is the Home screen** — opening the installed app or the start route. Where a flow's natural start is a different screen (e.g. already on a crew member's page), that is stated explicitly under "Start".
- Taps inside the **operating system's own UI** — the camera shutter and its confirm/retake screen, the native share sheet, an OAuth provider's own pages — are **not counted**. The tap on the in-app control that _opens_ that system UI is counted.
- A confirmation inside an in-app bottom sheet or dialog **does** count (it's still our UI).

## Shared mechanics (used by more than one flow)

- **The Log entry chooser.** The raised **Log** tab always opens to the last-used sub-screen for the signed-in person (crew-day grid by default). A small segmented control at the top — **Crew day · Progress · No work** — switches between the three field-entry screens without leaving `/log`. Switching segments is one tap.
- **"Same as yesterday."** Copies the previous _logged_ day's project, stage and crew list onto today, with each person defaulted to their usual basis (product spec §5.5). It does not copy hours/day exceptions — those default fresh each day so a half-day yesterday doesn't silently repeat.
- **The "Logged" motion.** On Save day, the ticked crew chips fold into a single line reading "Logged" while a chalk-line stroke snaps under the date (≤ 400 ms, DESIGN.md §9). Instant with `prefers-reduced-motion`.
- **Outbox states.** Every field entry (crew-day, progress, no-work, pause/resume, expense) shows one of **Waiting · Sending · Sent · Needs attention**, with a top-of-screen badge "_N_ to send" when the outbox is non-empty. With no signal: the slim offline banner **"No signal — entries are saved on this phone and will send automatically."**
- **"Needs connection."** Admin-only screens (rates, projects, pay runs, settings, payouts) never queue offline. If there is no connection, the primary action is disabled and shows: **"Needs connection — try again once you're back online."**
- **Foreman variant.** Same routes, same components, no money. The one exception is the amount a foreman has just typed into their own expense line (brief §2) — every other dollar figure, rate, budget, margin and balance is absent from foreman-reachable pages, not just visually hidden.

## States every screen designs

| State             | What it looks like                                                            | Standard copy                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Normal            | Real content                                                                  | —                                                                                                                               |
| Empty             | One sentence of direction + the action button (DESIGN.md §4), no illustration | e.g. "No jobs yet. Add your first job."                                                                                         |
| Loading           | `line`-coloured skeleton blocks sized like the real content, no shimmer       | —                                                                                                                               |
| Error             | Message states what went wrong and how to fix it                              | "Couldn't load this. Try again." (button: "Try again")                                                                          |
| Offline / waiting | Offline banner + per-item outbox state                                        | "No signal — entries are saved on this phone and will send automatically." / "Waiting" · "Sending" · "Sent" · "Needs attention" |
| No permission     | Plain sentence, no figures, one way back                                      | "You don't have access to this. Ask your manager."                                                                              |
| Foreman           | Same layout, money fields removed at the data layer (not just hidden)         | — (see the one named exception above)                                                                                           |

## Screen inventory → routes → flows

| #   | Screen (product spec §6)    | Route                              | Touched by                                                                                                                                |
| --- | --------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sign in / sign up           | `/sign-in`, `/sign-up`             | Onboarding                                                                                                                                |
| 2   | Onboarding wizard           | `/onboarding`                      | Onboarding                                                                                                                                |
| 3   | Install guide               | `/install`                         | Onboarding                                                                                                                                |
| 4   | Home (manager)              | `/`                                | Find the job losing money, Approve a pay run (entry), Record a payout (entry), Outbox needs attention (badge), Reports drill-down (entry) |
| 5   | Home (foreman)              | `/` (foreman role)                 | Log a full crew-day (foreman variant), Outbox needs attention (badge)                                                                     |
| 6   | Log crew-day (grid)         | `/log`                             | Log a full crew-day, Same as yesterday                                                                                                    |
| 7   | Progress entry              | `/log/progress`                    | Progress 120 m² split two ways                                                                                                            |
| 8   | No-work marker              | `/log/no-work`                     | No-work marker                                                                                                                            |
| 9   | Jobs list                   | `/jobs`                            | Pause a stage (entry), Stage done with lump sum (entry)                                                                                   |
| 10  | New/edit job                | `/jobs/new`, `/jobs/[id]/edit`     | Onboarding                                                                                                                                |
| 11  | Job detail                  | `/jobs/[id]`                       | Pause a stage (entry), Stage done with lump sum (entry), Find the job losing money                                                        |
| 12  | Stage detail                | `/jobs/[id]/stages/[stageId]`      | Pause a stage, Find the job losing money                                                                                                  |
| 13  | Stage Done + lump-sum split | `/jobs/[id]/stages/[stageId]/done` | Stage done with lump sum                                                                                                                  |
| 14  | Crew list                   | `/crew`                            | Record a payout (entry), Statement share (entry)                                                                                          |
| 15  | Crew member detail          | `/crew/[id]`                       | Record a payout (entry), Statement share                                                                                                  |
| 16  | Expenses list               | `/expenses`                        | Add a receipt (entry), Expense edit (entry)                                                                                               |
| 17  | Add/edit expense            | `/expenses/new`, `/expenses/[id]`  | Add a receipt, Expense edit                                                                                                               |
| 18  | Pay runs list               | `/pay`                             | Approve a pay run (entry)                                                                                                                 |
| 19  | Pay run review              | `/pay/[runId]`                     | Approve a pay run                                                                                                                         |
| 20  | Record payout               | `/crew/[id]/payout`                | Record a payout                                                                                                                           |
| 21  | Crew statement              | `/s/[token]`                       | Statement share                                                                                                                           |
| 22  | Reports                     | `/reports`, `/reports/[kind]`      | Reports drill-down                                                                                                                        |
| 23  | Settings                    | `/settings/*`                      | Settings changes                                                                                                                          |
| 24  | Outbox / sync status        | `/outbox`                          | Outbox needs attention                                                                                                                    |
| 25  | Record history              | `/history`                         | Expense edit (viewing the audit trail of a changed line); also reachable from Job/Crew detail                                             |
| 26  | Workspace export            | `/export`                          | Settings changes (final step)                                                                                                             |

## Flow summary (recap)

| Flow                                | Who                             | Budget                             | Steps designed | Test                             |
| ----------------------------------- | ------------------------------- | ---------------------------------- | -------------- | -------------------------------- |
| Log a full crew-day                 | Manager/Foreman                 | ≤ 6 taps, < 30 s                   | 4 taps         | `crew-day.spec.ts`               |
| Same as yesterday                   | Manager/Foreman                 | ≤ 3 taps                           | 3 taps         | `same-as-yesterday.spec.ts`      |
| Progress 120 m² split two ways      | Manager/Foreman                 | ≤ 8 taps                           | 8 taps         | `progress-split.spec.ts`         |
| Pause a stage for rain              | Manager/Foreman                 | ≤ 4 taps                           | 4 taps         | `pause-stage.spec.ts`            |
| Add a receipt paid by a crew member | Manager (Foreman variant noted) | ≤ 10 taps (excl. typing)           | 10 taps        | `add-receipt.spec.ts`            |
| Find the job losing money and why   | Manager/Owner                   | ≤ 3 taps from Home                 | 2 taps         | `find-losing-job.spec.ts`        |
| Review and approve a pay run        | Manager/Owner                   | ≤ 5 taps                           | 3 taps         | `approve-pay-run.spec.ts`        |
| Record a payout                     | Manager/Owner                   | ≤ 6 taps                           | 6 taps         | `record-payout.spec.ts`          |
| Onboarding to first log             | Owner                           | ≤ 25 taps (excl. typing), < 10 min | 25 taps        | `onboarding.spec.ts`             |
| No-work marker                      | Manager/Foreman                 | ≤ 5 taps                           | 5 taps         | `no-work-marker.spec.ts`         |
| Stage done with lump sum            | Manager/Owner                   | ≤ 5 taps                           | 5 taps         | `stage-done-lump-sum.spec.ts`    |
| Expense edit                        | Manager/Owner                   | ≤ 6 taps                           | 6 taps         | `expense-edit.spec.ts`           |
| Outbox needs attention              | Manager/Foreman                 | ≤ 5 taps (edit & resend)           | 5 taps         | `outbox-needs-attention.spec.ts` |
| Statement share                     | Manager/Owner                   | ≤ 4 taps                           | 4 taps         | `statement-share.spec.ts`        |
| Reports drill-down                  | Manager/Owner/Accountant        | ≤ 5 taps                           | 4 taps         | `reports-drilldown.spec.ts`      |
| Settings changes                    | Owner/Manager                   | ≤ 5 taps                           | 5 taps         | `settings-changes.spec.ts`       |

---

## Log a full crew-day

| Goal                                           | Who                                   | Start | Budget           | Test                               |
| ---------------------------------------------- | ------------------------------------- | ----- | ---------------- | ---------------------------------- |
| Log everyone who worked today on one job/stage | Manager, Foreman (assigned jobs only) | Home  | ≤ 6 taps, < 30 s | `tests/e2e/flows/crew-day.spec.ts` |

The budget is achievable because the grid pre-fills from the last logged day. **Arithmetic:** open Log (1) + Same as yesterday (2) + one exception (3) + Save day (4) = **4 taps**, 2 under budget — enough headroom for a second exception without breaking the target.

1. Tap **Log** (bottom tab, raised chalk circle). → `/log`, crew-day grid. Date defaults to today, **Mon 28 Sep**. _(1 tap)_
2. Tap **Same as yesterday**. Project ("Smith job — Ryde re-roof"), stage ("Sheet install") and the crew who logged yesterday (Sam, Tom, Jake) fill in, each ticked with their usual basis shown on their chip ("Day", "Hourly", "m²"). _(2 taps)_
3. One exception — e.g. Sam worked a half day: tap the **½ day** toggle on Sam's row. _(3 taps)_
4. Tap **Save day**. _(4 taps)_

**After save:** the ticked chips fold into "Logged" under the date (the signature motion); the grid stays on screen ready for another entry (e.g. a second stage). Per-unit workers ticked here get a time-only log (hours recorded, $0.00) with a one-line note: "Paid from progress, not this grid."

**Offline:** saves to the phone instantly regardless of signal; shows **Waiting** in the outbox and the "N to send" badge; sends automatically when signal returns.

**Errors:** if a crew member has no rate for today's basis, their chip still saves and shows a small "no rate" note (not blocking) — the flag surfaces later in the pay run (`missing rate`, blocks approval, §9 pay rules).

**Foreman:** identical screen, no basis or rate shown on chips beyond the plain label ("Day", "Hourly", "m²"); only assigned jobs appear in the project field.

## Same as yesterday

| Goal                                            | Who              | Start | Budget   | Test                                        |
| ----------------------------------------------- | ---------------- | ----- | -------- | ------------------------------------------- |
| Repeat yesterday's crew-day exactly, no changes | Manager, Foreman | Home  | ≤ 3 taps | `tests/e2e/flows/same-as-yesterday.spec.ts` |

1. Tap **Log**. → `/log`, today's date, empty grid. _(1 tap)_
2. Tap **Same as yesterday**. Project, stage and crew fill in exactly as logged yesterday, no edits needed. _(2 taps)_
3. Tap **Save day**. _(3 taps)_

**After save:** same "Logged" motion as above. **Offline:** identical to the crew-day flow. **Errors:** if there is no "yesterday" to copy (first working day, or nothing logged yesterday), the button reads **"No day to copy yet"** and is disabled — the person falls back to a manual crew-day log.

## Progress 120 m² split two ways

| Goal                                                     | Who                              | Start | Budget   | Test                                     |
| -------------------------------------------------------- | -------------------------------- | ----- | -------- | ---------------------------------------- |
| Record 120 m² of sheet install, split between two people | Manager, Foreman (assigned jobs) | Home  | ≤ 8 taps | `tests/e2e/flows/progress-split.spec.ts` |

1. Tap **Log**. → `/log`. _(1)_
2. Tap the **Progress** segment. → `/log/progress`. _(2)_
3. Tap the project field, select **"Smith job — Ryde re-roof."** _(3)_
4. Tap the stage field, select **"Sheet install."** Budgeted 400 m², measured so far 0 m² today. _(4)_
5. Tap the **quantity** field (decimal keypad) and type `120` — typing not counted, the tap to focus is. _(5)_
6. Tap the **Sam** crew chip to add him to the split. _(6)_
7. Tap the **Dima** crew chip to add him too. Equal split is the default (60.00 m² each, no extra tap needed to choose "equal"). _(7)_
8. Tap **Save progress.** _(8)_

**After save:** stage tape bar updates to 30% with the tick at 120 m²; each person gets a per-unit work log ($570.00 for Sam, $720.00 for Dima per `02-pay-rules.md` E4.1 — hidden from foreman).

**Offline:** Waiting/Sending/Sent as above.

**Errors:** a custom split that doesn't total 100% shows under the share field: **"Shares must add up to 100%. Currently 92%."**, Save disabled until fixed. A person with no rate for the stage's unit still saves; their line shows **"No m² rate for Jake — paid $0.00 until this is fixed."**

**Foreman:** identical screen; no rate, no amount, no budget percentage-to-dollars — only the quantity and the tape bar's percentage are shown.

## Pause a stage for rain

| Goal                                         | Who                              | Start | Budget   | Test                                  |
| -------------------------------------------- | -------------------------------- | ----- | -------- | ------------------------------------- |
| Pause the active stage with reason "Weather" | Manager, Foreman (assigned jobs) | Home  | ≤ 4 taps | `tests/e2e/flows/pause-stage.spec.ts` |

1. Tap the active job row on Home (e.g. "Smith job — Ryde re-roof"). → `/jobs/[id]`. _(1)_
2. Tap the active stage row ("Sheet install"). → `/jobs/[id]/stages/[stageId]`. _(2)_
3. Tap **Pause stage**. Opens a bottom sheet with reason chips: Weather, Waiting on materials, Waiting on client/builder, Crew on another job, Other. _(3)_
4. Tap the **Weather** chip — selecting a reason pauses immediately (no separate confirm), sheet closes. _(4)_

**After save:** stage status chip changes to **Paused** (watch colour, pause icon, "Weather"); the open stage segment closes at today's date.

**Offline:** Waiting/Sending/Sent as above; the stage shows "Paused" locally at once even before it sends.

**Errors:** pausing a stage that is already Done is not offered (no Pause action on a Done stage). An optional note field is on the same sheet for detail (e.g. "Forecast clearing Thursday") — never required, so it never blocks the 4-tap path.

**Foreman:** identical; status chips and segment history show no dollars, only dates and the reason.

## Add a receipt paid by a crew member

| Goal                                       | Who     | Start | Budget                   | Test                                  |
| ------------------------------------------ | ------- | ----- | ------------------------ | ------------------------------------- |
| Log a $110.00 screws receipt Dima paid for | Manager | Home  | ≤ 10 taps (excl. typing) | `tests/e2e/flows/add-receipt.spec.ts` |

1. Tap **More**. → `/more`. _(1)_
2. Tap **Expenses**. → `/expenses`. _(2)_
3. Tap **Add expense**. → `/expenses/new`. _(3)_
4. Tap **Take photo** — opens the device camera. Shutter tap and any retake/confirm screen are the operating system's own UI and are not counted. _(4)_
5. Tap the **total** field (decimal keypad) and type `110.00` — typing not counted. GST defaults to total ÷ 11 ($10.00), editable, no tap needed to accept the default. _(5)_
6. Tap the **project** chip — the job list shows the current/recent jobs first: **"Smith job — Ryde re-roof."** _(6)_
7. Tap the **category** chip: **Materials.** _(7)_
8. Tap **Paid by** → **Crew member.** _(8)_
9. Tap the crew chip: **Dima.** _(9)_
10. Tap **Save expense.** _(10)_

**After save:** expense appears in the list against the job, marked "Paid by Dima — reimbursed next pay run"; a reimbursement line of $110.00 (the full amount Dima paid, GST included) is queued into the pay run containing the expense date (`02-pay-rules.md` §7, E7.1).

**Offline:** photo stored as a blob and the entry queues **Waiting**; both the photo and the expense send once signal returns, photo first.

**Errors:** no total entered → the total field shows an `over`-coloured border and **"Add a total before saving."** No photo taken → allowed, Save still works (a photo is not required to save, only to change state to "receipt attached").

**Foreman:** foremen reach the same form from a job's **Add expense** shortcut (Jobs tab → job → Add expense), skipping the project-picker tap since the job is already the current one — 1 fewer tap than the manager path. The one dollar figure a foreman sees on this screen is the total they just typed into the field in step 5 (brief §2's named exception); no other amount, rate, budget or margin appears anywhere on the screen, before or after save.

## Find the job losing money and why

| Goal                                                 | Who            | Start | Budget             | Test                                      |
| ---------------------------------------------------- | -------------- | ----- | ------------------ | ----------------------------------------- |
| From Home, find which job is over budget and see why | Manager, Owner | Home  | ≤ 3 taps from Home | `tests/e2e/flows/find-losing-job.spec.ts` |

1. On Home's **Needs attention** list, tap the row: **"Smith job is $775 over on sheet install."** → opens the stage directly, `/jobs/[id]/stages/[stageId]`, already showing the tape bar at 30%, labour budget $4,200.00 (budget × 1.05 tolerance already reflected in the amber threshold) vs forecast **$4,775.00**, over marker on the tape at the forecast point. _(1 tap)_
2. Tap the **forecast labour figure** to drill through to the logs behind it (DESIGN.md §4, "money cell" — the whole row is the tap target). → shows the two log lines that make up the $1,432.50 actual so far (Sam's per-unit line, Dima's per-unit line, both from the 120 m² progress entry) and the arithmetic that produces the $4,775.00 forecast. _(2 taps)_

**After tap 2:** the person can see, in one more tap than Home itself, exactly which two lines are driving the overage and why (120 m² at 30% complete, projected out). 1 tap of headroom remains under the 3-tap budget for a workspace where Home doesn't already surface the exact stage (e.g. a job with two over-budget stages needing a first tap onto the job before the stage).

**Offline:** this is a read; cached figures from the last snapshot show with **"Lists updated _n_ ago"** if stale (`03-architecture.md` §7).

**Foreman:** not reachable — budgets and margins are Manager/Owner/Accountant only; a foreman opening this stage sees status and quantity only, no tape-bar dollar figures.

## Review and approve a pay run

| Goal                                    | Who            | Start | Budget   | Test                                      |
| --------------------------------------- | -------------- | ----- | -------- | ----------------------------------------- |
| Review this week's draft and approve it | Manager, Owner | Home  | ≤ 5 taps | `tests/e2e/flows/approve-pay-run.spec.ts` |

1. Tap the **This pay period** card on Home. → `/pay/[runId]`, draft, grouped by person, flags listed first (most severe first). _(1)_
2. Read the flags and lines (no tap required to review).
3. Tap **Approve pay run.** Opens a confirmation sheet (approval locks every log in the period, so it is confirmed, not instant — DESIGN.md's destructive/consequential-action pattern). _(2)_
4. Tap **Approve** in the sheet. _(3)_

**After save:** pay run status becomes **Approved**; every log in the period is locked; a ledger credit posts for each person; the screen offers **Export CSV** as a separate, optional next action (not counted in this flow's budget).

**Offline:** admin-only — the Approve button is disabled with **"Needs connection — try again once you're back online"** if offline; nothing queues.

**Errors:** a **Missing rate** flag blocks the Approve button until the rate is fixed or waived by Owner/Manager (waiver is audited); copy: **"Fix the missing rate before you approve."** with a tap-through to the line. **Owner 2FA off** also blocks: **"Turn on two-factor before you approve a pay run."** with a button to Settings. All other flags (below floor, double pay, paused/done-stage log, gap, possible duplicate) are warnings shown inline and never block Approve.

## Record a payout

| Goal                               | Who            | Start | Budget   | Test                                    |
| ---------------------------------- | -------------- | ----- | -------- | --------------------------------------- |
| Record a $1,482.00 payment to Dima | Manager, Owner | Home  | ≤ 6 taps | `tests/e2e/flows/record-payout.spec.ts` |

1. Tap **Crew.** → `/crew`. _(1)_
2. Tap **Dima.** → `/crew/[id]`, showing balance and recent ledger entries. _(2)_
3. Tap **Record payout.** → sheet at `/crew/[id]/payout`, date defaults to today. _(3)_
4. Tap the **amount** field (decimal keypad) and type `1482.00` — typing not counted. _(4)_
5. Tap **Payment** (Advance/Payment toggle; defaults unselected, both real options carry real consequences so neither defaults on). _(5)_
6. Tap **Save payout.** _(6)_

**After save:** balance updates immediately (Dima's balance $1,482.00 → $0.00, per `02-pay-rules.md` E15.1); the entry appears in the ledger list dated today.

**Offline:** admin-only — same "Needs connection" behaviour as approving a pay run; no queueing.

**Errors:** amount left blank or $0.00 → field shows an `over` border and **"Add an amount before saving."**

**Foreman:** not reachable — balances and payouts are Manager/Owner only.

## Onboarding to first log

| Goal                                                                             | Who   | Start      | Budget                             | Test                                 |
| -------------------------------------------------------------------------------- | ----- | ---------- | ---------------------------------- | ------------------------------------ |
| Sign up, set up the business, add one crew member and one job, log the first day | Owner | `/sign-in` | ≤ 25 taps (excl. typing), < 10 min | `tests/e2e/flows/onboarding.spec.ts` |

Six fields are typed during this flow (business name, ABN, one crew member's name and rate, one client's name, and today's quantity is not needed here since this is a crew-day, not progress) — typing time is excluded from the tap budget but counts toward the 10-minute target; kept short by design (short names, no paragraphs).

| #   | Step                   | Control                                                                                                                                                               | Cumulative taps |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | Sign up                | Tap **Continue with Google** (Google's own screens that follow are not counted)                                                                                       | 1               |
| 2   | Business details       | Tap the **business name** field to focus it                                                                                                                           | 2               |
| 3   |                        | Tap the **ABN** field to focus it                                                                                                                                     | 3               |
| 4   |                        | Tap the **GST registered** toggle                                                                                                                                     | 4               |
| 5   |                        | Tap **Continue**                                                                                                                                                      | 5               |
| 6   | Trade                  | Tap the **Roofing** trade chip (advances automatically)                                                                                                               | 6               |
| 7   | Templates & categories | Tap **Use these** to accept the default stage templates and expense categories                                                                                        | 7               |
| 8   | Quick-add crew         | Tap **Add crew member**                                                                                                                                               | 8               |
| 9   |                        | Tap the **name** field to focus it (types "Sam")                                                                                                                      | 9               |
| 10  |                        | Tap the **basis** chip: **Daily**                                                                                                                                     | 10              |
| 11  |                        | Tap the **rate** field to focus it (types "320.00")                                                                                                                   | 11              |
| 12  |                        | Tap **Add** to confirm the row                                                                                                                                        | 12              |
| 13  |                        | Tap **Continue** to finish the crew step                                                                                                                              | 13              |
| 14  | Install guide          | Tap **Continue** (device detected automatically; guide shown, not required to complete now)                                                                           | 14              |
| 15  | Home, first run        | Tap **Add your first job** (empty-state action)                                                                                                                       | 15              |
| 16  | New job                | Tap **Quick-add client**                                                                                                                                              | 16              |
| 17  |                        | Tap the **client name** field to focus it (types "Smith")                                                                                                             | 17              |
| 18  |                        | Tap **Save** on the client                                                                                                                                            | 18              |
| 19  |                        | Tap the **job type** chip: **Metal re-roof**                                                                                                                          | 19              |
| 20  |                        | Tap the **nickname/site address** field to focus it (types "Ryde re-roof")                                                                                            | 20              |
| 21  |                        | Tap **Accept stages** (templated stage list)                                                                                                                          | 21              |
| 22  |                        | Tap **Create job**                                                                                                                                                    | 22              |
| 23  | First log              | Tap **Log.** The just-created job is the only active job, so it's pre-selected; its first stage ("Site setup & safety") is pre-selected as the only Not started stage | 23              |
| 24  |                        | Tap the **Sam** crew chip (the only crew member so far)                                                                                                               | 24              |
| 25  |                        | Tap **Save day**                                                                                                                                                      | 25              |

**Total: 25 taps**, exactly at budget — every pre-fill above (auto-selected job, auto-selected stage, trade chip advancing without a separate Continue) exists specifically to keep this under 25; there is no spare tap in this flow, so any screen added later to onboarding must remove a tap elsewhere or move the step after first log.

**After save:** the "Logged" motion plays; Home now shows one active job, one crew member, today's log — no more empty states.

**Offline:** onboarding's admin steps (business, crew, job) are online-only ("Needs connection" if lost mid-wizard, progress kept, resumes where left off); the final first-log step behaves like any crew-day log — it queues in the outbox if signal drops right at the end.

**Errors:** ABN not 11 digits → **"ABN should be 11 digits."** under the field. Duplicate client name → allowed (no CRM-level dedupe in MVP), no error.

## No-work marker

| Goal                                  | Who                              | Start | Budget   | Test                                     |
| ------------------------------------- | -------------------------------- | ----- | -------- | ---------------------------------------- |
| Mark Jake as Rain (no work) for today | Manager, Foreman (assigned crew) | Home  | ≤ 5 taps | `tests/e2e/flows/no-work-marker.spec.ts` |

1. Tap **Log.** → `/log`. _(1)_
2. Tap the **No work** segment. → `/log/no-work`, date defaults to today. _(2)_
3. Tap the **Jake** crew chip. _(3)_
4. Tap the **Rain** reason chip. _(4)_
5. Tap **Save.** _(5)_

**After save:** Jake's day shows "Rain" instead of a gap on Home's "last week" gap count and in reports; unpaid in MVP, no log/amount created.

**Offline:** Waiting/Sending/Sent as other field entries.

**Errors:** marking a person already logged that day is blocked: **"Jake already has a log today — remove it first to mark no work."**

## Stage done with lump sum

| Goal                                             | Who                            | Start | Budget   | Test                                          |
| ------------------------------------------------ | ------------------------------ | ----- | -------- | --------------------------------------------- |
| Mark a lump-sum stage Done and confirm the split | Manager, Owner (never Foreman) | Home  | ≤ 5 taps | `tests/e2e/flows/stage-done-lump-sum.spec.ts` |

Example: a lump-sum stage "Ridge bedding & pointing", L = $2,000.00, three people logged work on it (Sam, Tom, Dima) — equal split proposes $666.67 / $666.67 / $666.66 (`02-pay-rules.md` E5.1).

1. Tap **Jobs.** → `/jobs`. _(1)_
2. Tap the job with the lump-sum stage. → `/jobs/[id]`. _(2)_
3. Tap the **"Ridge bedding & pointing"** stage row. → `/jobs/[id]/stages/[stageId]`. _(3)_
4. Tap **Mark done.** → `/jobs/[id]/stages/[stageId]/done`, completion date defaults to today, the proposed equal split (Sam/Tom/Dima, everyone who logged on the stage) shown with amounts. _(4)_
5. Tap **Confirm done** (accepting the proposed date and split, no note or photo needed). _(5)_

**After save:** stage status becomes **Done** (good colour); each of the three gets a lump-sum log dated today; the open stage segment closes with end = completion date + 1 day.

**Offline:** admin-only (marking Done is a Manager/Owner action) — "Needs connection" if offline; nothing queues.

**Errors:** custom shares not totalling 100% show **"Shares must add up to 100%. Currently 88%."**, Confirm disabled until fixed.

**Foreman:** cannot reach this action — no "Mark done" control appears on a foreman's stage detail page at all (product spec §3).

## Expense edit

| Goal                                 | Who            | Start | Budget   | Test                                   |
| ------------------------------------ | -------------- | ----- | -------- | -------------------------------------- |
| Correct the total on a saved expense | Manager, Owner | Home  | ≤ 6 taps | `tests/e2e/flows/expense-edit.spec.ts` |

1. Tap **More.** → `/more`. _(1)_
2. Tap **Expenses.** → `/expenses`. _(2)_
3. Tap the expense row to open it. → `/expenses/[id]`. _(3)_
4. Tap **Edit.** _(4)_
5. Tap the **total** field to focus it, correct the amount — typing not counted. _(5)_
6. Tap **Save changes.** _(6)_

**After save:** the figure updates everywhere it's shown (job costs, pay run reimbursement if already in a draft period); an audit event is written (before/after, who, when) viewable from **Record history** (`/history`) linked off this expense's detail page.

**Offline:** admin edit of an already-saved record needs a connection — "Needs connection — try again once you're back online" if offline (architecture §7, "editing already-synced records needs a connection").

**Errors:** editing an expense already reimbursed in an **approved** pay run is allowed for Owner/Manager but shows a warning banner first: **"This expense is in an approved pay run. Saving will adjust next week's pay run, not this one."**

## Outbox needs attention

| Goal                                     | Who              | Start           | Budget   | Test                                             |
| ---------------------------------------- | ---------------- | --------------- | -------- | ------------------------------------------------ |
| Fix a rejected field entry and resend it | Manager, Foreman | `/outbox` badge | ≤ 5 taps | `tests/e2e/flows/outbox-needs-attention.spec.ts` |

1. Tap the **"N to send"** outbox badge (or the **Outbox** tab on foreman nav). → `/outbox`, list grouped by state. _(1)_
2. Tap the **Needs attention** item. → expands with the reason, e.g. "This stage was marked Done — pick a different stage." _(2)_
3. Tap **Edit & resend.** → opens the original entry screen, pre-filled with everything the person entered. _(3)_
4. Tap the corrected control — e.g. a different stage chip. _(4)_
5. Tap **Save** (same label the original screen used — "Save day" / "Save progress" / "Save expense"). _(5)_

**After save:** the item moves to **Sending**, then **Sent**; badge count drops by one.

**Alternate ending — Discard:** from step 2, tap **Discard** (2 taps) → confirmation sheet → tap **Discard entry** (3 taps) → item removed, nothing sent, no audit entry (it was never applied).

**Offline:** the outbox screen itself works offline (it's reading the phone's own queue); Edit & resend re-queues as **Waiting** until signal returns.

**Errors:** the reason shown is always the server's own rejection message (e.g. "You don't have access to this project", "This project no longer exists") — never a generic "failed."

## Statement share

| Goal                                           | Who            | Start | Budget   | Test                                      |
| ---------------------------------------------- | -------------- | ----- | -------- | ----------------------------------------- |
| Share Dima's pay-run statement by text message | Manager, Owner | Home  | ≤ 4 taps | `tests/e2e/flows/statement-share.spec.ts` |

1. Tap **Crew.** → `/crew`. _(1)_
2. Tap **Dima.** → `/crew/[id]`. _(2)_
3. Tap the statement row for the pay period to view it, or directly **Share statement** if offered inline — this flow counts the direct path: tap **Share statement.** _(3)_
4. Tap the target app inside the device's own share sheet — not counted as an in-app tap, but the control that _opened_ the share sheet (step 3) is. So the in-app total is **3 taps**; the flow's stated budget (4) leaves one tap of headroom for a workspace where the statement must be opened before Share is visible. _(share-sheet tap not counted)_

**After share:** a private, unguessable link to `/s/[token]` is sent (or the PDF file, per the share target); the link is revocable and expires after 90 days.

**Offline:** generating/opening the statement page (`/s/[token]` locally cached preview) needs a connection the first time; once loaded it's a read-only page and tolerates a drop mid-view.

**Errors:** sharing a period with no approved pay run yet is not offered — the Share control doesn't appear until the run is Approved.

## Reports drill-down

| Goal                                                    | Who                        | Start | Budget   | Test                                        |
| ------------------------------------------------------- | -------------------------- | ----- | -------- | ------------------------------------------- |
| Open Job profitability and drill into one job's numbers | Manager, Owner, Accountant | Home  | ≤ 5 taps | `tests/e2e/flows/reports-drilldown.spec.ts` |

1. Tap **More.** → `/more`. _(1)_
2. Tap **Reports.** → `/reports`, five summary cards on phone. _(2)_
3. Tap **Job profitability.** → `/reports/job-profitability`. _(3)_
4. Tap the **"Smith job — Ryde re-roof"** row to drill into its source lines. _(4)_

**After tap 4:** the job's labour, expenses and margin lines are shown with the same tap-through-to-source-logs behaviour as Job detail. 1 tap of headroom remains under the 5-tap budget for adding a date-range filter tap where the default range isn't the one wanted.

**Offline:** reports need a connection for anything beyond the last cached snapshot; a stale report shows "Lists updated _n_ ago."

**Foreman:** not reachable — Reports is Manager/Owner/Accountant only.

## Settings changes

| Goal                        | Who                                                       | Start | Budget   | Test                                       |
| --------------------------- | --------------------------------------------------------- | ----- | -------- | ------------------------------------------ |
| Change a level's floor rate | Owner, Manager (not billing/workspace-delete, Owner only) | Home  | ≤ 5 taps | `tests/e2e/flows/settings-changes.spec.ts` |

1. Tap **More.** → `/more`. _(1)_
2. Tap **Settings.** → `/settings`. _(2)_
3. Tap **Levels & floor rates.** → `/settings/levels`. _(3)_
4. Tap the **floor rate** field for "Roofer" to focus it, correct the value — typing not counted. _(4)_
5. Tap **Save changes.** _(5)_

**After save:** the new floor applies to award-floor checks on pay runs from this point on; existing approved pay runs are unaffected (checks run at pay-run time, not retroactively).

**Offline:** admin-only — "Needs connection" if offline.

**Errors:** a floor rate of $0.00 or blank shows **"Add a floor rate before saving."**

**Related, not tap-counted separately:** **Workspace export** (`/export`, screen 26) is reached the same way, one level up (More → Settings → Workspace export), and is a single **Export workspace** tap once on the page — it is not a numbered UX target but is covered here so it is not orphaned from the screen inventory.
