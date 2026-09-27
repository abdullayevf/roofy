# Roofy — Pay & Costing Rules

**Status:** Draft for review · **Date:** 2026-09-28
Every rule here has a worked example. **The examples are acceptance tests**: the domain code must reproduce every number exactly.

---

## 0. Conventions

- **Money** is stored as integer cents. Never floating point. Decimal maths via an exact decimal library.
- **Rounding:** half-up to the cent, applied once per computed line amount (not on intermediate steps).
- **Quantities:** 2 decimal places (m², lm); "each" is whole numbers. **Hours:** 0.25 steps. **Days:** 1 or 0.5.
- **Rates** are money per unit (per hour, per day, per m², per lm, per each), stored in cents.
- **Splitting a total into shares** uses the *largest remainder* method so shares always add up exactly to the total; leftover smallest units go to people **in the order they appear in the split** (first person first).
- All amounts are **ex GST** unless stated.
- Dates are local calendar dates in the workspace timezone.

### Example crew (used below)
Workspace: GST registered, on-cost 25%, standard day 8.0 h, working days Mon–Fri, weekly pay Mon–Sun.

| Person | Type | Level | Rates | Floor |
|---|---|---|---|---|
| Sam | Employee | Roofer | daily $320.00 · m² $9.50 · hourly $40.00 | $32.00/h |
| Tom | Employee | Roofer | m² $9.00 · daily $300.00 | $32.00/h |
| Jake | Employee | Apprentice yr 2 | hourly $24.00 | $22.00/h |
| Dima | ABN contractor | — (GST registered) | m² $12.00 · daily $400.00 | — |
| Lee | ABN contractor | — (not GST registered) | lm $8.00 · daily $350.00 | — |

---

## 1. Rate lookup

For a log on date *d*, project *p*, person *c*, basis *b* (and unit *u* for per-unit):
1. Use the **project override** for (c, b, u, p) with the latest `effective_from ≤ d`, if any.
2. Else the **default rate** for (c, b, u) with the latest `effective_from ≤ d`.
3. Else: **no rate** → the log is saved with amount $0.00 and flagged "missing rate" (pay run cannot be approved until fixed or waived by Owner/Manager).

The rate used is **copied onto the log** (snapshot). Later rate changes never change existing logs.

> **E1.1** Sam's daily rate: $300.00 from 1 Jul, $320.00 from 15 Sep. Log dated 12 Sep → $300.00. Log dated 15 Sep → $320.00.
> **E1.2** Project "Ryde heritage" override for Sam daily $360.00 from 1 Sep. Log on that project dated 16 Sep → $360.00. Log on another project same day → $320.00.

## 2. Hourly

`amount = hours × rate × multiplier` (multiplier default 1.0; choices 1.5, 2.0, or custom 1.0–3.0).

> **E2.1** Jake 7.5 h × $24.00 = **$180.00**.
> **E2.2** Jake overtime line 2 h × $24.00 × 1.5 = **$72.00**.

## 3. Daily

`amount = days × daily rate`, days ∈ {1, 0.5}. Hours pre-filled = days × standard day hours (editable; used only for floor check and reports).

> **E3.1** Sam 1 day → **$320.00**, hours 8.0.
> **E3.2** Sam 0.5 day → **$160.00**, hours 4.0.

## 4. Per unit (piece rate) — from a progress entry

A progress entry has: stage (with unit *u*), date, quantity *Q*, crew list with shares.
1. Shares: **equal** by default, or custom % (must total exactly 100%).
2. Split *Q* into per-person quantities with largest remainder at 0.01 (or 1 for "each").
3. Each person gets a work log: basis per-unit, quantity = their share, rate = their own rate for *u*, `amount = quantity × rate`, hours = standard day unless edited.
4. If anyone in the split has no rate for *u* → the entry is still saved; that person's log gets $0.00 + "missing rate" flag.

> **E4.1 Equal split, two people.** 120 m² sheet install, Sam + Dima equal → 60.00 each. Sam 60.00 × $9.50 = **$570.00**. Dima 60.00 × $12.00 = **$720.00**.
> **E4.2 Equal split with remainder.** 100 m², Sam, Dima, Tom (in that order) → Sam **33.34**, Dima **33.33**, Tom **33.33**. Amounts: Sam 33.34 × $9.50 = **$316.73**; Dima 33.33 × $12.00 = **$399.96**; Tom 33.33 × $9.00 = **$299.97**.
> **E4.3 Custom split.** 80 lm gutters, Lee 75% / Jake 25% → Lee 60.00 lm × $8.00 = **$480.00**. Jake has no lm rate → Jake's log 20.00 lm, **$0.00**, flag "missing rate".
> **E4.4 Grid + progress.** Sam and Dima are also ticked on the grid for that stage and day as per-unit workers → the grid creates time-only logs (hours 8.0, $0.00). No double pay; hours still count for floor checks and reports.

