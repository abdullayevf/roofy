# Roofy — MVP Product Spec

**Status:** Draft for review · **Date:** 2026-09-28
**Replaces:** the original PRD (`docs/roofy-prd.md`, removed — see git history).
**Companion docs:** `02-pay-rules.md` (all money maths, with worked examples) · `03-architecture.md` (stack, data model, offline, hosting, testing) · `04-design-process.md` (how UX/UI is designed, tested and locked).

Working name "Roofy" (PRD said "RoofLedger"; "Meer" was only a codename in a prompt template). Name is not final.

---

## 1. What we are building

A mobile-first web app for small Australian roofing businesses (3–15 crew). The **manager** records who worked where, on which stage, for how much. The app turns that into:

1. **Job costs by stage** — including stages that pause and restart — while there is still time to fix a job.
2. **A weekly pay sheet** for mixed pay: hourly, daily, per m² / lineal metre / each, and lump sum per stage.
3. **A Monday screen** that says what's off.

Crew never need an account. It is not payroll and not accounting — we calculate earnings and job costs, then export CSV.

**Positioning:** "Job costs and a pay sheet your crew never has to touch."
**Wedges:** manager-only entry · mixed pay incl. piece rates split across a crew · stage costing with pauses · flat company price (not per user).

## 2. Changes from the original PRD

| Topic | PRD said | Now |
|---|---|---|
| Chat import (WhatsApp paste/export/screenshots, AI extraction, review queue, aliases) | Core differentiator | **Removed entirely.** Not in MVP, not on the roadmap. |
| Platform | Responsive PWA | **Mobile-first PWA**, installable to home screen, one clean design on iPhone, Android and desktop. |
| Xero | v1 push to Xero Payroll + bills | **CSV only in MVP.** Xero later. |
| TPAR export | v1 | Later (rule needs accountant review; first due date is Aug 2027). |
| Receipt OCR | v1 | Later. MVP = photo + fast manual fields. |
| Offline | Foreman entry queues offline | **All entry goes through an on-phone outbox** ("keep it, send later"), plus cached job/stage/crew lists. No full offline sync. |
| Backups | Daily, 30-day retention | Nightly, **7-day** retention, encrypted, delivered by Telegram bot. |
| Hosting | AU region | Self-hosted on own VPS (France) for build + pilot; **move to Sydney VPS before paying customers.** |
| Contractor invoices | Unspecified | **Subcontractors send their own invoices.** Roofy issues a *statement*, never a tax invoice (no RCTI). |
| Hours on logs | Only for hourly | **Every work log records hours**, pre-filled from a standard day, editable. |
| Days with no work | Not modelled | New **"no work" marker** (Rain, Leave, Sick, Other) so gaps aren't false alarms. |
| Lump-sum crew | "Split across assigned crew" (no assignment model) | Split across **everyone who logged work on the stage**, editable at Done. |
| Stage % complete (no unit) | Undefined | Optional manager-set % in quarter steps; otherwise 0% until Done. |
| Pricing tiers | Differed by chat-import quota | Differ by seats and active crew only. |

## 3. Users and roles

| Role | Can | Can't |
|---|---|---|
| **Owner** | Everything: billing, rates, exports, delete workspace, manage members. 2FA required. | — |
| **Manager** | Projects, stages, crew, rates, logs, progress, expenses, pay runs, payouts, reports, exports. | Billing, delete workspace, change Owner. |
| **Foreman** (optional) | For **assigned projects only**: log crew-days, enter progress, pause/resume stages, add expenses. Sees crew names, jobs, stages, quantities, own expense amounts. | See any rate, earning, pay run, balance, budget or margin. Mark a stage Done. |
| **Accountant** (free, read-only) | View + export pay runs, payouts, expenses, reports. | Edit anything. |

Crew members are **records**, not users.

## 4. Core concepts (short)

Full field list in `03-architecture.md §5`.

