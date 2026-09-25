# PRD — Crew & Job Costing SaaS for Roofing Contractors

**Working name:** RoofLedger (placeholder)
**Version:** 1.0 — MVP scope
**Market:** Australia (launch: Sydney / NSW)
**Currency / units:** AUD, metric (m², lineal metres)
**Date:** September 2026

---

## 1. Summary

A manager-only web app for small roofing businesses (3–15 crew) that turns scattered chat messages into a clean record of who worked where, on which stage, for how much — and shows whether each job is making money while there's still time to fix it.

Not a full field-service suite. No quoting, no CRM, no scheduling board in v1. It does four things well:

1. Log crew work fast — including pasting it straight from the group chat.
2. Handle mixed pay: hourly, daily, and by progress (m², lineal metre, per stage).
3. Cost every job by stage, including stages that stop and restart.
4. Tell the owner, every Monday, what's off.

---

## 2. Problem

Roofing crews report work through group chats. The owner or manager reconstructs hours, progress and expenses from those messages at pay time. Result:

- No job-level truth. Nobody knows a job's labour cost until it's over, if ever.
- Pay disputes. "I did 140 m² on Tuesday" vs. "you did 110" — no record.
- Mixed pay models (hourly apprentice, daily roofer, m²-rate subbie on the same job) break spreadsheets.
- Stages pause for weather or materials, so "days on the job" means nothing.
- Existing tools assume the crew will use an app. They mostly don't — foreman push-back is the most common way time-tracking rollouts fail, and the pattern is: app installed, adoption fails, foreman goes back to manual, then paper.

---

## 3. Target customer

**Primary:** Owner-operated roofing businesses in Australia, 3–15 people on the tools, 1–3 people managing. Re-roofs, restorations, repairs, new builds.

**Traits:**
- Mix of employees (award-covered) and ABN subcontractors.
- Runs 2–8 jobs at once, crew moves between them.
- Already uses Xero or MYOB for accounts; payroll done in Xero Payroll or by a bookkeeper.
- Currently: WhatsApp / Messenger group + a spreadsheet or notebook.

**Buyer:** owner. **Daily user:** owner, office manager, or foreman/leading hand.

**Secondary later:** adjacent trades with the same shape — gutters, cladding, solar mounting, scaffolding, waterproofing.

---

## 4. Market and positioning

| Tool | What it is | Why it doesn't fit this customer |
|---|---|---|
| Tradify, Fergus, ServiceM8, simPRO, AroFlo | Full job management (quote → invoice) | Built around the crew using the app. Per-user pricing ($45–77 AUD/user/month for Tradify, Fergus, Ascora). Weak on piece-rate pay. Several have no or limited offline use. |
| NextMinute | AU construction job management incl. roofing | Broad suite, $199–349/month, crew-app oriented. |
| Workyard, ClockShark, Connecteam | Time tracking + GPS | Hours only. No progress pay, no stage costing. |
| AccuLynx, JobNimbus, QuoteIQ, Projul | US roofing CRMs | US-centric (insurance claims, W-2/1099, QuickBooks). |

**Positioning:** *"The chat your crew already uses, turned into job costs and a pay sheet."*

**Wedges competitors don't cover well:**
1. **Manager-only entry.** Works with zero crew adoption.
2. **Chat import.** Paste or forward the group chat; AI drafts the logs; manager approves.
3. **Mixed pay in one place,** including m²/lineal-metre/per-stage rates split across a crew.
4. **Stage costing with pauses.**
5. **Flat company pricing,** not per user.

---

## 5. Product principles

1. **The manager is the user.** Crew never need an account. Crew features are optional and later.
2. **Faster than typing in the chat.** Logging a crew's full day on one job: under 30 seconds.
3. **AI drafts, human approves.** Nothing from chat import is saved without a manager confirming it.
4. **Money is always traceable.** Every dollar on a dashboard drills down to the log line or receipt behind it.
5. **Not payroll, not accounting.** We compute earnings and job costs, then export. Xero stays the system of record for tax, super and STP.

---

## 6. Users and roles