## 5. Lump sum per stage

Stage has `lump_sum_amount` *L*. When the stage is marked Done:
1. App proposes crew = everyone with any log on that stage (any date), equal shares.
2. Manager can change people/shares (must total 100%).
3. Split *L* in cents by largest remainder. Each person gets a log dated the completion date, basis lump sum.
4. Re-opening a Done stage with lump-sum logs in an **approved** pay run → reversing adjustments (§8). If not yet approved → the lump-sum logs are deleted.

> **E5.1** "Ridge bedding & pointing" L = $2,000.00, Sam/Tom/Dima equal → **$666.67 / $666.67 / $666.66** (sum $2,000.00).

## 6. Contractor GST (pay run level)

Per contractor per pay run: `subtotal` = sum of their lines (incl. adjustments, excl. reimbursements). If GST registered: `GST = round(subtotal × 10%)`, else 0. `total = subtotal + GST + reimbursements`.

> **E6.1** Dima week: per-unit $720.00 + 2 days × $400.00 = subtotal **$1,520.00**, GST **$152.00**, total **$1,672.00**.
> **E6.2** Lee week: 3 days × $350.00 = subtotal **$1,050.00**, GST **$0.00**, total **$1,050.00**.

## 7. Reimbursements

Expense with paid by = crew member → one reimbursement line (amount **incl. GST**, i.e. what they paid) in the pay run whose period contains the expense date (or the next open one if that period is approved). Not earnings: no GST added, no on-cost, not in floor check.

> **E7.1** Dima paid $110.00 (GST $10.00) for screws on Wed → reimbursement **$110.00** in this week's pay run. Dima total becomes $1,672.00 + $110.00 = **$1,782.00**.

## 8. Changes after a pay run is approved (adjustments)

Logs in an approved pay run are **locked** (never updated in place).
- **Edit** a locked log → Owner/Manager only. The app creates an **adjustment log** carrying only the difference (quantity, hours, amount), same date/project/stage, linked to the original. It lands in the next draft pay run labelled "Adjustment for <date>".
- **Delete** a locked log → adjustment with the negative of the original.
- **New log dated in an approved period** → goes into the next draft pay run labelled "Late entry for <date>".
- Job costs use original + adjustments, so they always reflect the corrected truth on the original date.

> **E8.1** Week 1 approved: Jake 7.5 h = $180.00. Manager changes it to 8.0 h → adjustment +0.5 h, **+$12.00**, in week 2's pay run. Stage labour cost rises by $12.00 × 1.25 = **$15.00** on the original date.

## 9. Pay run contents and approval

Draft for period [start, end] includes, per person:
- all unlocked logs dated in the period;
- all unlocked logs dated earlier (late entries, adjustments) not yet in any approved pay run;
- reimbursements (§7).

Approve = snapshot all lines, lock the logs, compute contractor GST, post one ledger credit per person. A pay run can be **reopened** only while no later pay run is approved; reopening deletes its ledger credits and unlocks its logs (audited).

**Flags (warnings, except where noted):**
| Flag | Rule | Blocks approval? |
|---|---|---|
| Missing rate | Any line with $0.00 due to missing rate | **Yes**, until fixed or waived (waiver audited) |
| Below award floor | §10 | No |
| Double pay | Person has time-based (hourly/daily) and output-based (per unit/lump sum) logs on the same stage and date | No |
| Paused/Done stage | Log dated on a day the stage was Paused or after Done | No |
| Gap | §14 | No |
| Possible duplicate | Two logs with same person, date, stage and basis created by different entries (e.g. manager and foreman both logged the day) | No |
| Owner 2FA off | — | **Yes** |

## 10. Award floor check (employees only)

Per employee per pay run: `effective hourly = (sum of earnings lines incl. adjustments) ÷ (sum of hours)`. If below their level's floor → warning with the shortfall `floor × hours − earnings`. Lines with 0 hours are ignored for hours but counted for earnings.

> **E10.1** Tom, one week: Mon per-unit 33.33 m² = $299.97 (8 h); Tue per-unit 20.00 m² × $9.00 = $180.00 (8 h). Earnings $479.97 ÷ 16 h = **$30.00/h** (displayed to cents, $29.998 → $30.00) < floor $32.00 → warning, shortfall 32.00 × 16 − 479.97 = **$32.03**.