- **Workspace** — one business: name, ABN, GST registered?, timezone (default Australia/Sydney), pay period (weekly default / fortnightly) + start day (Mon default), working days (Mon–Fri default), standard day hours (default 8.0), on-cost % (default 25%).
- **Client** — name, phone, email, address. No CRM.
- **Project** — client, site address, nickname, job type, contract value ex GST, status (Quoted, Active, On hold, Complete, Closed), start date, target finish.
- **Stage** — ordered, status (Not started, Active, Paused, Done), labour budget $, materials budget $, optional unit (m², lm, each) + budgeted quantity, optional lump-sum pay amount, optional manual % (for no-unit stages).
- **Stage segment** — active periods of a stage; created automatically by start/pause/resume/done.
- **Stage template** — per job type; ordered stages with default unit and budget share %.
- **Crew member** — name, phone, type (Employee / ABN contractor), level (employees), ABN + GST registered (contractors), active from/to.
- **Rate** — crew member, basis (hourly / daily / per unit + which unit), amount, effective from, optional project override. History kept.
- **Work log** — date, crew member, project, stage, basis, quantity, hours, rate snapshot, amount, source (Grid / Progress / Lump sum / Adjustment), entered by.
- **Progress entry** — stage, date, quantity done, crew split → generates per-unit work logs.
- **No-work marker** — crew member, date, reason (Rain, Leave, Sick, Other). Unpaid in MVP.
- **Expense** — project, optional stage, category, supplier, amount ex GST + GST, paid by (Company card / Cash / Crew member), receipt photo, date.
- **Pay run** — period, status Draft → Approved → Exported, frozen lines once approved.
- **Payout** — crew member, date, amount, type (Advance / Payment), method, note. Record only; we never move money.
- **Audit event** — who, what, when, before/after, on every change to money-relevant records.

## 5. Features — MVP

### 5.1 Onboarding
- Sign up with Google or email + password. Owner must enable 2FA before first pay run approval.
- Wizard: business name, ABN, GST registered → trade (roofing) → preload templates + expense categories → quick-add crew table (name, type, level, main basis + rate). CSV crew import optional.
- An "Install app" guide (iPhone: Share → Add to Home Screen; Android: install prompt).
- **Target:** first project with first log in under 10 minutes.

### 5.2 Projects
- Create: client (pick or quick-add), address, nickname, job type, contract value. Stages pre-fill from the **last project of the same job type** (or the template) → Accept or Edit.
- Project page: stage list with status chips and % complete, labour + materials budget vs actual, forecast margin, crew this week, recent logs, expenses, files/photos.
- Files: upload photos/PDFs (quote, plans, before/after). Plain storage, no markup.

### 5.3 Stages and templates
Default roofing templates (editable per workspace):

| Job type | Stages |
|---|---|
| Metal re-roof | Site setup & safety → Strip & remove → Battens / structural repairs → Sarking & insulation → Sheet install → Flashings, gutters & downpipes → Clean-up & handover |
| Tile re-roof | Site setup & safety → Strip & remove → Battens → Sarking → Tile install → Ridge bedding & pointing → Clean-up & handover |
| Restoration | Site setup → Pressure clean → Repairs & replacements → Re-bed & re-point → Coat / paint → Clean-up |
| Repair | Inspect → Repair → Clean-up |
| New build | Battens → Sarking & insulation → Roof sheeting/tiles → Flashings → Gutters & downpipes |

- Each template stage: optional default unit (m², lm, each) and budget share %.
- **Start / Pause / Resume / Done** with one tap. Pause reason: Weather, Waiting on materials, Waiting on client/builder, Crew on another job, Other (+ note).
- **Done** needs a completion date; optional note + photo. Done triggers lump-sum pay if set. Manager/Owner only.
- Stages may overlap. Order is display only.
- A log on a Paused or Done stage is allowed but flagged in the pay run.

### 5.4 Crew and pay
- **Employee:** level (suggested: Labourer, Apprentice yr 1–4, Roofer, Leading hand, Foreman; free text allowed). On-cost % applies to job cost.
- **ABN contractor:** ABN, GST registered flag. GST added on top of earnings if registered. No on-cost.
- **Pay bases:** Hourly (0.25 h steps, optional overtime multiplier per line) · Daily (1 or 0.5) · Per unit (m², lm, each — via progress entries) · Lump sum per stage (set on the stage, paid at Done).
- **Rates:** default per person per basis; optional per-project override; dated. Old logs keep their snapshot.
- **Award floor check (employees):** owner sets a floor hourly rate per level. If a person's pay in a pay period ÷ hours logged falls below their floor → warning. Never blocks. Copy makes clear award compliance sits with the employer/payroll.
- **Double-pay check:** a person with both a time-based log (hourly/daily) and an output-based log (per unit/lump sum) on the same stage and date → warning.