| Role | Can do | Can't do |
|---|---|---|
| **Owner** | Everything. Billing, rates, exports, delete. | — |
| **Manager** | Projects, stages, logs, expenses, pay runs, reports. | Billing, delete workspace. |
| **Foreman** (optional) | Log work and expenses for assigned projects; mark stage progress. | See pay rates, earnings, margins. |
| **Accountant** (read-only, free seat) | View and export pay runs, expenses, TPAR data. | Edit anything. |

Crew members exist as **records**, not users.

---

## 7. Core concepts

| Entity | Key fields | Notes |
|---|---|---|
| **Workspace** | Business name, ABN, GST registered, pay week start, default on-cost %, timezone | One per business. |
| **Client** | Name, phone, email, address | Lightweight. No CRM. |
| **Project** | Client, site address, job type, contract value (ex GST), status, start date, target finish | Status: Quoted, Active, On hold, Complete, Closed. |
| **Stage** | Project, name, order, status, budget (labour $ / materials $ / optional quantity + unit), measured quantity | Status: Not started, Active, Paused (reason), Done. |
| **Stage segment** | Stage, start date, end date, pause reason | Auto-created when a stage is paused/resumed. Powers "real working days". |
| **Stage template** | Job type, ordered stages with default units and budget % | Editable. Last used shown on new project. |
| **Crew member** | Name, phone, type (Employee / ABN contractor), level, ABN, GST registered, default rates, active | See §8.4. |
| **Rate** | Crew member, pay basis, amount, effective from, optional project override | Rate history kept; old logs keep old rates. |
| **Work log** | Date, crew member, project, stage, basis, quantity (hours / days / units), rate snapshot, amount, source, note, approved by | Source: Manual, Crew-day, Chat import, Foreman. |
| **Progress entry** | Stage, date, quantity, unit, crew split, confirmed by | Drives piece-rate pay. |
| **Expense** | Project, stage (optional), category, supplier, amount, GST, paid by, receipt image, date | Paid by: Company card, Cash, Crew member (reimburse). |
| **Pay run** | Period, lines per crew member, status | Draft → Approved → Exported. |
| **Payout** | Crew member, date, amount, type (Advance, Payment, Reimbursement), method, note | Ledger. We record, never move money. |
| **Audit event** | Who, what, when, before/after | Every change to logs, rates, pay runs. |

---

## 8. Features — MVP

### 8.1 Onboarding

- Sign up with email or Google. Create workspace: business name, ABN, GST status.
- Pick trade type → preloads stage templates and expense categories (roofing default).
- Add crew: quick table entry (name, type, level, rate). CSV import optional.
- **Target: first project with first log in under 10 minutes.**

### 8.2 Projects

- Create: client, address, job type, contract value. Template appears pre-filled from the last project of the same job type → **Accept** or **Edit**.
- Project page: stages list with status chips, budget vs actual, crew on it this week, recent logs, expenses, photos/files.
- Attach files and photos (quote, plans, before/after). Plain storage, no markup in v1.

### 8.3 Stages and templates

**Default roofing templates** (editable, per workspace):

| Job type | Stages |
|---|---|
| Metal re-roof | Site setup & safety → Strip & remove → Battens / structural repairs → Sarking & insulation → Sheet install → Flashings, gutters & downpipes → Clean-up & handover |
| Tile re-roof | Site setup & safety → Strip & remove → Battens → Sarking → Tile install → Ridge bedding & pointing → Clean-up & handover |
| Restoration | Site setup → Pressure clean → Repairs & replacements → Re-bed & re-point → Coat / paint → Clean-up |
| Repair | Inspect → Repair → Clean-up |
| New build | Battens → Sarking & insulation → Roof sheeting/tiles → Flashings → Gutters & downpipes |

- Each template stage has an optional default **unit** (m², lineal metre, each, lump sum) and **budget share %** of contract value.
- **Pause / resume** a stage with one tap. Reason picker: Weather, Waiting on materials, Waiting on client/builder, Crew on another job, Other. Pause history is reportable.
- **Done** requires a completion date; optional note and photo. No formal sign-off workflow in v1.
- Stages can overlap. Order is display order, not a dependency chain.

### 8.4 Crew and pay

**Worker types**
- **Employee** — award-covered. Stores level/classification (free text + suggested list: Labourer, Apprentice yr 1–4, Roofer, Leading hand, Foreman). On-cost % applied to job costs.
- **ABN contractor** — stores ABN and GST-registered flag. GST added on top of earnings where applicable. Included in TPAR export.