## 11. Job costing

Labour cost of a log:
- **Employee:** `amount × (1 + on-cost %)`.
- **Contractor:** `amount`; if the **workspace is not GST registered** and the contractor is, add 10% (GST is a real cost then).
- Reimbursements are not labour (the expense itself is already costed).

Expense cost: `amount ex GST`; if workspace not GST registered → `amount incl. GST`.

> **E11.1** E4.1 stage cost: Sam $570.00 × 1.25 = $712.50; Dima $720.00 → stage labour **$1,432.50**.
> **E11.2** Same, workspace **not** GST registered: Dima $720.00 × 1.10 = $792.00 → stage labour **$1,504.50**.

## 12. Progress, forecasts and alerts

**Stage % complete**
- Unit stage: `min(measured quantity ÷ budgeted quantity, 100%)`. No budgeted quantity → treat as no-unit stage.
- No-unit stage: manager-set % (0/25/50/75/100) if set, else 0%.
- Done stage: 100%.

**Project % complete** = weighted average of stage % using each stage's labour budget as its weight. If every stage has a $0 labour budget, use a simple average.

**Forecast labour** for a stage (only when % complete ≥ 10% and not Done): `actual labour ÷ % complete`. Done stage: forecast = actual.

**Alerts**
- **Over budget (red):** actual labour > labour budget.
- **Trending over (amber):** forecast labour > labour budget × 1.05 (5% tolerance, to avoid noise), and not already red.

**Margins (project)**
- `earned value = contract value × project % complete`
- `margin to date = earned value − (labour cost + expense cost to date)`
- `forecast margin = contract value − (Σ stage expected labour + expense cost to date + remaining materials budget)`, where stage expected labour = forecast labour if it exists, else max(labour budget, actual labour); remaining materials budget = max(project materials budget − materials expenses to date, 0).

> **E12.1** Sheet install: budget 400 m², labour budget $4,000.00. Measured 120 m² → **30%**. Labour so far $1,432.50 → forecast $1,432.50 ÷ 0.30 = **$4,775.00** > $4,200.00 → **amber, trending over by $775.00**.
> **E12.2** Repairs (no unit): manager set 50%, labour $900.00, budget $1,500.00 → forecast **$1,800.00** → amber, trending over by **$300.00**.
> **E12.3** Clean-up (no unit, no % set): labour $1,600.00, budget $1,500.00 → **red, over by $100.00**.

## 13. Stage segments and working days

- Segments are half-open date ranges [start, end). Start opens one at the start date. Pause closes it with end = pause date (first day not worked; reason stored). Resume opens a new one at the resume date. Done closes the last one with end = completion date + 1 day (the completion day counts as worked).
- **Real working days** of a stage = workspace working days inside its segments.
- **Paused too long:** a stage paused for > 5 working days → Home alert.

> **E13.1** Sheet install (2026): active Mon 7 – Wed 9 Sep, paused Thu 10 (Weather), resumed Tue 15, Done Thu 17 → real working days = 3 + 3 = **6**; days lost to weather = Thu 10, Fri 11, Mon 14 = **3**. (Pause date = first day not worked; resume date = first day worked again.)

## 14. Gaps, utilisation

- **Gap:** working day in the period, crew member active that day (between active from/to), no log (any kind) and no no-work marker.
- **Available days** = working days while active − no-work days with reason Leave or Sick. (Rain/Other still count as available → shows time lost.)
- **Utilisation** = days with ≥ 1 log ÷ available days.

> **E14.1** Week Mon–Fri, Jake logged Mon–Wed, Rain marker Thu, nothing Fri → gap **Fri**; available 5; utilisation 3 ÷ 5 = **60%**.

## 15. Payout ledger

Per person, entries in date order:
- **Credit:** approved pay run total (§6, incl. reimbursements).
- **Debit:** Advance, Payment.

`balance = Σ credits − Σ debits` (positive = business owes the person). An advance may make the balance negative (person owes the business) until the next pay run.

"Unpaid too long" alert: the oldest unpaid credit (paid off in date order — oldest first) is older than one pay period.

> **E15.1** Dima: Mon advance $300.00 → balance −$300.00. Pay run approved $1,782.00 → $1,482.00. Fri payment $1,482.00 → **$0.00**.

## 16. Crew statement (per person per pay run)

Shows: business name + ABN, person name (+ ABN for contractors), period, each line (date, job, stage, basis, qty, hours, rate, amount), adjustments and late entries (labelled), subtotal, GST, reimbursements, total, payouts recorded in the period, balance after. Footer for contractors: "Statement only — not a tax invoice. Please send your invoice as usual."