### 5.5 Logging work
**A. Crew-day grid (the main screen, must be fast)**
- Date (defaults today) → project → stage → tick crew who were there. Each ticked person defaults to their usual basis: full day / standard hours. Adjust exceptions (half day, hours, overtime) → Save.
- "Same as yesterday" copies the previous logged day's crew + project + stage.
- Target: a full crew-day on one job in **under 30 seconds** on a phone.
- Per-unit workers ticked on the grid get a time-only log (hours recorded, $0) — their pay comes from the progress entry. Grid tells the user so.

**B. Progress entry** (§5.6) and **C. Foreman entry** — same screens, no dollars shown.

**All entries go through the outbox** (`03-architecture.md §7`): they save instantly on the phone, show "waiting to send" without signal, and send automatically. Nothing is lost if the app closes.

**Rules**
- A person may have several logs per day across projects/stages.
- A working day with no log and no no-work marker for an active crew member = **gap**.
- Editing or deleting a log in an approved pay run: Owner/Manager only; creates an audit event and an **adjustment** in the next pay run (`02-pay-rules.md §8`).
- Adding a log dated inside an approved period is allowed; it lands in the next pay run marked "late entry".

### 5.6 Progress and piece-rate pay
- On a stage with a unit: enter quantity done for a date (e.g. 120 m²), pick crew, split **equal** (default) or custom %.
- Earnings per person = their share of the quantity × their own per-unit rate.
- Stage shows measured vs budgeted quantity and % complete.
- Entry stamped with who entered it; optional photo.
- Lump sums: on Done, the app proposes an equal split among everyone who logged on that stage; manager can edit before confirming.

### 5.7 Expenses
- Add: photo of receipt (camera or library, compressed on phone) → fields: date, supplier, total, GST (defaults total ÷ 11, editable, or "no GST"), project, optional stage, category, paid by.
- Categories: Materials, Equipment hire, Scaffolding, Skip/tip fees, Fuel & travel, Parking & tolls, Subcontractor (non-crew), Permits, Other. Editable.
- Paid by a crew member → reimbursement line in that person's next pay run.
- Stored ex GST and GST separately.

### 5.8 Pay runs and payout ledger
- Period weekly (default, Mon–Sun) or fortnightly; start day configurable.
- Draft = live view of all logs in the period not yet in an approved pay run, plus late entries, adjustments and reimbursements. Grouped by person → project/stage; shows basis, quantity, hours, rate, amount.
- Contractors: subtotal, GST (if registered), total.
- **Flags before approval:** gaps · below award floor · double pay · logs on Paused/Done stages · crew with no rate for a basis used · Owner 2FA not enabled.
- **Approve** → lines frozen, logs locked. **Export CSV** → status Exported (re-export allowed).
- **Payout ledger per person:** Balance = approved pay run totals − advances − payments. Record cash / bank transfer / advance.
- **Crew statement:** one-page PDF per person per pay run; share via phone share sheet (SMS, WhatsApp, email) as a private link (unguessable, revocable, expires after 90 days) or as the PDF file.

### 5.9 Home — the Monday screen
Top to bottom:
1. **Needs attention** (max 7, most severe first, each tappable): jobs over labour budget (red) or trending over (amber) · stages paused > 5 working days · last week's logging gaps · entries on this phone's outbox that need attention · balances unpaid longer than one pay period · pay lines below award floor.
2. **Active jobs:** job, current stage(s), % complete, labour cost vs budget, forecast margin, days since last log.
3. **Last week:** labour cost, hours and crew-days, m² installed, expenses, crew utilisation.
4. **This pay period:** draft total, employees vs contractors, outstanding balances.

Foreman home = their assigned jobs + "Log today" + their outbox status. No dollars.

### 5.10 Reports (v1)
Job profitability · Crew (days/hours, units, earnings, cost per m² by stage type, jobs) · Productivity (m² per crew-day by stage type and job type over time) · Pauses (time lost by reason/job/month) · Pay history. All: date range filter, CSV export, PDF export. On phone: summary cards; full tables on desktop.

### 5.11 Exports
- CSV for every list and report.
- Pay run CSV in a layout a bookkeeper can key into Xero/MYOB.
- Full workspace export (CSV zip + files) for the Owner at any time.

## 6. Design principles (UI)