**Pay bases** (a person can have several, e.g. daily normally, m² on some stages):

| Basis | Entry unit | Notes |
|---|---|---|
| Hourly | Hours (0.25 steps) | Optional overtime multiplier per line. |
| Daily | Day (1, 0.5) | Half-day supported. |
| Per unit | m², lineal metre, or each | Linked to a stage's progress. |
| Per stage | Lump sum | Paid on stage Done, split across assigned crew. |

**Rates**
- Default rate per person per basis. Optional **project override** (e.g. higher rate for a steep or heritage job).
- Rate changes are dated. Past logs keep their snapshot rate.

**On-cost** (job costing only, not pay)
- Workspace default % added to employee labour for true job cost (super, workers comp, leave, payroll tax). Default: 25%, editable.
- Contractors: no on-cost.

**Award floor check (employees only)**
- Owner sets a floor hourly rate per level. If a piece-rate or daily line works out below the floor for the hours logged, show a warning. Warning only, never blocks.
- Why: the Building and Construction General On-site Award allows employer and employee to agree to piece rates, so piece rates for employees are allowed — but the owner needs a guardrail. We don't compute award entitlements; that stays with payroll.

### 8.5 Logging work — three ways in

**A. Crew-day grid (default, fastest)**
- Pick date + project + stage → tick crew who were there → each defaults to their usual basis and a full day/standard hours → adjust exceptions → save.
- "Same as yesterday" button copies the previous day's crew and job.
- Keyboard-friendly on desktop, thumb-friendly on phone.

**B. Chat import (the differentiator)**
- Manager pastes text or uploads a WhatsApp chat export (.txt/.zip) or screenshots.
- AI extracts candidate entries: date, person, project, stage, hours/days/quantity, expenses mentioned.
- Matching uses crew names/nicknames and project address/nicknames stored on records ("Smith job", "the Ryde one").
- Output is a **review queue**: each line shows the source message, the drafted entry, and a confidence flag. Manager approves, edits, or discards. Bulk approve for high-confidence lines.
- Unmatched names/projects prompt "Who is 'Dima'?" once, then remembered as an alias.
- Duplicate guard: warns if a matching log already exists for that person/date/project.
- Messages are processed then discarded; only approved entries and the snippet they came from are stored.

**C. Foreman entry (optional)**
- Foreman role logs crew-day grid and progress for their projects from a phone. Sees no rates or dollars.

**Rules for all logs**
- One person can have multiple logs per day across projects/stages.
- A day with no log for an active crew member shows as a **gap** (see §8.9).
- Edits after a pay run is approved require Owner/Manager and create an audit event and an adjustment line in the next pay run.

### 8.6 Progress and piece-rate pay

- On a stage with a unit, manager/foreman enters **quantity done** for a date (e.g. 120 m²).
- Assign which crew did it and the split: **equal** (default) or custom %.
- Earnings = quantity × each person's per-unit rate × split. Cost lands on the stage.
- Stage shows **measured vs budgeted quantity** and % complete.
- Measurement is confirmed by whoever enters it (stamped with name). Optional photo.
- Per-stage lump sums trigger when the stage is marked Done.

### 8.7 Expenses

- Add: photo of receipt → OCR drafts supplier, date, total, GST → manager confirms project/stage/category.
- Default categories: Materials, Equipment hire, Scaffolding, Skip/tip fees, Fuel & travel, Parking & tolls, Subcontractor (non-crew), Permits, Other.
- **Paid by** a crew member → auto-creates a reimbursement owed in the payout ledger.
- Amounts stored ex GST and GST separately.
- Receipt images kept against the expense.

### 8.8 Pay runs and payout ledger

- Pay period: **weekly** by default (Mon–Sun, configurable start day). Fortnightly option.
- Pay run draft = all approved logs in the period, grouped by person, then project/stage, with basis, quantity, rate, amount; plus reimbursements and adjustments.
- Contractors: subtotal, GST (if registered), total.
- Flags before approval: gaps, lines below award floor, unapproved chat-import entries in the period, logs on paused/done stages.
- Approve → locks logs → export.

