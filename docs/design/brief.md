# Roofy — Design brief (D1)

**Status:** Draft for review · **Date:** 2026-09-28
Gate (`04-design-process.md` D1): a fresh critic subagent reads this brief plus `01-product-spec.md` §1–§6 and reports contradictions; fixed until none remain. See "Resolved ambiguity" at the end of §2.

This brief sets who Roofy is for, where they use it, how it should feel, and the numbers every screen is judged against. Flow-by-flow detail (steps, tap counts, offline behaviour, errors) is in `docs/design/flows.md`. Visual language is `docs/design/DESIGN.md` ("Galvanised").

---

## 1. Users

### Owner / Manager — 7 a.m. in the ute

Runs the business or a crew of 3–15. Opens Roofy before the trucks leave the yard: checks who's rostered where, glances at Home for anything red or amber, maybe approves a pay run over a coffee. Later in the day, on site, logs the crew's hours between jobs — one thumb, phone in a shirt pocket. Cares about one thing above all: **is this job still making money, and if not, why.** Never wants to do payroll maths by hand again.

### Foreman — on the roof, in glare, with gloves

Runs one or two active jobs day to day. Doesn't see rates, pay or budgets — the app quite literally hides all of it. Logs the crew who turned up, marks progress (m² done), pauses a stage for rain, snaps a photo of a receipt. Often has patchy signal up a ladder or under an eave. Needs the next tap to be obvious without reading — big targets, one hand, their own phone or a work phone that stays signed in.

### Accountant — at a desk

Free, read-only seat. Reviews pay runs, payouts, expenses and reports on a laptop, exports CSV for their own systems. Never edits anything in Roofy. Desktop-first user of an otherwise phone-first product — the design has to hold up widened, not just shrunk.

**Resolved ambiguity (see §2 note below):** the blanket rule "foreman never sees money" has one narrow, spec-required exception — a foreman sees the total they themselves typed for a receipt they are adding, because they have to see what they just entered. They never see anyone else's amount, any rate, budget, margin or balance. This is called out explicitly in every flow where it applies (see `flows.md`, "Add a receipt").

## 2. Context of use

- **Sun.** Outdoor phone screens in direct Australian sun. Every key figure must hold AAA contrast, not just AA (DESIGN.md §2).
- **Gloves, one hand.** Tap targets ≥ 48 px, 8 px apart minimum, primary action always in one-thumb reach at the bottom of the screen.
- **Patchy signal.** Field entry is never blocked by a missing connection — it saves to the phone first, always (`03-architecture.md` §7). Admin-only actions (rates, pay runs, settings) correctly say "Needs connection" rather than pretending to work.
- **Installed PWA.** Most field use is from a home-screen icon, not a browser tab — safe areas, standalone status bar colour, and no browser chrome to lean on.
- **Noise and interruption.** A crew-day log has to survive being started, put down mid-task when someone shouts from the ute, and finished later without losing anything.

**Note on the resolved ambiguity above:** product spec §3 lists what a foreman "can" see — "own expense amounts" — inside a role matrix whose "can't" column says foreman can't see "any rate, earning, pay run, balance, budget or margin." Read narrowly, the two lines don't conflict: the amount a foreman types into their own receipt (e.g. "$110.00" for screws) is not a rate, earning, budget, margin or balance — it's the number they just wrote down, present on screen only until they save. Every other screen and every other person's figures stay hidden from a foreman, exactly as the "can't" column says. Flows and screens built from this brief must treat "no dollars for foreman" as the rule and the expense-amount field as the one named exception, never generalised further.

## 3. Tone

Per DESIGN.md §1: **a site tool, not a SaaS dashboard.** The materials are galvanised steel, Colorbond charcoal, a chalk line and a steel tape — plain, tough, precise, readable in full sun, operable with one gloved thumb. Calm and certain, never cute. Numbers are the heroes; chrome stays quiet. Copy is short, plain, sentence case, verbs on buttons ("Save day", not "Submit"), and never uses the banned jargon (entity, sync, mutation, record as a noun for data, submit) — see DESIGN.md §7 and the design lint that enforces it.

## 4. UX targets

Numbered, testable, each with a tap and/or time budget. Every target below is one section in `flows.md`, with numbered steps, the control tapped at each step, offline behaviour, error copy and the e2e spec that proves the budget. "Taps" are counted exactly as defined at the top of `flows.md`.

1. **Log a full crew-day** ≤ 6 taps and < 30 s. (`flows.md` → "Log a full crew-day"; achievable because date, project, stage and crew all come from "Same as yesterday" — see the tap arithmetic there.)
2. **Same as yesterday** (a full repeat day, no changes) ≤ 3 taps.
3. **Progress 120 m² split two ways** ≤ 8 taps.
4. **Pause a stage for rain** ≤ 4 taps.
5. **Add a receipt paid by a crew member** ≤ 10 taps (excluding typing).
6. **Find the job losing money and why** ≤ 3 taps from Home.
7. **Review and approve a pay run** ≤ 5 taps.
8. **Record a payout** ≤ 6 taps.
9. **First project with first log** in < 10 minutes (onboarding ≤ 25 taps, excluding typing).

These nine targets, plus seven supporting flows that need the same rigour without a numbered spec target (no-work marker, stage done with lump sum, expense edit, outbox needs attention, statement share, reports drill-down, settings changes), are all specified in `flows.md`.

## 5. What "done" looks like for this brief

- Every UX target above has a flow in `flows.md` with a passing tap-budget test.
- No contradiction between this brief and `01-product-spec.md` §1–§6 (checked by the D1 critic gate).
- Nothing in the screen inventory (product spec §6, items 1–26) is left without a route and a flow — see the mapping table in `flows.md`.