1. **Phone first, one hand, outdoors.** Big tap targets (min 48 px), high contrast for sunlight, numeric keypads for numbers, primary action in thumb reach.
2. **One clean design everywhere.** Not iOS-mimic, not Material-mimic. Respects safe areas (notch, home bar) and installed-app mode.
3. **Phone:** bottom tab bar (Home · Log · Jobs · Crew · More), bottom sheets for forms. **Desktop:** left sidebar, dialogs, wider tables. Same components, adaptive layout.
4. **Every screen designs all states:** empty, loading, error, offline / waiting to send, no permission.
5. **Money always traceable:** every dollar figure taps through to the logs or receipts behind it.
6. **Design is approved before backend work starts** — gates D1–D7 in `04-design-process.md`.

### Screen inventory (MVP)
1. Sign in / sign up · 2. Onboarding wizard · 3. Install guide · 4. Home (manager) · 5. Home (foreman) · 6. Log crew-day (grid) · 7. Progress entry · 8. No-work marker · 9. Jobs list · 10. New/edit job · 11. Job detail · 12. Stage detail (pause/resume/done, segments, progress history) · 13. Stage Done + lump-sum split · 14. Crew list · 15. Crew member detail (rates, logs, balance, statements) · 16. Expenses list · 17. Add/edit expense · 18. Pay runs list · 19. Pay run review (flags, lines, approve, export) · 20. Record payout · 21. Crew statement (PDF + public link page) · 22. Reports (5) · 23. Settings: business, pay period & working days, on-cost, levels & floor rates, templates, expense categories, members & roles, project assignments for foremen · 24. Outbox / sync status · 25. Record history (audit) · 26. Workspace export.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Home screen usable < 2 s on 4G for a workspace with 2 years of data (measured from Sydney after the Sydney move; from France during pilot, target < 3 s). Log save feels instant (outbox). |
| Availability | 99.5% target. Single VPS; documented restore < 2 h. |
| Backups | Nightly, encrypted, 7 days kept; delivered by Telegram bot; failure alert; monthly automated restore test. |
| Security | Google / email sign-in, 2FA for Owner, role-based access enforced on server and in database (row-level security), HTTPS only, encrypted backups. |
| Privacy | Privacy Act 1988 / APPs. No TFNs, no bank details. Privacy policy states where data is stored. |
| Audit | Every change to logs, rates, progress, stages status, pay runs, payouts, expenses: who, when, before/after. |
| Accessibility | WCAG 2.1 AA on core flows. |
| Devices | iOS Safari 17+ (installed and in-browser), Android Chrome, desktop Chrome/Safari/Edge/Firefox. |

## 8. Out of scope for MVP
Chat import (any form) · quoting / estimating / roof measurement · CRM · scheduling board · client invoicing / progress claims · payroll, STP, super, award interpretation · GPS / geofencing · crew self-service app · inventory · SWMS / safety forms · push notifications · Xero / MYOB integrations · TPAR export · receipt OCR · in-app billing (pilot is free; billing before paid launch).

## 9. Pricing (to validate with design partner)
Flat per business, unlimited crew records.

| Plan | AUD/month ex GST | Includes |
|---|---|---|
| Starter | $79 | 2 manager/foreman seats, 10 active crew |
| Crew | $149 | 5 manager/foreman seats, 25 active crew, integrations when released |
| Accountant | Free | Read-only |

14-day trial, no card. Annual = 2 months free.

## 10. Success metrics
- **Activation:** project + ≥ 5 crew-days logged within 7 days of sign-up.
- **Logging completeness:** ≥ 90% of active crew working days have a log or no-work marker by week 4.
- **Speed:** median crew-day grid save < 30 s.
- **Reliability:** 0 lost entries (every outbox entry reaches the server exactly once or shows "needs attention").
- **Value:** owner opens Home ≥ 1×/week.
- **Business:** trial → paid ≥ 25%; month-3 logo retention ≥ 85%.

## 11. After MVP (order to be confirmed)
Move to Sydney VPS · in-app billing (Stripe) · receipt OCR · TPAR export · Xero (timesheets + bills) · MYOB · job-type benchmarks · optional crew read-only view · scheduling · adjacent trades.

## 12. To validate with the design partner
1. Their stages for their two most common job types.
2. Their rate table: levels, bases, amounts, floor rates.
3. One real past week of work, entered by us → pay sheet compared to what they actually paid (becomes an acceptance test).
4. The Monday screen: right items? missing?
5. Would they pay $79–149/month? What makes it a no?