**Payout ledger** (per crew member)
- Earned (from approved pay runs) − Advances − Payments + Reimbursements = **Balance owed**.
- Manager records cash, bank transfer, or advance. No money movement in-app.
- Crew statement: one-page PDF per person per period, shareable by link or SMS, so the "I did 140 m²" argument ends with a document.

### 8.9 The Monday screen (home dashboard)

Opens to one screen. Top to bottom:

1. **Needs attention** (red/amber list, max 7 items, each clickable):
   - Active jobs over labour budget or trending over (actual labour ÷ % complete > budget).
   - Stages paused > 5 working days.
   - Logging gaps last week (crew member, days missing).
   - Chat-import entries waiting for review.
   - Unpaid balances older than one pay period.
   - Lines below award floor.
2. **Active jobs** — one row each: job, stage now, % complete, labour cost vs budget, margin to date, days since last log.
3. **Last week** — total labour cost, hours/days worked, m² installed, expenses, crew utilisation (days logged ÷ days available).
4. **This week's pay** — draft total, employees vs contractors, outstanding balances.

### 8.10 Reports (v1 set)

- **Job profitability** — contract value vs labour (with on-cost) + expenses, by stage. Budget vs actual.
- **Crew** — per person: days/hours, units produced, earnings, cost per m² by stage type, jobs worked.
- **Productivity** — m² per crew-day by stage type and job type, over time.
- **Pauses** — time lost by reason, by job, by month.
- **Pay history** — pay runs, payouts, balances.
- All reports: date range filter, CSV export, PDF export.

### 8.11 Exports and integrations

- **Xero** (v1): push approved pay run as timesheets to Xero Payroll for employees; push contractor lines and expenses as bills. Map crew → Xero employees/contacts once.
- **CSV** for everything (MYOB and bookkeeper fallback).
- **TPAR helper**: annual export of contractor name, ABN, address, gross paid incl. GST, GST — the fields the ATO requires for construction businesses that pay contractors. Due 28 August.
- MYOB native: v1.1.

---

## 9. Decisions on the open questions

Where the client hasn't answered, these are the defaults. Each is a setting or easy to change.

| Question | Default we're building | Why |
|---|---|---|
| Who enters logs? | Manager (and optionally foreman). Crew never log in. | Client's stated preference; crew app adoption is the #1 failure mode in this category. |
| When are logs entered? | End of each day, catch-up weekly. Gaps flagged. | Chat import makes weekly catch-up survivable. |
| Stage list | Templates per job type (§8.3), editable, last-used pre-filled. | Client confirmed. |
| Why stages pause / record reason? | Yes, one-tap reason picker. | Weather and materials delays are the norm; owners want to see time lost. |
| Stage sign-off | Mark Done + date, optional photo. No approval chain. | Crew <10; formal sign-off is overhead. |
| Rates per person or per job? | Per person, with optional per-project override. | Covers both without complexity. |
| Progress pay unit | m², lineal metre, each, or lump sum per stage. | m² for sheets/tiles/sarking; lineal m for gutters, flashings, ridges. |
| Who confirms measurements? | Whoever enters it; name stamped. | Traceability without workflow. |
| Split of piece-rate pay | Equal by default, custom % allowed. | Crews usually split evenly; exceptions happen. |
| Overtime / weekends / rain days | Manual multiplier or extra line; no award engine. | Award calculation belongs in payroll. We flag, not compute. |
| Earned only, or paid too? | Both — payout ledger with advances. | Cash advances are common; balances cause disputes. |
| Pay frequency | Weekly. | Construction norm. |
| Expenses & receipts | Photo + OCR, reimbursements tracked. | Receipts get lost in chats. |
| GST | Stored separately everywhere. | Required for BAS and contractor bills. |
| Accounting software | Xero first, CSV for everything else. | Dominant for AU small trades. |
| Client invoicing / progress claims | Out of v1. Track contract value only. | Owners already invoice from Xero. Revisit v2. |
| Subcontractors (non-crew, e.g. plumber) | Logged as an expense, category "Subcontractor". | Keeps crew list clean. |
| Device | Responsive web app (PWA), desktop + phone. | Managers use both; no app-store friction. |
| Offline | Foreman entry queues offline and syncs. Manager screens need connection. | Rooftops have patchy signal; manager is usually in the ute or office. |
| Permissions | Foreman can't see dollars. | Standard ask in small crews. |

---

## 10. Non-functional requirements

- **Hosting:** Australian region (Sydney). Data stays in AU.
- **Privacy:** Compliant with the Privacy Act 1988 / APPs. Store TFNs? **No.** TFNs live in payroll, not here.
- **Security:** Email/Google sign-in, 2FA for Owner, role-based access, encrypted at rest and in transit.
- **Audit:** Every edit to logs, rates, pay runs, payouts recorded with before/after.
- **Performance:** Dashboard loads < 2 s on 4G for a workspace with 2 years of data.
- **Chat import:** 1,000 messages processed < 60 s. AI output never auto-committed.
- **Availability:** 99.5%.
- **Backups:** Daily, 30-day retention. Full workspace export (CSV + receipts zip) available to Owner any time.
- **Accessibility:** WCAG 2.1 AA for core flows. Large tap targets for phone use in gloves/sun.

---

## 11. Out of scope for v1

- Quoting, estimating, roof measurement.
- CRM, leads, sales pipeline.
- Scheduling board / calendar dispatch.
- Client invoicing, progress claims, retentions.
- Payroll processing, STP, super payments, award interpretation.
- GPS tracking or geofenced clock-in.
- Crew self-service app.
- Inventory / stock.
- SWMS and safety forms.
- Direct WhatsApp bot integration (import via paste/export only in v1).

---

## 12. Pricing (indicative — validate with design partners)

Flat per business, not per user. Crew records unlimited on all plans.

| Plan | AUD / month ex GST | Includes |
|---|---|---|
| Starter | $79 | 2 manager seats, 10 active crew, chat import 500 msgs/mo |
| Crew | $149 | 5 manager/foreman seats, 25 active crew, unlimited chat import, Xero sync |
| Accountant seat | Free | Read-only |

14-day free trial, no card. Annual = 2 months free.

Reference: a 6-person team on per-user tools pays ~$290–460/month.

---

## 13. Success metrics

**Activation**
- Workspace creates a project and logs ≥ 5 crew-days within 7 days of sign-up.

**Engagement**
- Logging completeness: % of active crew-days with a log. Target ≥ 90% by week 4.
- Time to log a crew-day (grid): median < 30 s.
- Chat-import approval rate without edits: ≥ 80%.

**Value**
- % of active jobs with labour cost vs budget visible: 100% (by definition once logged).
- Owner opens Monday screen ≥ 1×/week.

**Business**
- Trial → paid ≥ 25%.
- Month-3 logo retention ≥ 85%.

---

## 14. Roadmap after v1

**v1.1**
- MYOB integration.
- Crew statements via SMS link with read receipt.
- Photo notes on progress entries.
- Job-type benchmarks (cost per m² by job type, company history).

**v2**
- WhatsApp Business bot: foreman sends a message, draft log appears in review queue.
- Optional crew app (view own logs and balance only — read, don't enter).
- Progress claims and client invoicing, pushed to Xero.
- Scheduling: who's on which job next week.
- Weather-aware pause suggestions (BOM data).

**v3**
- Adjacent trades: gutters, cladding, scaffolding, solar mounting.
- Estimating from historic productivity (m²/crew-day × rates → labour quote).

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Chat messages too messy for AI extraction | Review queue, aliases, confidence flags; manual grid is always the fallback. |
| Manager stops logging after week 2 | Gap alerts, "same as yesterday", weekly reminder, Monday screen shows value fast. |
| Owners expect payroll | Clear positioning; Xero push makes the handoff one click. |
| Piece-rate / award compliance liability | Floor warning only; explicit copy that award compliance sits with payroll/employer. |
| Per-user incumbents add "manager-only" mode | Chat import + piece-rate depth + flat price is the moat; move fast on v2 bot. |
| Contractor vs employee misclassification | Out of scope to judge; we just keep the types separate and exportable. |

---

## 16. To validate with the first client (design partner)

Short list — everything else is defaulted above.

1. One real week of their chat messages (to tune import).
2. Their actual stages for their two most common job types.
3. Their rate table: levels, bases, rough amounts.
4. The Monday screen — does §8.9 match what they'd want? What's missing?
5. Would they pay $79–149/month for this? What would make it a no?
